/**
 * Day profiles are pure data: the Week change adds rows here rather than new
 * code paths in the reducer.
 */
import type { Size } from './wall.js';

export interface DayProfile {
  readonly id: string;
  /** Columns in the wall; each column is always A A A A B B C. */
  readonly columns: number;
  /** Pickup parcels loaded during LOAD, one customer each during SERVE. */
  readonly pickups: number;
  /** Sender customers arriving during SERVE. */
  readonly senders: number;
  /** Pairs of codes that differ by a single adjacent transposition. */
  readonly lookalikePairs: number;
  readonly loadMs: number;
  readonly serveMs: number;
  /** How long a *visible* customer waits before walking. */
  readonly patienceMs: number;
  /** How many customers are visible (and draining patience) at once. */
  readonly visibleCustomers: number;
  /**
   * Arrivals are spread over this window from the start of SERVE. Invariant for
   * every profile: `arrivalWindowMs + patienceMs <= serveMs`, so no customer
   * walks purely because SERVE ended before their patience did.
   */
  readonly arrivalWindowMs: number;
  /** How long a door stays `open` after a correct pickup. */
  readonly doorMs: number;
  /** Time active without a tap before hint level 1 / 2. */
  readonly hintDelay1Ms: number;
  readonly hintDelay2Ms: number;
  readonly parcelSizeWeights: Readonly<Record<Size, number>>;
  readonly senderSizeWeights: Readonly<Record<Size, number>>;
  /** In-fiction clock the HUD maps SERVE onto. */
  readonly dayStartHour: number;
  readonly dayEndHour: number;
}

/** The profile Daily mode uses in this change (design D5). */
export const DAILY_PROFILE: DayProfile = {
  id: 'daily',
  columns: 3,
  pickups: 16,
  senders: 4,
  lookalikePairs: 2,
  loadMs: 25_000,
  serveMs: 65_000,
  patienceMs: 20_000,
  visibleCustomers: 3,
  // 45 + 20 = 65: the last possible arrival still gets their full patience.
  arrivalWindowMs: 45_000,
  doorMs: 220,
  hintDelay1Ms: 6_000,
  hintDelay2Ms: 12_000,
  parcelSizeWeights: { A: 5, B: 3, C: 2 },
  // Senders never ask for C: a C slot may well be occupied all day and an
  // unservable customer is a penalty the player cannot avoid.
  senderSizeWeights: { A: 7, B: 3, C: 0 },
  dayStartHour: 8,
  dayEndHour: 20,
};
