/**
 * Deterministic random numbers with an explicit, serialisable state.
 *
 * Every helper takes the current state and returns `[value, nextState]` so the
 * reducer can stay pure: the RNG state lives inside the game state and a day is
 * fully reproducible from `seed + action log`.
 */

/** An unsigned 32-bit integer. */
export type RngState = number;

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/** FNV-1a 32-bit hash of a string, used to turn a date into a seed. */
export function fnv1a(input: string): RngState {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** mulberry32: one step of the generator. Returns a value in `[0, 1)`. */
export function next(state: RngState): [number, RngState] {
  const advanced = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(advanced ^ (advanced >>> 15), 1 | advanced);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, advanced >>> 0];
}

/** An integer in `[0, maxExclusive)`. */
export function nextInt(state: RngState, maxExclusive: number): [number, RngState] {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`nextInt bound must be a positive integer, got ${String(maxExclusive)}`);
  }
  const [value, nextState] = next(state);
  return [Math.floor(value * maxExclusive), nextState];
}

/** One element of a non-empty list. */
export function pick<T>(state: RngState, items: readonly T[]): [T, RngState] {
  if (items.length === 0) {
    throw new RangeError('pick requires a non-empty list');
  }
  const [index, nextState] = nextInt(state, items.length);
  const value = items[index];
  if (value === undefined) {
    throw new RangeError(`pick produced an out-of-range index ${String(index)}`);
  }
  return [value, nextState];
}

/** A Fisher–Yates shuffle that leaves the input untouched. */
export function shuffle<T>(state: RngState, items: readonly T[]): [T[], RngState] {
  const result = [...items];
  let current = state;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const [j, nextState] = nextInt(current, i + 1);
    current = nextState;
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) {
      throw new RangeError('shuffle index out of range');
    }
    result[i] = b;
    result[j] = a;
  }
  return [result, current];
}

/**
 * One key of a weight map, chosen proportionally to its weight. Keys are sorted
 * before the walk, so the order they happen to be written in a profile literal
 * cannot change which key a given roll lands on.
 */
export function weightedPick<K extends string>(
  state: RngState,
  weights: Readonly<Record<K, number>>,
): [K, RngState] {
  const entries = (Object.entries(weights) as [K, number][]).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  if (total <= 0) {
    throw new RangeError('weightedPick requires at least one positive weight');
  }
  const [roll, nextState] = next(state);
  let threshold = roll * total;
  for (const [key, weight] of entries) {
    threshold -= Math.max(0, weight);
    if (threshold < 0) {
      return [key, nextState];
    }
  }
  const last = entries.filter(([, weight]) => weight > 0).at(-1);
  if (last === undefined) {
    throw new RangeError('weightedPick requires at least one positive weight');
  }
  return [last[0], nextState];
}
