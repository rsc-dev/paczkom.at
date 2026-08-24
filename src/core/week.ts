/**
 * The Week run: a thin bookkeeper wrapped around six ordinary days.
 *
 * Nothing here reaches into the day reducer. Each day is a plain
 * `initialState(daySeed, profile)`; this module reads the SUMMARY that comes
 * out, spends stars, and decides whether there is a tomorrow. Keeping the two
 * apart is what lets the Daily code path and the scripted-day fixtures stay
 * exactly as they were.
 */
import type { DaySummary } from './game.js';
import { WEEK_PROFILES } from './profiles.js';
import type { DayProfile } from './profiles.js';
import { fnv1a } from './rng.js';

export const STARTING_STARS = 3;

export const WEEK_LENGTH = WEEK_PROFILES.length;

export type WeekStatus = 'playing' | 'failed' | 'done';

/** The three things that cost a star, counted for one day. */
export interface Incidents {
  readonly unplaced: number;
  readonly refused: number;
  readonly walked: number;
}

export interface DayResult {
  readonly dayIndex: number;
  readonly score: number;
  readonly timeMs: number;
  /** Stars left *after* this day. */
  readonly stars: number;
  readonly starsLost: number;
  readonly incidents: Incidents;
  readonly grid: readonly string[];
}

export interface WeekState {
  readonly seed: number;
  /** 0 = Monday. The day about to be played, or the last one played once over. */
  readonly dayIndex: number;
  readonly stars: number;
  readonly days: readonly DayResult[];
  readonly status: WeekStatus;
}

/** Each day gets its own seed, derived from the week's, so days differ. */
export function daySeed(seed: number, dayIndex: number): number {
  return fnv1a(`${String(seed)}:${String(dayIndex)}`);
}

export function weekProfile(dayIndex: number): DayProfile {
  const profile = WEEK_PROFILES[dayIndex];
  if (profile === undefined) {
    throw new RangeError(`no profile for day ${String(dayIndex)}`);
  }
  return profile;
}

export function startWeek(seed: number): WeekState {
  return { seed, dayIndex: 0, stars: STARTING_STARS, days: [], status: 'playing' };
}

export function incidentsOf(summary: DaySummary): Incidents {
  return { unplaced: summary.unplaced, refused: summary.refused, walked: summary.walked };
}

/** One star per parcel left on the van, per sender turned away, per walker. */
export function starsLostTo(incidents: Incidents): number {
  return incidents.unplaced + incidents.refused + incidents.walked;
}

/**
 * Files a finished day and works out whether the week goes on. Stars never come
 * back, so a bad Monday is carried all the way to Saturday.
 */
export function recordDay(
  week: WeekState,
  summary: DaySummary,
  grid: readonly string[],
): WeekState {
  if (week.status !== 'playing') {
    return week;
  }
  const incidents = incidentsOf(summary);
  const starsLost = Math.min(week.stars, starsLostTo(incidents));
  const stars = week.stars - starsLost;

  const day: DayResult = {
    dayIndex: week.dayIndex,
    score: summary.score,
    timeMs: summary.timeMs,
    stars,
    starsLost,
    incidents,
    grid,
  };

  const days = [...week.days, day];
  if (stars === 0) {
    return { ...week, stars, days, status: 'failed' };
  }
  if (week.dayIndex + 1 >= WEEK_LENGTH) {
    return { ...week, stars, days, status: 'done' };
  }
  return { ...week, stars, days, dayIndex: week.dayIndex + 1, status: 'playing' };
}

export function totalScore(week: WeekState): number {
  return week.days.reduce((sum, day) => sum + day.score, 0);
}

export function totalTimeMs(week: WeekState): number {
  return week.days.reduce((sum, day) => sum + day.timeMs, 0);
}

/** The day the run reached, 1-based, for the Reklamacja screen. */
export function dayReached(week: WeekState): number {
  return week.days.length;
}

// ---------------------------------------------------------------------------
// Seeds in links
// ---------------------------------------------------------------------------

/** Base 36 keeps a shareable seed down to six or seven characters. */
export function encodeSeed(seed: number): string {
  return (seed >>> 0).toString(36);
}

/**
 * Case is not part of a seed. Messengers and phone keyboards capitalise the
 * first letter of a pasted link, and `?week=K3j9x` must still be that week.
 */
export function decodeSeed(text: string): number | null {
  const normalised = text.toLowerCase();
  if (!/^[0-9a-z]{1,7}$/.test(normalised)) {
    return null;
  }
  const value = Number.parseInt(normalised, 36);
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
}

/** A week seed from an arbitrary string, for `?week=` values we did not write. */
export function seedFromText(text: string): number {
  return decodeSeed(text) ?? fnv1a(text);
}
