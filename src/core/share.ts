/**
 * The share card (design D8): one emoji per slot in wall order, one line per
 * column. Labels are localised by the caller; the grid and the URL are not.
 */
import type { SlotOutcome } from './game.js';
import type { Slot } from './wall.js';

export const SHARE_BRAND = 'paczkom.at';
export const SHARE_URL = 'https://www.paczkom.at';

export const OUTCOME_EMOJI: Readonly<Record<SlotOutcome, string>> = {
  perfect: '📦',
  hinted: '🟧',
  walked: '🟥',
  /** The slot never held a pickup parcel. */
  none: '⬜',
};

export interface ShareLabels {
  /** Localised mode name, e.g. "Dzisiaj" / "Today". */
  readonly mode: string;
  /** Localised points abbreviation, e.g. "pkt" / "pts". */
  readonly points: string;
}

export interface ShareParams {
  readonly labels: ShareLabels;
  readonly number: number;
  readonly grid: readonly string[];
  readonly score: number;
  readonly timeMs: number;
}

/** One string per wall column, slots listed top to bottom. */
export function buildGrid(
  wall: readonly Slot[],
  outcomes: Readonly<Record<string, SlotOutcome>>,
): string[] {
  const columns = new Map<number, Slot[]>();
  for (const slot of wall) {
    const column = columns.get(slot.col) ?? [];
    column.push(slot);
    columns.set(slot.col, column);
  }
  return [...columns.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, slots]) =>
      slots
        .sort((a, b) => a.index - b.index)
        .map((slot) => OUTCOME_EMOJI[outcomes[slot.id] ?? 'none'])
        .join(''),
    );
}

/** `m:ss`, counting past 60 minutes rather than rolling over to hours. */
export function formatTime(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export function buildShareText(params: ShareParams): string {
  return [
    `${SHARE_BRAND} · ${params.labels.mode} #${String(params.number)}`,
    ...params.grid,
    `${String(params.score)} ${params.labels.points} · ${formatTime(params.timeMs)}`,
    SHARE_URL,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------

export const STAR = '⭐';
export const FAILED_DAY = '❌';

export interface WeekShareDay {
  /** Localised abbreviation: Pn, Wt, Śr … */
  readonly label: string;
  readonly score: number;
  /** Stars left after that day. */
  readonly stars: number;
  /** True for the day the run ran out of stars. */
  readonly failed: boolean;
}

export interface WeekShareParams {
  /** Localised mode name, e.g. "Tydzień" / "Week". */
  readonly modeLabel: string;
  /** Localised label for the week's total, e.g. "Razem" / "Total". */
  readonly totalLabel: string;
  /** Localised points abbreviation, e.g. "pkt" / "pts". */
  readonly points: string;
  readonly days: readonly WeekShareDay[];
  /** The seed, already encoded for a URL. */
  readonly seed: string;
}

/** `/?week=<seed>`: the link that replays this exact week. */
export function weekUrl(seed: string): string {
  return `${SHARE_URL}/?week=${seed}`;
}

/**
 * One line per day played (design D6), then the week's total. A failed week
 * simply stops at the day it failed on, with ❌ where the stars would be; its
 * total still counts what that day scored, as the Reklamacja screen does.
 */
export function buildWeekShareText(params: WeekShareParams): string {
  const lines = params.days.map((day) =>
    day.failed
      ? `${day.label} ${FAILED_DAY}`
      : `${day.label} ${STAR.repeat(day.stars)} ${String(day.score)}`,
  );
  const total = params.days.reduce((sum, day) => sum + day.score, 0);
  return [
    `${SHARE_BRAND} · ${params.modeLabel}`,
    ...lines,
    `${params.totalLabel} ${String(total)} ${params.points}`,
    weekUrl(params.seed),
  ].join('\n');
}
