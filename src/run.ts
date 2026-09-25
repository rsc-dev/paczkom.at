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
import {
  daySeed,
  parseWeekState,
  recordDay,
  startWeek,
  totalScore,
  weekProfile,
} from './core/week.js';
import type { DayResult, WeekState } from './core/week.js';
import { STORAGE_KEYS } from './storage.js';
import type { Storage } from './storage.js';
import type { ResultModel } from './ui/screens.js';

export interface DailyRun {
  readonly mode: 'daily';
  readonly profile: DayProfile;
  readonly seed: number;
  /** The UTC date this run belongs to, fixed when it started. */
  readonly date: string;
  /** True when that date already had a result before this run began. */
  readonly isPractice: boolean;
}

export interface WeekRun {
  readonly mode: 'week';
  readonly profile: DayProfile;
  /** The seed of *this day*, derived from the week's. */
  readonly seed: number;
  /** The week the day belongs to, carried across days. */
  readonly week: WeekState;
}

export type DayRun = DailyRun | WeekRun;

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

export function startDailyRun(env: RunEnvironment): DailyRun {
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
  run: DailyRun,
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

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------

/**
 * The Week run in progress, or `null` when there is nothing to resume. A stored
 * value the rules cannot account for is not a run: it is forgotten on the spot.
 */
export function readSavedWeek(storage: Storage): WeekState | null {
  const raw = storage.get<unknown>(STORAGE_KEYS.weekRun);
  if (raw === undefined) {
    return null;
  }
  const week = parseWeekState(raw);
  if (week === null) {
    storage.remove(STORAGE_KEYS.weekRun);
  }
  return week;
}

/** Kept while the week is playing, gone the moment it is over. */
function saveWeek(storage: Storage, week: WeekState): void {
  if (week.status === 'playing') {
    storage.set(STORAGE_KEYS.weekRun, week);
  } else {
    storage.remove(STORAGE_KEYS.weekRun);
  }
}

/**
 * Monday of a fresh week. Saved from the first second, so a reload during
 * Monday keeps the seed — and so whatever week was saved before is replaced,
 * which is what starting a new week or retrying means.
 */
export function startWeekRun(env: RunEnvironment, seed: number): WeekRun {
  const week = startWeek(seed);
  saveWeek(env.storage, week);
  return {
    mode: 'week',
    week,
    profile: weekProfile(week.dayIndex),
    seed: daySeed(week.seed, week.dayIndex),
  };
}

/** The next day of a week already under way. */
export function continueWeekRun(week: WeekState): WeekRun {
  return {
    mode: 'week',
    week,
    profile: weekProfile(week.dayIndex),
    seed: daySeed(week.seed, week.dayIndex),
  };
}

export function readWeekBest(storage: Storage): number {
  return storage.get<number>(STORAGE_KEYS.weekBest) ?? 0;
}

export interface WeekOutcome {
  readonly week: WeekState;
  /** The day just played, for the day-summary screen. */
  readonly day: DayResult;
  readonly total: number;
  readonly best: number;
  /** True when this run beat the stored best; only a completed week can. */
  readonly isBest: boolean;
}

/**
 * Files a finished Week day: spends the stars it cost, saves the run if there is
 * a tomorrow, and — if that was Saturday — records the total as the new best if
 * it beats the stored one. A week that ran out of stars is not a week you
 * finished, so it cannot set a record; and a week that is over, either way, is
 * no longer saved.
 */
export function finishWeekDay(
  env: RunEnvironment,
  run: WeekRun,
  summary: DaySummary,
  grid: readonly string[],
): WeekOutcome {
  const week = recordDay(run.week, summary, grid);
  saveWeek(env.storage, week);
  const day = week.days.at(-1);
  if (day === undefined) {
    throw new Error('a finished week day produced no result');
  }

  const total = totalScore(week);
  const storedBest = readWeekBest(env.storage);
  const isBest = week.status === 'done' && total > storedBest;
  if (isBest) {
    env.storage.set(STORAGE_KEYS.weekBest, total);
  }

  return { week, day, total, best: Math.max(storedBest, isBest ? total : 0), isBest };
}
