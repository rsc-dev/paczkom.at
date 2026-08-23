/**
 * Scoring rules (design D6). Points are plain arithmetic on day statistics so
 * the Week change can layer reputation on top without touching the reducer.
 */

export const BASE_SERVICE_POINTS = 100;

export const PENALTY = {
  /** A tap that was not the customer's door. */
  wrongTap: 25,
  /** A sender who walked without being given a slot. */
  refusedSender: 100,
  /** A pickup customer who walked; their parcel stays in the wall. */
  walkedPickup: 50,
  /** A parcel still on the van when LOAD ended. */
  unplacedParcel: 50,
} as const;

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/**
 * `round(100 × m)` with `m = 1 + clamp((P − w) / P, 0, 1)`: 200 points for an
 * instant service, decaying linearly to 100 at the patience limit.
 */
export function servicePoints(waitedMs: number, patienceMs: number): number {
  const ratio = patienceMs <= 0 ? 0 : (patienceMs - waitedMs) / patienceMs;
  return Math.round(BASE_SERVICE_POINTS * (1 + clamp01(ratio)));
}

/** The running score never drops below zero. */
export function applyPoints(score: number, delta: number): number {
  return Math.max(0, score + delta);
}
