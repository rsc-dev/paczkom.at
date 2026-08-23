/**
 * A run: one day of play, described by a small value that is fixed the moment
 * the day starts and read again when it finishes.
 *
 * Why a descriptor rather than module constants: the UTC date must be the date
 * the run *began* — a player who starts at 23:59 finishes the day they started,
 * not the one that turned over underneath them — and the Week change needs the
 * same shape with `mode: 'week'` and its own finish behaviour.
 *
 * The clock and the storage come in as an environment, so all of this is
 * testable without a browser.
 */
import {
  LAUNCH_EPOCH,
  computeBest,
  computeStreak,
  dailyNumber,
  dailySeed,
  recordRun,
  utcDateString,
} from './core/daily.js';
import type { DailyRecords } from './core/daily.js';
import type { DaySummary } from './core/game.js';
import { DAILY_PROFILE } from './core/profiles.js';
import type { DayProfile } from './core/profiles.js';
import { STORAGE_KEYS } from './storage.js';
import type { Storage } from './storage.js';
import type { ResultModel } from './ui/screens.js';

export interface DayRun {
  /** The Week change adds `'week'` here, with its own finish behaviour. */
  readonly mode: 'daily';
  readonly profile: DayProfile;
  readonly seed: number;
  /** The UTC date this run belongs to, fixed when it started. */
  readonly date: string;
  /** True when that date already had a result before this run began. */
  readonly isPractice: boolean;
}

export interface RunEnvironment {
  readonly now: () => Date;
  readonly storage: Storage;
}

export function readRecords(storage: Storage): DailyRecords {
  return storage.get<DailyRecords>(STORAGE_KEYS.daily) ?? {};
}

export function readBest(storage: Storage): number {
  return Math.max(storage.get<number>(STORAGE_KEYS.best) ?? 0, computeBest(readRecords(storage)));
}

/** The streak as of right now, for the title screen. */
export function currentStreak(env: RunEnvironment): number {
  return computeStreak(readRecords(env.storage), utcDateString(env.now()));
}

export function startDailyRun(env: RunEnvironment): DayRun {
  const date = utcDateString(env.now());
  return {
    mode: 'daily',
    profile: DAILY_PROFILE,
    seed: dailySeed(date),
    date,
    isPractice: readRecords(env.storage)[date]?.result !== undefined,
  };
}

/**
 * Files the finished run and returns what the result screen should show. The
 * first completed run of a date becomes its result; every later one is practice
 * and only bumps the counter.
 */
export function finishDailyRun(
  env: RunEnvironment,
  run: DayRun,
  summary: DaySummary,
  grid: readonly string[],
): ResultModel {
  const before = readRecords(env.storage);
  const officialScore = before[run.date]?.result?.score ?? null;

  const { records } = recordRun(before, run.date, {
    score: summary.score,
    timeMs: summary.timeMs,
    grid,
  });
  env.storage.set(STORAGE_KEYS.daily, records);
  env.storage.set(
    STORAGE_KEYS.best,
    Math.max(env.storage.get<number>(STORAGE_KEYS.best) ?? 0, computeBest(records)),
  );

  return {
    dailyNumber: dailyNumber(run.date, LAUNCH_EPOCH),
    date: run.date,
    summary,
    grid,
    streak: computeStreak(records, run.date),
    best: readBest(env.storage),
    isPractice: run.isPractice,
    officialScore: run.isPractice ? officialScore : null,
  };
}
