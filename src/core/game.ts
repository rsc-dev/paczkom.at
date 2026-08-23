/**
 * The day reducer.
 *
 * `reduce(state, action)` is a pure function: no DOM, no timers, no
 * `Math.random`. Time enters only through `tick(dtMs)`, so a whole day is
 * reproducible from `seed + action log` and the Week change can extend it by
 * adding actions and schedule entries rather than new code paths.
 */
import { generateParcels } from './parcel.js';
import type { Parcel } from './parcel.js';
import type { DayProfile } from './profiles.js';
import type { RngState } from './rng.js';
import { buildSchedule } from './schedule.js';
import type { Arrival, CustomerKind } from './schedule.js';
import { PENALTY, applyPoints, servicePoints } from './score.js';
import { buildWall, fits } from './wall.js';
import type { Size, Slot } from './wall.js';

export const PHASE_ORDER = ['LOAD', 'SERVE', 'SWEEP', 'SUMMARY'] as const;

export type Phase = (typeof PHASE_ORDER)[number];

export type SlotState = 'empty' | 'full' | 'open' | 'outgoing' | 'expired' | 'marked';

/** What the slot's pickup parcel ended up doing; drives the share grid. */
export type SlotOutcome = 'none' | 'perfect' | 'hinted' | 'walked';

/** Feedback for the view layer; the audio layer maps these to synthesised cues. */
export type Cue = 'tap' | 'door' | 'wrong' | 'done';

export type HintLevel = 0 | 1 | 2;

export interface SlotRuntime extends Slot {
  readonly state: SlotState;
  readonly parcelId: string | null;
  /** Milliseconds left of the open-door animation. */
  readonly openMs: number;
  readonly outcome: SlotOutcome;
}

export interface Customer {
  readonly id: string;
  readonly kind: CustomerKind;
  /** The parcel being collected; `null` for senders. */
  readonly parcelId: string | null;
  /** The slot size a sender needs; `null` for pickups. */
  readonly needsSize: Size | null;
  /** Visible customers drain patience; pending ones wait out of sight. */
  readonly visible: boolean;
  /** Milliseconds spent visible. */
  readonly waitedMs: number;
  /** Milliseconds active since becoming active or since the last tap. */
  readonly activeMs: number;
  readonly wrongTaps: number;
}

export interface DayStats {
  readonly served: number;
  readonly hinted: number;
  readonly walked: number;
  readonly refused: number;
  readonly unplaced: number;
  readonly wrongTaps: number;
}

export interface DaySummary extends DayStats {
  readonly score: number;
  readonly timeMs: number;
  readonly slotOutcomes: Readonly<Record<string, SlotOutcome>>;
}

export interface PhaseElapsed {
  readonly load: number;
  readonly serve: number;
  readonly sweep: number;
}

export interface State {
  readonly profile: DayProfile;
  readonly seed: number;
  readonly rng: RngState;
  /** Ticks are ignored until `start`. */
  readonly started: boolean;
  readonly phase: Phase;
  readonly slots: readonly SlotRuntime[];
  readonly parcels: Readonly<Record<string, Parcel>>;
  /** Parcel ids still on the van, head first. */
  readonly loadQueue: readonly string[];
  readonly schedule: readonly Arrival[];
  /** Index of the next arrival still to admit. */
  readonly nextArrival: number;
  readonly customers: readonly Customer[];
  readonly activeCustomerId: string | null;
  readonly phaseElapsedMs: number;
  readonly elapsed: PhaseElapsed;
  readonly score: number;
  readonly stats: DayStats;
  /** Feedback raised by the action just reduced. */
  readonly cues: readonly Cue[];
  readonly summary: DaySummary | null;
}

export type Action =
  | { readonly type: 'start' }
  | { readonly type: 'tick'; readonly dtMs: number }
  | { readonly type: 'tapSlot'; readonly slotId: string }
  | { readonly type: 'selectCustomer'; readonly customerId: string }
  | { readonly type: 'continue' };

const EMPTY_STATS: DayStats = {
  served: 0,
  hinted: 0,
  walked: 0,
  refused: 0,
  unplaced: 0,
  wrongTaps: 0,
};

