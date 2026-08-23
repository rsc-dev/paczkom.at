/**
 * The SERVE-phase arrival schedule: who turns up at the locker and when.
 * Times are milliseconds from the start of SERVE.
 */
import type { Parcel } from './parcel.js';
import type { DayProfile } from './profiles.js';
import { next, shuffle, weightedPick } from './rng.js';
import type { RngState } from './rng.js';
import type { Size } from './wall.js';

export type CustomerKind = 'pickup' | 'sender';

export interface Arrival {
  readonly id: string;
  readonly kind: CustomerKind;
  /** Milliseconds from the start of SERVE. */
  readonly atMs: number;
  /** The parcel being collected; `null` for senders. */
  readonly parcelId: string | null;
  /** The smallest slot the sender's parcel needs; `null` for pickups. */
  readonly needsSize: Size | null;
}

interface Pending {
  readonly kind: CustomerKind;
  readonly parcelId: string | null;
  readonly needsSize: Size | null;
}

/**
 * Arrivals spread evenly over the profile's arrival window with a little
 * jitter, sorted by time. Pickups and senders are interleaved by shuffling.
 */
export function buildSchedule(
  state: RngState,
  profile: DayProfile,
  parcels: readonly Parcel[],
): [Arrival[], RngState] {
  let rng = state;

  const pending: Pending[] = parcels.map((parcel) => ({
    kind: 'pickup',
    parcelId: parcel.id,
    needsSize: null,
  }));

  for (let i = 0; i < profile.senders; i += 1) {
    const [needsSize, afterSize] = weightedPick(rng, profile.senderSizeWeights);
    rng = afterSize;
    pending.push({ kind: 'sender', parcelId: null, needsSize });
  }

  const [order, afterShuffle] = shuffle(rng, pending);
  rng = afterShuffle;

  const spacing = order.length > 0 ? profile.arrivalWindowMs / order.length : 0;
  const timed: { entry: Pending; atMs: number }[] = [];
  for (let i = 0; i < order.length; i += 1) {
    const entry = order[i];
    if (entry === undefined) {
      throw new Error('schedule shuffle lost an entry');
    }
    const [roll, afterRoll] = next(rng);
    rng = afterRoll;
    const jitter = (roll - 0.5) * spacing;
    const atMs = Math.round(Math.min(Math.max(i * spacing + jitter, 0), profile.arrivalWindowMs));
    timed.push({ entry, atMs });
  }

  timed.sort((a, b) => a.atMs - b.atMs);

  const arrivals = timed.map((slotted, index) => ({
    id: `k${String(index)}`,
    kind: slotted.entry.kind,
    atMs: slotted.atMs,
    parcelId: slotted.entry.parcelId,
    needsSize: slotted.entry.needsSize,
  }));

  return [arrivals, rng];
}
