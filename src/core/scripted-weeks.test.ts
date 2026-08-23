import { describe, expect, it } from 'vitest';
import { decodeLog } from './actionLog.js';
import { SCRIPTED_WEEKS } from './fixtures/scripted-weeks.js';
import type { ScriptedWeek } from './fixtures/scripted-weeks.js';
import { initialState, reduce } from './game.js';
import { daySeed, recordDay, startWeek, totalScore, weekProfile } from './week.js';
import type { WeekState } from './week.js';

/** Replays a whole week from its per-day action logs. */
function replay(week: ScriptedWeek): WeekState {
  let run = startWeek(week.seed);
  for (const log of week.logs) {
    const profile = weekProfile(run.dayIndex);
    const state = decodeLog(log).reduce(
      reduce,
      initialState(daySeed(week.seed, run.dayIndex), profile),
    );
    if (state.summary === null) {
      throw new Error(`day ${String(run.dayIndex)} did not reach SUMMARY`);
    }
    run = recordDay(run, state.summary, []);
  }
  return run;
}

describe.each(SCRIPTED_WEEKS)('scripted week: $name', (week) => {
  it('replays to the recorded run', () => {
    const run = replay(week);
    expect(run.status).toBe(week.expected.status);
    expect(run.stars).toBe(week.expected.stars);
    expect(totalScore(run)).toBe(week.expected.total);
  });

  it('spends its stars day by day exactly as recorded', () => {
    const run = replay(week);
    expect(
      run.days.map((day) => ({
        dayIndex: day.dayIndex,
        score: day.score,
        timeMs: day.timeMs,
        stars: day.stars,
        starsLost: day.starsLost,
        incidents: day.incidents,
      })),
    ).toEqual(week.expected.days);
  });

  it('replays to the same run every time', () => {
    expect(replay(week)).toEqual(replay(week));
  });

  it('never lets a star come back', () => {
    const run = replay(week);
    const stars = run.days.map((day) => day.stars);
    expect([...stars].sort((a, b) => b - a)).toEqual(stars);
  });
});

describe('scripted week coverage', () => {
  const byName = (name: string) => SCRIPTED_WEEKS.find((week) => week.name === name);

  it('has a week that goes the distance and one that does not', () => {
    expect(SCRIPTED_WEEKS).toHaveLength(2);
  });

  it('covers a week played to Saturday', () => {
    const clean = byName('a clean week');
    expect(clean?.expected.status).toBe('done');
    expect(clean?.expected.days).toHaveLength(6);
    expect(clean?.logs).toHaveLength(6);
    expect(clean?.expected.total).toBeGreaterThan(0);
  });

  it('covers a week that runs out of stars, and stops the day it does', () => {
    const failed = byName('a week that runs out of stars on Friday');
    expect(failed?.expected.status).toBe('failed');
    expect(failed?.expected.stars).toBe(0);
    // Friday is day index 4, so five days were played and Saturday never was.
    expect(failed?.expected.days).toHaveLength(5);
    expect(failed?.expected.days.at(-1)?.dayIndex).toBe(4);
    expect(failed?.logs).toHaveLength(5);
  });
});
