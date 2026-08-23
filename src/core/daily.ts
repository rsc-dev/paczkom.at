/**
 * Daily mode: one seeded day per UTC date, identical for every player.
 *
 * Everything here is a pure function of a date string and the stored records,
 * so the clock is the caller's problem and the rules stay testable.
 */
import { fnv1a } from './rng.js';

/** Day #1. Set to the real launch date before the first deploy (task 8.4). */
export const LAUNCH_EPOCH = '2026-09-01';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export interface DailyResult {
  readonly score: number;
  readonly timeMs: number;
  /** The share grid, one string per wall column. */
  readonly grid: readonly string[];
}

export interface DailyRecord {
  /** The first completed run of that date; practice never overwrites it. */
  readonly result?: DailyResult;
  readonly practices: number;
}

export type DailyRecords = Readonly<Record<string, DailyRecord>>;

function toUtcMs(dateStr: string): number {
  if (!DATE_PATTERN.test(dateStr)) {
    throw new RangeError(`expected a YYYY-MM-DD date, got "${dateStr}"`);
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`expected a YYYY-MM-DD date, got "${dateStr}"`);
  }
  const ms = Date.UTC(year, month - 1, day);
  if (Number.isNaN(ms)) {
    throw new RangeError(`"${dateStr}" is not a real date`);
  }
  // Date.UTC happily rolls 2026-13-01 over into 2027-01-01; reject that.
  const roundTrip = utcDateString(new Date(ms));
  if (roundTrip !== dateStr) {
    throw new RangeError(`"${dateStr}" is not a real date`);
  }
  return ms;
}

/** `YYYY-MM-DD` in UTC. The caller supplies the clock. */
export function utcDateString(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The seed every player on that UTC date shares. */
export function dailySeed(dateStr: string): number {
  toUtcMs(dateStr);
  return fnv1a(dateStr);
}

export function addDays(dateStr: string, delta: number): string {
  return utcDateString(new Date(toUtcMs(dateStr) + delta * MS_PER_DAY));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** `#N` as shown on the result screen and in the share card. */
export function dailyNumber(dateStr: string, epoch: string = LAUNCH_EPOCH): number {
  return Math.max(1, daysBetween(epoch, dateStr) + 1);
}

const hasResult = (records: DailyRecords, dateStr: string): boolean =>
  records[dateStr]?.result !== undefined;

/**
 * Files a completed run. The first run of a date becomes its result; every run
 * after that is practice and only bumps the counter.
 */
export function recordRun(
  records: DailyRecords,
  dateStr: string,
  result: DailyResult,
): { records: DailyRecords; isPractice: boolean } {
  const existing = records[dateStr];
  if (existing?.result !== undefined) {
    return {
      records: { ...records, [dateStr]: { ...existing, practices: existing.practices + 1 } },
      isPractice: true,
    };
  }
  return {
    records: { ...records, [dateStr]: { result, practices: existing?.practices ?? 0 } },
    isPractice: false,
  };
}

/** Consecutive UTC dates with a result, ending today or yesterday. */
export function computeStreak(records: DailyRecords, todayStr: string): number {
  const yesterday = addDays(todayStr, -1);
  let cursor = hasResult(records, todayStr)
    ? todayStr
    : hasResult(records, yesterday)
      ? yesterday
      : null;
  let streak = 0;
  while (cursor !== null && hasResult(records, cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** The highest score across stored results; practice runs do not count. */
export function computeBest(records: DailyRecords): number {
  return Object.values(records).reduce((best, record) => Math.max(best, record.result?.score ?? 0), 0);
}
