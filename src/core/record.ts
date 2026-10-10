import type { Mode } from './game.js';

export interface Records {
  readonly A: number;
  readonly B: number;
}

export const EMPTY_RECORDS: Records = { A: 0, B: 0 };

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Whatever storage hands back; anything odd counts as no record. */
export function recordsFrom(value: unknown): Records {
  if (typeof value !== 'object' || value === null) {
    return EMPTY_RECORDS;
  }
  const v = value as Record<string, unknown>;
  return { A: isCount(v['A']) ? v['A'] : 0, B: isCount(v['B']) ? v['B'] : 0 };
}

export function withScore(records: Records, mode: Mode, score: number): { records: Records; isNew: boolean } {
  if (score <= records[mode]) {
    return { records, isNew: false };
  }
  return { records: { ...records, [mode]: score }, isNew: true };
}
