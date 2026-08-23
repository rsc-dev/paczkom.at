/**
 * The SERVE-phase schedule: what happens at the locker and when. Times are
 * milliseconds from the start of SERVE.
 *
 * `ScheduleEntry` is a discriminated union on `kind`. Only customer arrivals
 * exist in this change; the Week change adds `{ kind: 'jam', … }` alongside
 * them, which is why the union exists at all.
 */
import type { Parcel } from './parcel.js';
import type { DayProfile } from './profiles.js';
import { next, shuffle, weightedPick } from './rng.js';
import type { RngState } from './rng.js';
import type { Size } from './wall.js';

/** What a customer wants. Separate from the schedule's own `kind`. */
export type CustomerRequest =
  | { readonly kind: 'pickup'; readonly parcelId: string }
  | { readonly kind: 'sender'; readonly needsSize: Size };

export type CustomerKind = CustomerRequest['kind'];

export interface CustomerArrival {
  readonly kind: 'arrival';
  readonly id: string;
  /** Milliseconds from the start of SERVE. */
  readonly atMs: number;
  readonly request: CustomerRequest;
}

/** The Week change widens this to `CustomerArrival | JamEvent`. */
export type ScheduleEntry = CustomerArrival;

export function isCustomerArrival(entry: ScheduleEntry): entry is CustomerArrival {
  return entry.kind === 'arrival';
}

/**
 * Arrivals spread evenly over the profile's arrival window with a little
 * jitter, sorted by time. Pickups and senders are interleaved by shuffling.
 */
export function buildSchedule(
  state: RngState,
  profile: DayProfile,
  parcels: readonly Parcel[],
): [ScheduleEntry[], RngState] {
  let rng = state;

  const requests: CustomerRequest[] = parcels.map((parcel) => ({
    kind: 'pickup',
    parcelId: parcel.id,
  }));

  for (let i = 0; i < profile.senders; i += 1) {
    const [needsSize, afterSize] = weightedPick(rng, profile.senderSizeWeights);
    rng = afterSize;
    requests.push({ kind: 'sender', needsSize });
  }

  const [order, afterShuffle] = shuffle(rng, requests);
  rng = afterShuffle;

  const spacing = order.length > 0 ? profile.arrivalWindowMs / order.length : 0;
  const timed: { request: CustomerRequest; atMs: number }[] = [];
  for (let i = 0; i < order.length; i += 1) {
    const request = order[i];
    if (request === undefined) {
      throw new Error('schedule shuffle lost an entry');
    }
    const [roll, afterRoll] = next(rng);
    rng = afterRoll;
    const jitter = (roll - 0.5) * spacing;
    const atMs = Math.round(Math.min(Math.max(i * spacing + jitter, 0), profile.arrivalWindowMs));
    timed.push({ request, atMs });
  }

  timed.sort((a, b) => a.atMs - b.atMs);

  const schedule: ScheduleEntry[] = timed.map((slotted, index) => ({
    kind: 'arrival',
    id: `k${String(index)}`,
    atMs: slotted.atMs,
    request: slotted.request,
  }));

  return [schedule, rng];
}