export function phaseRank(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

/** A fresh day for a seed. Pure: the same seed always yields the same day. */
export function initialState(seed: number, profile: DayProfile): State {
  const [parcels, afterParcels] = generateParcels(seed, profile);
  const [schedule, afterSchedule] = buildSchedule(afterParcels, profile, parcels);
  const slots: SlotRuntime[] = buildWall(profile.columns).map((slot) => ({
    ...slot,
    state: 'empty',
    parcelId: null,
    openMs: 0,
    outcome: 'none',
  }));

  return {
    profile,
    seed,
    rng: afterSchedule,
    started: false,
    phase: 'LOAD',
    slots,
    parcels: Object.fromEntries(parcels.map((parcel) => [parcel.id, parcel])),
    loadQueue: parcels.map((parcel) => parcel.id),
    schedule,
    nextArrival: 0,
    customers: [],
    activeCustomerId: null,
    phaseElapsedMs: 0,
    elapsed: { load: 0, serve: 0, sweep: 0 },
    score: 0,
    stats: EMPTY_STATS,
    cues: [],
    summary: null,
  };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function findSlot(state: State, slotId: string): SlotRuntime | null {
  return state.slots.find((slot) => slot.id === slotId) ?? null;
}

export function currentParcel(state: State): Parcel | null {
  const id = state.loadQueue[0];
  return id === undefined ? null : (state.parcels[id] ?? null);
}

/** The parcels queued behind the current one, for the "coming up" strip. */
export function upcomingParcels(state: State, count = 2): Parcel[] {
  return state.loadQueue
    .slice(1, 1 + count)
    .map((id) => state.parcels[id])
    .filter((parcel): parcel is Parcel => parcel !== undefined);
}

export function visibleQueue(state: State): Customer[] {
  return state.customers.filter((customer) => customer.visible);
}

export function activeCustomer(state: State): Customer | null {
  if (state.activeCustomerId === null) {
    return null;
  }
  return state.customers.find((customer) => customer.id === state.activeCustomerId) ?? null;
}

/**
 * Hint level is derived, never stored: the greater of the time the customer has
 * been active without a tap and the mistakes they have caused. Switching the
 * active customer resets `activeMs`, which is what resets the timed half.
 */
export function hintLevelOf(state: State, customer: Customer | null): HintLevel {
  if (customer === null || customer.kind !== 'pickup') {
    return 0;
  }
  const timed: HintLevel =
    customer.activeMs >= state.profile.hintDelay2Ms
      ? 2
      : customer.activeMs >= state.profile.hintDelay1Ms
        ? 1
        : 0;
  const mistakes: HintLevel = customer.wrongTaps >= 2 ? 2 : customer.wrongTaps >= 1 ? 1 : 0;
  return timed >= mistakes ? timed : mistakes;
}

/** The column to highlight at hint level 2, or `null`. */
export function hintColumn(state: State): number | null {
  const active = activeCustomer(state);
  if (active === null || hintLevelOf(state, active) < 2) {
    return null;
  }
  const slot = state.slots.find((candidate) => candidate.parcelId === active.parcelId);
  return slot?.col ?? null;
}

export function totalTimeMs(state: State): number {
  return state.elapsed.load + state.elapsed.serve + state.elapsed.sweep;
}

export function slotOutcomes(state: State): Record<string, SlotOutcome> {
  return Object.fromEntries(state.slots.map((slot) => [slot.id, slot.outcome]));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function patchSlot(state: State, slotId: string, patch: Partial<SlotRuntime>): State {
  return {
    ...state,
    slots: state.slots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot)),
  };
}

function patchCustomer(state: State, customerId: string, patch: Partial<Customer>): State {
  return {
    ...state,
    customers: state.customers.map((customer) =>
      customer.id === customerId ? { ...customer, ...patch } : customer,
    ),
  };
}

function withCue(state: State, cue: Cue): State {
  return { ...state, cues: [...state.cues, cue] };
}

function addStats(state: State, delta: Partial<DayStats>): State {
  return { ...state, stats: { ...state.stats, ...delta } };
}

function score(state: State, delta: number): State {
  return { ...state, score: applyPoints(state.score, delta) };
}

// ---------------------------------------------------------------------------
// LOAD
// ---------------------------------------------------------------------------

/**
 * Closes the van: anything left on it is removed from the day, penalised, and
 * its customer never turns up.
 */
function endLoad(state: State): State {
  const unplaced = state.loadQueue.length;
  const stranded = new Set(state.loadQueue);
  const closed: State = {
    ...state,
    loadQueue: [],
    schedule: state.schedule.filter(
      (arrival) => arrival.parcelId === null || !stranded.has(arrival.parcelId),
    ),
    elapsed: {
      ...state.elapsed,
      load: Math.min(state.phaseElapsedMs, state.profile.loadMs),
    },
    phase: 'SERVE',
    phaseElapsedMs: 0,
    nextArrival: 0,
  };
  const penalised = score(
    addStats(closed, { unplaced: closed.stats.unplaced + unplaced }),
    -unplaced * PENALTY.unplacedParcel,
  );
  return settleServe(penalised);
}

function tickLoad(state: State, dtMs: number): State {
  const step = Math.min(dtMs, Math.max(0, state.profile.loadMs - state.phaseElapsedMs));
  const phaseElapsedMs = state.phaseElapsedMs + step;
  const advanced: State = {
    ...state,
    phaseElapsedMs,
    elapsed: { ...state.elapsed, load: phaseElapsedMs },
  };
  return phaseElapsedMs >= state.profile.loadMs ? endLoad(advanced) : advanced;
}

function tapSlotLoad(state: State, slotId: string): State {
  const parcel = currentParcel(state);
  const slot = findSlot(state, slotId);
  if (parcel === null || slot === null) {
    return state;
  }
  if (slot.state !== 'empty' || !fits(parcel.size, slot.size)) {
    return withCue(state, 'wrong');
  }
  const placed: State = {
    ...patchSlot(state, slotId, { state: 'full', parcelId: parcel.id }),
    loadQueue: state.loadQueue.slice(1),
  };
  const cued = withCue(placed, 'door');
  return cued.loadQueue.length === 0 ? endLoad(cued) : cued;
}

// ---------------------------------------------------------------------------
// SERVE
// ---------------------------------------------------------------------------

function walkCustomer(state: State, customerId: string): State {
  const customer = state.customers.find((entry) => entry.id === customerId);
  if (customer === undefined) {
    return state;
  }
  const without: State = {
    ...state,
    customers: state.customers.filter((entry) => entry.id !== customerId),
    activeCustomerId: state.activeCustomerId === customerId ? null : state.activeCustomerId,
  };

  if (customer.kind === 'sender') {
    return score(
      addStats(without, { refused: without.stats.refused + 1 }),
      -PENALTY.refusedSender,
    );
  }

  const slot = without.slots.find((candidate) => candidate.parcelId === customer.parcelId);
  const abandoned =
    slot === undefined || slot.state !== 'full'
      ? without
      : patchSlot(without, slot.id, { state: 'expired', outcome: 'walked' });
  return score(
    addStats(abandoned, { walked: abandoned.stats.walked + 1 }),
    -PENALTY.walkedPickup,
  );
}

/** Admits due arrivals, fills the visible queue and makes sure someone is active. */
function settleServe(state: State): State {
  let next = state;

  const admitted: Customer[] = [];
  let cursor = next.nextArrival;
  while (cursor < next.schedule.length) {
    const arrival = next.schedule[cursor];
    if (arrival === undefined || arrival.atMs > next.phaseElapsedMs) {
      break;
    }
    admitted.push({
      id: arrival.id,
      kind: arrival.kind,
      parcelId: arrival.parcelId,
      needsSize: arrival.needsSize,
      visible: false,
      waitedMs: 0,
      activeMs: 0,
      wrongTaps: 0,
    });
    cursor += 1;
  }
  if (admitted.length > 0) {
    next = { ...next, customers: [...next.customers, ...admitted], nextArrival: cursor };
  }

  // Promote pending customers, in arrival order, up to the visible cap.
  let visibleCount = next.customers.filter((customer) => customer.visible).length;
  if (visibleCount < next.profile.visibleCustomers) {
    next = {
      ...next,
      customers: next.customers.map((customer) => {
        if (customer.visible || visibleCount >= next.profile.visibleCustomers) {
          return customer;
        }
        visibleCount += 1;
        return { ...customer, visible: true };
      }),
    };
  }

  const active = activeCustomer(next);
  if (active === null || !active.visible) {
    const front = next.customers.find((customer) => customer.visible);
    next = {
      ...next,
      activeCustomerId: front?.id ?? null,
      customers: next.customers.map((customer) =>
        customer.id === front?.id ? { ...customer, activeMs: 0 } : customer,
      ),
    };
  }
  return next;
}

function endServe(state: State): State {
  let next: State = {
    ...state,
    elapsed: {
      ...state.elapsed,
      serve: Math.min(state.phaseElapsedMs, state.profile.serveMs),
    },
  };
  for (const customer of [...next.customers]) {
    next = walkCustomer(next, customer.id);
  }
  return enterSweep(next);
}

function tickServe(state: State, dtMs: number): State {
  const step = Math.min(dtMs, Math.max(0, state.profile.serveMs - state.phaseElapsedMs));
  let next: State = { ...state, phaseElapsedMs: state.phaseElapsedMs + step };
  next = { ...next, elapsed: { ...next.elapsed, serve: next.phaseElapsedMs } };

  // Doors that were opened settle shut and free their slot.
  next = {
    ...next,
    slots: next.slots.map((slot) => {
      if (slot.state !== 'open') {
        return slot;
      }
      const openMs = slot.openMs - step;
      return openMs > 0
        ? { ...slot, openMs }
        : { ...slot, state: 'empty', parcelId: null, openMs: 0 };
    }),
  };

  // Patience drains for visible customers only.
  next = {
    ...next,
    customers: next.customers.map((customer) =>
      customer.visible ? { ...customer, waitedMs: customer.waitedMs + step } : customer,
    ),
  };
  const impatient = next.customers.filter(
    (customer) => customer.visible && customer.waitedMs >= next.profile.patienceMs,
  );
  for (const customer of impatient) {
    next = withCue(walkCustomer(next, customer.id), 'wrong');
  }

  // The active customer's hint timer only runs while they are the active one.
  if (next.activeCustomerId !== null) {
    next = patchCustomer(next, next.activeCustomerId, {
      activeMs: (activeCustomer(next)?.activeMs ?? 0) + step,
    });
  }

  next = settleServe(next);

  if (next.phaseElapsedMs >= next.profile.serveMs) {
    return endServe(next);
  }
  if (next.customers.length === 0 && next.nextArrival >= next.schedule.length) {
    return endServe(next);
  }
  return next;
}

function servePickup(state: State, customer: Customer, slot: SlotRuntime): State {
  const level = hintLevelOf(state, customer);
  const opened = patchSlot(state, slot.id, {
    state: 'open',
    openMs: state.profile.doorMs,
    outcome: level >= 1 ? 'hinted' : 'perfect',
  });
  const removed: State = {
    ...opened,
    customers: opened.customers.filter((entry) => entry.id !== customer.id),
    activeCustomerId: null,
  };
  const counted = addStats(removed, {
    served: removed.stats.served + 1,
    hinted: removed.stats.hinted + (level >= 1 ? 1 : 0),
  });
  const paid = score(counted, servicePoints(customer.waitedMs, state.profile.patienceMs));
  return withCue(paid, 'door');
}

function serveSender(state: State, customer: Customer, slot: SlotRuntime): State {
  const placed = patchSlot(state, slot.id, { state: 'outgoing', parcelId: null });
  const removed: State = {
    ...placed,
    customers: placed.customers.filter((entry) => entry.id !== customer.id),
    activeCustomerId: null,
  };
  const counted = addStats(removed, { served: removed.stats.served + 1 });
  const paid = score(counted, servicePoints(customer.waitedMs, state.profile.patienceMs));
  return withCue(paid, 'door');
}

function wrongTap(state: State, customer: Customer): State {
  const marked = patchCustomer(state, customer.id, {
    wrongTaps: customer.wrongTaps + 1,
    activeMs: 0,
  });
  const counted = addStats(marked, { wrongTaps: marked.stats.wrongTaps + 1 });
  return withCue(score(counted, -PENALTY.wrongTap), 'wrong');
}

function tapSlotServe(state: State, slotId: string): State {
  const customer = activeCustomer(state);
  const slot = findSlot(state, slotId);
  if (customer === null || !customer.visible || slot === null) {
    return state;
  }

  const served =
    customer.kind === 'pickup'
      ? slot.state === 'full' && slot.parcelId === customer.parcelId
        ? servePickup(state, customer, slot)
        : wrongTap(state, customer)
      : slot.state === 'empty' && fits(customer.needsSize ?? 'C', slot.size)
        ? serveSender(state, customer, slot)
        : wrongTap(state, customer);

  const settled = settleServe(served);
  if (settled.customers.length === 0 && settled.nextArrival >= settled.schedule.length) {
    return endServe(settled);
  }
  return settled;
}

// ---------------------------------------------------------------------------
// SWEEP
// ---------------------------------------------------------------------------

function enterSweep(state: State): State {
  const swept: State = {
    ...state,
    phase: 'SWEEP',
    phaseElapsedMs: 0,
    activeCustomerId: null,
    slots: state.slots.map((slot) => {
      if (slot.state === 'outgoing' || slot.state === 'expired') {
        return { ...slot, state: 'marked', openMs: 0 };
      }
      // A parcel nobody ever came for: treat it like an expired one so the
      // player still has to clear it and the share grid tells the truth.
      if (slot.state === 'full') {
        return { ...slot, state: 'marked', openMs: 0, outcome: 'walked' };
      }
      if (slot.state === 'open') {
        return { ...slot, state: 'empty', parcelId: null, openMs: 0 };
      }
      return slot;
    }),
  };
  return swept.slots.some((slot) => slot.state === 'marked') ? swept : finish(swept);
}

function tickSweep(state: State, dtMs: number): State {
  const phaseElapsedMs = state.phaseElapsedMs + dtMs;
  return {
    ...state,
    phaseElapsedMs,
    elapsed: { ...state.elapsed, sweep: phaseElapsedMs },
  };
}

function tapSlotSweep(state: State, slotId: string): State {
  const slot = findSlot(state, slotId);
  if (slot === null || slot.state !== 'marked') {
    return state;
  }
  const cleared = withCue(patchSlot(state, slotId, { state: 'empty', parcelId: null }), 'door');
  return cleared.slots.some((candidate) => candidate.state === 'marked')
    ? cleared
    : finish(cleared);
}

function finish(state: State): State {
  const summary: DaySummary = {
    ...state.stats,
    score: state.score,
    timeMs: totalTimeMs(state),
    slotOutcomes: slotOutcomes(state),
  };
  return withCue({ ...state, phase: 'SUMMARY', summary }, 'done');
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(state: State, action: Action): State {
  const fresh: State = { ...state, cues: [] };

  if (action.type === 'start') {
    return fresh.started ? fresh : { ...fresh, started: true };
  }
  if (!fresh.started || fresh.phase === 'SUMMARY') {
    return fresh;
  }

  switch (action.type) {
    case 'tick': {
      if (action.dtMs <= 0) {
        return fresh;
      }
      switch (fresh.phase) {
        case 'LOAD':
          return tickLoad(fresh, action.dtMs);
        case 'SERVE':
          return tickServe(fresh, action.dtMs);
        case 'SWEEP':
          return tickSweep(fresh, action.dtMs);
        default:
          return fresh;
      }
    }
    case 'tapSlot': {
      switch (fresh.phase) {
        case 'LOAD':
          return tapSlotLoad(fresh, action.slotId);
        case 'SERVE':
          return tapSlotServe(fresh, action.slotId);
        case 'SWEEP':
          return tapSlotSweep(fresh, action.slotId);
        default:
          return fresh;
      }
    }
    case 'selectCustomer': {
      if (fresh.phase !== 'SERVE' || fresh.activeCustomerId === action.customerId) {
        return fresh;
      }
      const target = fresh.customers.find(
        (customer) => customer.id === action.customerId && customer.visible,
      );
      if (target === undefined) {
        return fresh;
      }
      const selected = patchCustomer(fresh, target.id, { activeMs: 0 });
      return withCue({ ...selected, activeCustomerId: target.id }, 'tap');
    }
    case 'continue': {
      // "The van is empty" — closes LOAD early, at the cost of anything still
      // unplaced. Every other phase ends on its own rules.
      return fresh.phase === 'LOAD' ? endLoad(fresh) : fresh;
    }
    default:
      return fresh;
  }
}
