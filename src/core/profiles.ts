/**
 * Day profiles are pure data. The whole difficulty arc of a week — wall size,
 * volume, patience, which events show up — is these six rows; tuning is a data
 * edit, not a code change.
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

  // ---- Events (design D3). All default to "nothing happens". ----

  /** How many doors jam during SERVE. */
  readonly jams: number;
  /** How many pickup customers turn up having forgotten their code. */
  readonly forgotten: number;
  /** Rain: one seeded digit of every displayed code is smudged out. */
  readonly rain: boolean;
  /** The van is late: LOAD runs for `LATE_VAN_FACTOR` of its usual length. */
  readonly lateVan: boolean;
}

/** A late van costs the courier 40 % of their loading time. */
export const LATE_VAN_FACTOR = 0.6;

/** How long LOAD actually runs for, once the van's lateness is applied. */
export function loadDurationMs(profile: DayProfile): number {
  return profile.lateVan ? Math.round(profile.loadMs * LATE_VAN_FACTOR) : profile.loadMs;
}

/** Everything a quiet day leaves switched off. */
const CALM = {
  visibleCustomers: 3,
  doorMs: 220,
  hintDelay1Ms: 6_000,
  hintDelay2Ms: 12_000,
  parcelSizeWeights: { A: 5, B: 3, C: 2 },
  // Senders never ask for C: a C slot may well be occupied all day and an
  // unservable customer is a penalty the player cannot avoid.
  senderSizeWeights: { A: 7, B: 3, C: 0 },
  dayStartHour: 8,
  dayEndHour: 20,
  jams: 0,
  forgotten: 0,
  rain: false,
  lateVan: false,
} as const;

/**
 * Monday to Saturday (design D2). Columns 2 → 5, parcels 8 → 27, patience
 * 24 s → 18 s, and one more thing going wrong each day from Thursday on.
 *
 * The arrival window is always `serveMs - patienceMs`, which is the invariant
 * that stops anyone walking merely because the day ended.
 */
export const MONDAY: DayProfile = {
  ...CALM,
  id: 'mon',
  columns: 2,
  pickups: 8,
  senders: 0,
  lookalikePairs: 0,
  loadMs: 25_000,
  serveMs: 60_000,
  patienceMs: 24_000,
  arrivalWindowMs: 36_000,
};

export const TUESDAY: DayProfile = {
  ...CALM,
  id: 'tue',
  columns: 2,
  pickups: 9,
  senders: 2,
  lookalikePairs: 0,
  loadMs: 25_000,
  serveMs: 60_000,
  patienceMs: 24_000,
  arrivalWindowMs: 36_000,
};

export const WEDNESDAY: DayProfile = {
  ...CALM,
  id: 'wed',
  columns: 3,
  pickups: 12,
  senders: 3,
  lookalikePairs: 1,
  loadMs: 25_000,
  serveMs: 65_000,
  patienceMs: 22_000,
  arrivalWindowMs: 43_000,
};

export const THURSDAY: DayProfile = {
  ...CALM,
  id: 'thu',
  columns: 3,
  pickups: 15,
  senders: 4,
  lookalikePairs: 2,
  loadMs: 25_000,
  serveMs: 65_000,
  patienceMs: 20_000,
  arrivalWindowMs: 45_000,
  jams: 1,
};

export const FRIDAY: DayProfile = {
  ...CALM,
  id: 'fri',
  columns: 4,
  pickups: 20,
  senders: 6,
  lookalikePairs: 2,
  loadMs: 25_000,
  serveMs: 70_000,
  patienceMs: 20_000,
  arrivalWindowMs: 50_000,
  forgotten: 2,
  lateVan: true,
};

export const SATURDAY: DayProfile = {
  ...CALM,
  id: 'sat',
  columns: 5,
  pickups: 27,
  senders: 8,
  lookalikePairs: 3,
  loadMs: 25_000,
  serveMs: 75_000,
  patienceMs: 18_000,
  arrivalWindowMs: 57_000,
  jams: 1,
  forgotten: 2,
  rain: true,
  lateVan: true,
};

/** Monday first. A Week run walks this list. */
export const WEEK_PROFILES: readonly DayProfile[] = [
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
];

/** Localisation keys for the day names, in the same order. */
export const WEEK_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Daily is Thursday-grade: the day the jammed door first appears, which is what
 * the core change's Daily was always meant to grow into.
 */
export const DAILY_PROFILE: DayProfile = { ...THURSDAY, id: 'daily' };
