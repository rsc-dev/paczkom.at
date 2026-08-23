import { beforeEach, describe, expect, it } from 'vitest';
import { dailySeed } from './core/daily.js';
import type { DaySummary } from './core/game.js';
import { DAILY_PROFILE } from './core/profiles.js';
import { daySeed } from './core/week.js';
import {
  continueWeekRun,
  currentStreak,
  finishDailyRun,
  finishWeekDay,
  readBest,
  readRecords,
  readWeekBest,
  startDailyRun,
  startWeekRun,
} from './run.js';
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

describe('week runs', () => {
  const weekSummary = (overrides: Partial<DaySummary> = {}): DaySummary => ({
    ...summary(1000),
    served: 10,
    ...overrides,
  });

  it('starts on Monday with the Monday profile and its own day seed', () => {
    const run = startWeekRun(42);
    expect(run.mode).toBe('week');
    expect(run.profile.id).toBe('mon');
    expect(run.week.dayIndex).toBe(0);
    expect(run.week.stars).toBe(3);
    expect(run.seed).toBe(daySeed(42, 0));
  });

  it('walks to the next day, and its profile, when a day is filed', () => {
    const monday = startWeekRun(42);
    const outcome = finishWeekDay(env(), monday, weekSummary({ score: 900 }), ['📦']);
    expect(outcome.week.status).toBe('playing');
    expect(outcome.day.dayIndex).toBe(0);
    expect(outcome.total).toBe(900);

    const tuesday = continueWeekRun(outcome.week);
    expect(tuesday.profile.id).toBe('tue');
    expect(tuesday.seed).toBe(daySeed(42, 1));
  });

  it('records a completed week as the new best', () => {
    let run = startWeekRun(42);
    let outcome = finishWeekDay(env(), run, weekSummary({ score: 100 }), ['📦']);
    for (let i = 1; i < 6; i += 1) {
      run = continueWeekRun(outcome.week);
      outcome = finishWeekDay(env(), run, weekSummary({ score: 100 }), ['📦']);
    }
    expect(outcome.week.status).toBe('done');
    expect(outcome.total).toBe(600);
    expect(outcome.isBest).toBe(true);
    expect(readWeekBest(storage)).toBe(600);
  });

  it('does not beat a higher stored best', () => {
    storage.set(STORAGE_KEYS.weekBest, 5_000);
    let run = startWeekRun(42);
    let outcome = finishWeekDay(env(), run, weekSummary({ score: 100 }), ['📦']);
    for (let i = 1; i < 6; i += 1) {
      run = continueWeekRun(outcome.week);
      outcome = finishWeekDay(env(), run, weekSummary({ score: 100 }), ['📦']);
    }
    expect(outcome.isBest).toBe(false);
    expect(readWeekBest(storage)).toBe(5_000);
  });

  it('never records a week that ran out of stars', () => {
    const run = startWeekRun(42);
    const outcome = finishWeekDay(env(), run, weekSummary({ score: 9_999, walked: 3 }), ['🟥']);
    expect(outcome.week.status).toBe('failed');
    expect(outcome.isBest).toBe(false);
    expect(readWeekBest(storage)).toBe(0);
  });

  it('spends stars on the incidents of the day just played', () => {
    const run = startWeekRun(42);
    const outcome = finishWeekDay(env(), run, weekSummary({ refused: 1, unplaced: 1 }), ['📦']);
    expect(outcome.day.starsLost).toBe(2);
    expect(outcome.week.stars).toBe(1);
    expect(outcome.day.incidents).toEqual({ unplaced: 1, refused: 1, walked: 0 });
  });

  it('leaves the Daily storage untouched', () => {
    const run = startWeekRun(42);
    finishWeekDay(env(), run, weekSummary(), ['📦']);
    expect(readRecords(storage)).toEqual({});
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
