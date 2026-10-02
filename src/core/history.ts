/**
 * The last 48 hours of town levels, carried between hourly runs in the Actions
 * cache. Anything unreadable becomes an empty history: a lost cache costs the
 * "vs yesterday" line for a day, never a run.
 */
import { levelFromGiosIndex } from './levels.js';
import type { Level } from './levels.js';
import { warsawDay, warsawHour } from './time.js';

export interface HistoryEntry {
  readonly at: number;
  readonly levels: Readonly<Record<string, Level | null>>;
}

export interface History {
  readonly version: 1;
  readonly entries: readonly HistoryEntry[];
}

export const EMPTY_HISTORY: History = { version: 1, entries: [] };

const HOUR_MS = 3_600_000;
export const HISTORY_WINDOW_MS = 48 * HOUR_MS;
const YESTERDAY_TOLERANCE_MS = 45 * 60_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Levels are stored 1–6; reuse the GIOŚ guard by shifting back to 0–5. */
const asLevel = (value: unknown): Level | null =>
  typeof value === 'number' ? levelFromGiosIndex(value - 1) : null;

export function parseHistory(value: unknown): History {
  if (!isRecord(value) || value['version'] !== 1 || !Array.isArray(value['entries'])) {
    return EMPTY_HISTORY;
  }
  const entries: HistoryEntry[] = [];
  for (const raw of value['entries'] as unknown[]) {
    if (!isRecord(raw) || typeof raw['at'] !== 'number' || !isRecord(raw['levels'])) {
      continue;
    }
    const levels: Record<string, Level | null> = {};
    for (const [slug, level] of Object.entries(raw['levels'])) {
      levels[slug] = asLevel(level);
    }
    entries.push({ at: raw['at'], levels });
  }
  return { version: 1, entries };
}

const hourKey = (ms: number): number => Math.floor(ms / HOUR_MS);

export function appendHistory(history: History, entry: HistoryEntry): History {
  const cutoff = Math.floor((entry.at - HISTORY_WINDOW_MS) / HOUR_MS) * HOUR_MS;
  const kept = history.entries.filter((e) => e.at >= cutoff && hourKey(e.at) !== hourKey(entry.at));
  return { version: 1, entries: [...kept, entry].sort((a, b) => a.at - b.at) };
}

export function worstToday(
  history: History,
  slug: string,
  nowMs: number,
): { level: Level; hour: string } | null {
  const today = warsawDay(nowMs);
  let worst: { level: Level; at: number } | null = null;
  for (const entry of history.entries) {
    const level = entry.levels[slug] ?? null;
    if (level === null || entry.at > nowMs || warsawDay(entry.at) !== today) {
      continue;
    }
    if (worst === null || level > worst.level) {
      worst = { level, at: entry.at };
    }
  }
  return worst === null ? null : { level: worst.level, hour: warsawHour(worst.at) };
}

export function levelYesterday(history: History, slug: string, nowMs: number): Level | null {
  const target = nowMs - 24 * HOUR_MS;
  let best: { level: Level | null; gap: number } | null = null;
  for (const entry of history.entries) {
    const gap = Math.abs(entry.at - target);
    if (gap <= YESTERDAY_TOLERANCE_MS && (best === null || gap < best.gap)) {
      best = { level: entry.levels[slug] ?? null, gap };
    }
  }
  return best?.level ?? null;
}
