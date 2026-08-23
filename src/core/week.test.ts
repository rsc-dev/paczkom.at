import { describe, expect, it } from 'vitest';
import type { DaySummary } from './game.js';
import { initialState } from './game.js';
import { SATURDAY, WEEK_PROFILES } from './profiles.js';
import {
  STARTING_STARS,
  WEEK_LENGTH,
  dayReached,
  daySeed,
  decodeSeed,
  encodeSeed,
  recordDay,
  seedFromText,
  startWeek,
  starsLostTo,
  totalScore,
  weekProfile,
} from './week.js';
import type { WeekState } from './week.js';

const summary = (overrides: Partial<DaySummary> = {}): DaySummary => ({
  served: 10,
  hinted: 0,
  walked: 0,
  refused: 0,
  unplaced: 0,
  wrongTaps: 0,
  score: 1000,
  timeMs: 90_000,
  slotOutcomes: {},
  ...overrides,
});

const play = (week: WeekState, ...days: Partial<DaySummary>[]): WeekState =>
  days.reduce((state, day) => recordDay(state, summary(day), ['📦']), week);

describe('day seeds', () => {
  it('are the same every time and different every day', () => {
    const seeds = Array.from({ length: WEEK_LENGTH }, (_unused, i) => daySeed(42, i));
    expect(seeds).toEqual(Array.from({ length: WEEK_LENGTH }, (_unused, i) => daySeed(42, i)));
    expect(new Set(seeds).size).toBe(WEEK_LENGTH);
  });

  it('differ between weeks', () => {
    expect(daySeed(42, 0)).not.toBe(daySeed(43, 0));
  });

  it('give each day the day it is meant to have', () => {
    expect(WEEK_PROFILES.map((_unused, i) => weekProfile(i).id)).toEqual([
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
    ]);
    expect(() => weekProfile(6)).toThrow();
  });

  it('build a real Saturday when asked', () => {
    const state = initialState(daySeed(42, 5), weekProfile(5));
    expect(state.slots).toHaveLength(35);
    expect(state.loadQueue).toHaveLength(SATURDAY.pickups);
    expect(state.maskedDigit).not.toBeNull();
  });
});

describe('stars', () => {
  it('start at three', () => {
    expect(startWeek(1).stars).toBe(STARTING_STARS);
    expect(startWeek(1).status).toBe('playing');
    expect(startWeek(1).days).toEqual([]);
  });

  it('cost one per parcel left, sender turned away and walker', () => {
    expect(starsLostTo({ unplaced: 1, refused: 1, walked: 1 })).toBe(3);
    expect(starsLostTo({ unplaced: 0, refused: 0, walked: 0 })).toBe(0);
  });

  it('drop to one after a day with a refusal and a walker', () => {
    const week = play(startWeek(1), { refused: 1, walked: 1 });
    expect(week.stars).toBe(1);
    expect(week.days[0]?.starsLost).toBe(2);
    expect(week.status).toBe('playing');
  });

  it('never go below zero', () => {
    const week = play(startWeek(1), { walked: 1 }, { unplaced: 2, refused: 2 });
    expect(week.stars).toBe(0);
    expect(week.days[1]?.starsLost).toBe(2);
  });

  it('never come back', () => {
    const week = play(startWeek(1), { walked: 1 }, {}, {});
    expect(week.stars).toBe(2);
  });

  it('are not spent on a clean day', () => {
    expect(play(startWeek(1), {}).stars).toBe(STARTING_STARS);
  });
});

describe('the run', () => {
  it('walks Monday to Saturday and then is done', () => {
    let week = startWeek(7);
    for (let i = 0; i < WEEK_LENGTH; i += 1) {
      expect(week.status).toBe('playing');
      expect(week.dayIndex).toBe(i);
      week = play(week, {});
    }
    expect(week.status).toBe('done');
    expect(week.days).toHaveLength(WEEK_LENGTH);
    expect(dayReached(week)).toBe(WEEK_LENGTH);
  });

  it('ends the moment the last star goes', () => {
    const week = play(startWeek(7), {}, {}, {}, {}, { walked: 3 });
    expect(week.status).toBe('failed');
    expect(week.stars).toBe(0);
    // Friday is the fifth day.
    expect(dayReached(week)).toBe(5);
    expect(week.days).toHaveLength(5);
  });

  it('files nothing more once it is over', () => {
    const failed = play(startWeek(7), { walked: 3 });
    expect(recordDay(failed, summary(), ['📦'])).toBe(failed);
  });

  it('adds up the days it played', () => {
    const week = play(startWeek(7), { score: 100 }, { score: 250 }, { score: 40 });
    expect(totalScore(week)).toBe(390);
    expect(week.days.map((day) => day.dayIndex)).toEqual([0, 1, 2]);
  });

  it('keeps each day&#39;s grid and incident counts', () => {
    const week = play(startWeek(7), { unplaced: 2, score: 500 });
    expect(week.days[0]).toMatchObject({
      dayIndex: 0,
      score: 500,
      stars: 1,
      starsLost: 2,
      incidents: { unplaced: 2, refused: 0, walked: 0 },
      grid: ['📦'],
    });
  });
});

describe('seeds in links', () => {
  it('round-trip through base 36', () => {
    for (const seed of [0, 1, 42, 12345, 0xffffffff]) {
      expect(decodeSeed(encodeSeed(seed))).toBe(seed);
    }
  });

  it('stay short enough to share', () => {
    expect(encodeSeed(0xffffffff).length).toBeLessThanOrEqual(7);
  });

  it('refuse nonsense', () => {
    for (const text of ['', 'ABC', 'k3j9x!', 'zzzzzzzzzz', '../etc']) {
      expect(decodeSeed(text)).toBeNull();
    }
  });

  it('take any text as a seed when the link was hand-written', () => {
    expect(seedFromText('k3j9x')).toBe(decodeSeed('k3j9x'));
    expect(seedFromText('hello world')).toBe(seedFromText('hello world'));
    expect(seedFromText('hello world')).not.toBe(seedFromText('goodbye'));
  });
});
