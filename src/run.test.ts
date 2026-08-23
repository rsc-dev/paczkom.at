import { beforeEach, describe, expect, it } from 'vitest';
import { dailySeed } from './core/daily.js';
import type { DaySummary } from './core/game.js';
import { DAILY_PROFILE } from './core/profiles.js';
import { currentStreak, finishDailyRun, readBest, readRecords, startDailyRun } from './run.js';
import type { RunEnvironment } from './run.js';
import { STORAGE_KEYS, createStorage } from './storage.js';
import type { Storage } from './storage.js';

const summary = (score: number, timeMs = 90_000): DaySummary => ({
  served: 20,
  hinted: 2,
  walked: 0,
  refused: 0,
  unplaced: 0,
  wrongTaps: 1,
  score,
  timeMs,
  slotOutcomes: { c0r0: 'perfect' },
});

let storage: Storage;
let clock: string;

const env = (): RunEnvironment => ({ now: () => new Date(clock), storage });

beforeEach(() => {
  storage = createStorage(null);
  clock = '2026-09-14T12:00:00Z';
});

describe('startDailyRun', () => {
  it('describes today: the Daily profile, seeded from the UTC date', () => {
    const run = startDailyRun(env());
    expect(run).toEqual({
      mode: 'daily',
      profile: DAILY_PROFILE,
      seed: dailySeed('2026-09-14'),
      date: '2026-09-14',
      isPractice: false,
    });
  });

  it('takes the date the run starts, not the one it might finish on', () => {
    clock = '2026-09-14T23:59:30Z';
    const run = startDailyRun(env());
    // The clock rolls over mid-day; the run still belongs to the 14th.
    clock = '2026-09-15T00:00:30Z';
    expect(run.date).toBe('2026-09-14');
    expect(finishDailyRun(env(), run, summary(1000), ['📦']).date).toBe('2026-09-14');
    expect(Object.keys(readRecords(storage))).toEqual(['2026-09-14']);
  });

  it('knows before the day starts that it will be practice', () => {
    finishDailyRun(env(), startDailyRun(env()), summary(1200), ['📦']);
    expect(startDailyRun(env()).isPractice).toBe(true);
  });

  it('gives every player the same day and every day a different one', () => {
    const today = startDailyRun(env());
    clock = '2026-09-15T04:00:00Z';
    const tomorrow = startDailyRun(env());
    expect(startDailyRun({ now: () => new Date('2026-09-14T23:00:00Z'), storage }).seed).toBe(
      today.seed,
    );
    expect(tomorrow.seed).not.toBe(today.seed);
  });
});

describe('finishDailyRun', () => {
  it('stores the first run of a date as its result', () => {
    const result = finishDailyRun(env(), startDailyRun(env()), summary(1240, 107_000), ['📦', '🟧']);

    expect(result.isPractice).toBe(false);
    expect(result.officialScore).toBeNull();
    expect(result.summary.score).toBe(1240);
    expect(result.grid).toEqual(['📦', '🟧']);
    expect(result.date).toBe('2026-09-14');
    expect(readRecords(storage)['2026-09-14']).toEqual({
      result: { score: 1240, timeMs: 107_000, grid: ['📦', '🟧'] },
      practices: 0,
    });
  });

  it('leaves the stored result alone on a practice run and counts it', () => {
    finishDailyRun(env(), startDailyRun(env()), summary(1240), ['📦']);
    const practice = finishDailyRun(env(), startDailyRun(env()), summary(9999), ['🟥']);

    expect(practice.isPractice).toBe(true);
    expect(practice.officialScore).toBe(1240);
    expect(practice.summary.score).toBe(9999);
    expect(readRecords(storage)['2026-09-14']?.result?.score).toBe(1240);
    expect(readRecords(storage)['2026-09-14']?.practices).toBe(1);

    finishDailyRun(env(), startDailyRun(env()), summary(5), ['🟥']);
    expect(readRecords(storage)['2026-09-14']?.result?.score).toBe(1240);
    expect(readRecords(storage)['2026-09-14']?.practices).toBe(2);
  });

  it('reports the daily number, the streak and the best', () => {
    finishDailyRun(env(), startDailyRun(env()), summary(1000), ['📦']);
    clock = '2026-09-15T09:00:00Z';
    const second = finishDailyRun(env(), startDailyRun(env()), summary(1800), ['📦']);

    expect(second.streak).toBe(2);
    expect(second.best).toBe(1800);
    expect(second.dailyNumber).toBeGreaterThan(0);
    expect(readBest(storage)).toBe(1800);
  });

  it('does not let a practice run raise the best score', () => {
    finishDailyRun(env(), startDailyRun(env()), summary(1000), ['📦']);
    finishDailyRun(env(), startDailyRun(env()), summary(9999), ['📦']);
    expect(readBest(storage)).toBe(1000);
  });

  it('writes the records under one storage key', () => {
    finishDailyRun(env(), startDailyRun(env()), summary(1000), ['📦']);
    expect(storage.get<Record<string, unknown>>(STORAGE_KEYS.daily)).toHaveProperty('2026-09-14');
  });
});

describe('currentStreak', () => {
  it('is zero before the first game and follows the clock afterwards', () => {
    expect(currentStreak(env())).toBe(0);
    finishDailyRun(env(), startDailyRun(env()), summary(1000), ['📦']);
    expect(currentStreak(env())).toBe(1);

    clock = '2026-09-15T09:00:00Z';
    expect(currentStreak(env())).toBe(1); // yesterday still counts
    clock = '2026-09-17T09:00:00Z';
    expect(currentStreak(env())).toBe(0); // ... two days later it does not
  });
});
