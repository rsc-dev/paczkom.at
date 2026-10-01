import { pmLevel, worseLevel } from './levels.js';
import type { Level } from './levels.js';
import type { CitizenReading, GiosIndex } from './readings.js';

export type Source = 'gios' | 'citizen' | 'none';

export interface TownHour {
  readonly level: Level | null;
  readonly pm25: number | null;
  readonly pm10: number | null;
  readonly source: Source;
  readonly sensorCount: number;
  readonly lowConfidence: boolean;
}

const MINUTE_MS = 60_000;
export const MAX_READING_AGE_MS = 120 * MINUTE_MS;
export const MAX_GIOS_AGE_MS = 180 * MINUTE_MS;
/** Clock skew we tolerate before calling a reading "from the future". */
const FUTURE_SLACK_MS = 5 * MINUTE_MS;
const MAX_PM = 1000;
export const MIN_SENSORS = 3;
export const HUMID_PERCENT = 80;

export function usableReading(r: CitizenReading, nowMs: number): boolean {
  if (r.indoor || r.pm25 === null || r.pm10 === null) {
    return false;
  }
  if (r.at < nowMs - MAX_READING_AGE_MS || r.at > nowMs + FUTURE_SLACK_MS) {
    return false;
  }
  const inRange = (v: number): boolean => v > 0 && v <= MAX_PM;
  return inRange(r.pm25) && inRange(r.pm10) && r.pm25 <= r.pm10 + 5;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? null) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const oneDecimal = (value: number | null): number | null => (value === null ? null : Math.round(value * 10) / 10);

export function gradeTown(gios: readonly GiosIndex[], citizen: readonly CitizenReading[], nowMs: number): TownHour {
  const usable = citizen.filter((r) => usableReading(r, nowMs));
  const pm25 = oneDecimal(median(usable.map((r) => r.pm25 ?? 0)));
  const pm10 = oneDecimal(median(usable.map((r) => r.pm10 ?? 0)));

  const official = gios
    .filter((g) => g.level !== null && g.at >= nowMs - MAX_GIOS_AGE_MS)
    .reduce<Level | null>((worst, g) => (worst === null ? g.level : worseLevel(worst, g.level ?? worst)), null);
  if (official !== null) {
    return { level: official, pm25, pm10, source: 'gios', sensorCount: usable.length, lowConfidence: false };
  }

  if (usable.length === 0) {
    return { level: null, pm25: null, pm10: null, source: 'none', sensorCount: 0, lowConfidence: false };
  }
  const humidity = median(usable.flatMap((r) => (r.humidity === null ? [] : [r.humidity])));
  return {
    level: pmLevel(pm25, pm10),
    pm25,
    pm10,
    source: 'citizen',
    sensorCount: usable.length,
    lowConfidence: usable.length < MIN_SENSORS || (humidity !== null && humidity > HUMID_PERCENT),
  };
}
