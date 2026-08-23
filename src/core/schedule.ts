/**
 * The SERVE-phase schedule: what happens at the locker and when. Times are
 * milliseconds from the start of SERVE.
 *
 * `ScheduleEntry` is a discriminated union on `kind`: customers arriving, and
 * doors jamming. Everything the Week change calls an "event" is either an entry
 * on this list, a flag on a customer, or a field on the profile — never a new
 * subsystem.
 */
import { CODE_LENGTH, adjacentTranspositions } from './parcel.js';
import type { Parcel } from './parcel.js';
import type { DayProfile } from './profiles.js';
import { next, nextInt, shuffle, weightedPick } from './rng.js';
import type { RngState } from './rng.js';
import { buildWall } from './wall.js';
import type { Size } from './wall.js';

/** What a customer wants. Separate from the schedule's own `kind`. */
export type CustomerRequest =
  | {
      readonly kind: 'pickup';
      readonly parcelId: string;
      /** They have lost the code and can only describe the parcel. */
      readonly forgotten: boolean;
    }
  | { readonly kind: 'sender'; readonly needsSize: Size };

export type CustomerKind = CustomerRequest['kind'];

export interface CustomerArrival {
  readonly kind: 'arrival';
  readonly id: string;
  /** Milliseconds from the start of SERVE. */
  readonly atMs: number;
  readonly request: CustomerRequest;
}

/**
 * A door jamming. The target is named by *parcel* rather than by slot, because
 * which slot holds what is the player's decision during LOAD — the reducer jams
 * whichever door that parcel went into. `fallbackSlotId` covers the case where
 * the player never loaded it.
 */
export interface JamEvent {
  readonly kind: 'jam';
  readonly id: string;
  readonly atMs: number;
  readonly targetParcelId: string | null;
  readonly fallbackSlotId: string;
}

export type ScheduleEntry = CustomerArrival | JamEvent;

export function isCustomerArrival(entry: ScheduleEntry): entry is CustomerArrival {
  return entry.kind === 'arrival';
}

export function isJamEvent(entry: ScheduleEntry): entry is JamEvent {
  return entry.kind === 'jam';
}

/**
 * Which digit the rain smudges out, or `null` on a dry day.
 *
 * The masked position must never be one of the two a look-alike pair swaps, or
 * the pair would become genuinely indistinguishable. Rather than pick a mask
 * that fits the pairs, we pick the mask first and let the generator keep its
 * transpositions clear of it — that always has a solution, whereas the other
 * way round can be painted into a corner by three pairs.
 */
export function pickRainMask(state: RngState, profile: DayProfile): [number | null, RngState] {
  if (!profile.rain) {
    return [null, state];
  }
  return nextInt(state, CODE_LENGTH);
}

/** True when swapping digits `index` and `index + 1` would touch `mask`. */
export function transpositionTouches(index: number, mask: number): boolean {
  return index === mask || index + 1 === mask;
}

/**
 * The digit positions a pair of look-alike codes swapped — which, for an
 * adjacent transposition, is exactly the positions where they differ.
 */
export function transposedPositions(a: string, b: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      positions.push(i);
    }
  }
  return positions;
}

interface Pending {
  readonly request: CustomerRequest;
  readonly atMs: number;
}

function pickForgotten(
  state: RngState,
  parcels: readonly Parcel[],
  count: number,
): [Set<string>, RngState] {
  if (count <= 0 || parcels.length === 0) {
    return [new Set(), state];
  }
  const [order, rng] = shuffle(state, parcels);
  return [new Set(order.slice(0, Math.min(count, order.length)).map((parcel) => parcel.id)), rng];
}

/**
 * Arrivals spread evenly over the profile's arrival window with a little
 * jitter, sorted by time; jams scheduled just before the customer whose parcel
 * they strand, so the door is already stuck when its owner turns up.
 */
export function buildSchedule(
  state: RngState,
  profile: DayProfile,
  parcels: readonly Parcel[],
): [ScheduleEntry[], RngState] {
  let rng = state;

  const [forgotten, afterForgotten] = pickForgotten(rng, parcels, profile.forgotten);
  rng = afterForgotten;

  const requests: CustomerRequest[] = parcels.map((parcel) => ({
    kind: 'pickup',
    parcelId: parcel.id,
    forgotten: forgotten.has(parcel.id),
  }));

  for (let i = 0; i < profile.senders; i += 1) {
    const [needsSize, afterSize] = weightedPick(rng, profile.senderSizeWeights);
    rng = afterSize;
    requests.push({ kind: 'sender', needsSize });
  }

  const [order, afterShuffle] = shuffle(rng, requests);
  rng = afterShuffle;

  const spacing = order.length > 0 ? profile.arrivalWindowMs / order.length : 0;
  const timed: Pending[] = [];
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

  const arrivals: CustomerArrival[] = timed.map((slotted, index) => ({
    kind: 'arrival',
    id: `k${String(index)}`,
    atMs: slotted.atMs,
    request: slotted.request,
  }));

  const [jams, afterJams] = buildJams(rng, profile, arrivals);
  rng = afterJams;

  const schedule: ScheduleEntry[] = [...arrivals, ...jams].sort((a, b) => a.atMs - b.atMs);
  return [schedule, rng];
}

/**
 * One jam per `profile.jams`, each aimed at a pickup that has not been served
 * yet and timed a few seconds before that customer arrives.
 */
function buildJams(
  state: RngState,
  profile: DayProfile,
  arrivals: readonly CustomerArrival[],
): [JamEvent[], RngState] {
  if (profile.jams <= 0) {
    return [[], state];
  }
  let rng = state;

  const pickups = arrivals.filter(
    (arrival): arrival is CustomerArrival & { request: { kind: 'pickup' } } =>
      arrival.request.kind === 'pickup',
  );
  const wall = buildWall(profile.columns);

  const [shuffledPickups, afterPickups] = shuffle(rng, pickups);
  rng = afterPickups;
  const [shuffledSlots, afterSlots] = shuffle(rng, wall);
  rng = afterSlots;

  const jams: JamEvent[] = [];
  for (let i = 0; i < profile.jams; i += 1) {
    const victim = shuffledPickups[i];
    const fallback = shuffledSlots[i % Math.max(shuffledSlots.length, 1)];
    if (fallback === undefined) {
      break;
    }
    // A few seconds of grace, so the door is stuck before its owner is standing
    // in front of it rather than jamming under their hand.
    const atMs = victim === undefined ? 0 : Math.max(0, victim.atMs - 4_000);
    jams.push({
      kind: 'jam',
      id: `j${String(i)}`,
      atMs,
      targetParcelId:
        victim !== undefined && victim.request.kind === 'pickup' ? victim.request.parcelId : null,
      fallbackSlotId: fallback.id,
    });
  }
  return [jams, rng];
}

/** Re-exported so the rain mask can be checked against real pairs in tests. */
export { adjacentTranspositions };
