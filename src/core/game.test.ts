import { describe, expect, it } from 'vitest';
import {
  PHASE_ORDER,
  activeCustomer,
  currentParcel,
  findSlot,
  hintColumn,
  hintLevelOf,
  initialState,
  phaseRank,
  reduce,
  totalTimeMs,
  upcomingParcels,
  visibleQueue,
} from './game.js';
import type { Action, Customer, SlotRuntime, State } from './game.js';
import { DAILY_PROFILE } from './profiles.js';
import type { DayProfile } from './profiles.js';
import { PENALTY, servicePoints } from './score.js';
import { isCustomerArrival } from './schedule.js';
import { fits } from './wall.js';
import type { Size } from './wall.js';

/**
 * Daily is Thursday-grade and therefore has a jam in it. The focused tests in
 * this file are about one rule each, so they build on a Daily with the weather
 * switched off; the event tests opt back in explicitly.
 */
const CALM_DAILY: DayProfile = {
  ...DAILY_PROFILE,
  jams: 0,
  forgotten: 0,
  rain: false,
  lateVan: false,
};

const profileWith = (overrides: Partial<DayProfile>): DayProfile => ({
  ...CALM_DAILY,
  ...overrides,
});

const TINY = profileWith({
  id: 'test-tiny',
  columns: 1,
  pickups: 3,
  senders: 1,
  lookalikePairs: 0,
  loadMs: 10_000,
  serveMs: 30_000,
  arrivalWindowMs: 4_000,
});

const run = (state: State, ...actions: Action[]): State => actions.reduce(reduce, state);

const started = (seed: number, profile: DayProfile): State =>
  reduce(initialState(seed, profile), { type: 'start' });

/** Places the head of the load queue into the first empty slot that takes it. */
function placeNext(state: State): State {
  const parcel = currentParcel(state);
  if (parcel === null) {
    return state;
  }
  const slot = state.slots.find((candidate) => candidate.state === 'empty' && fits(parcel.size, candidate.size));
  if (slot === undefined) {
    throw new Error(`no free slot fits parcel ${parcel.id}`);
  }
  return reduce(state, { type: 'tapSlot', slotId: slot.id });
}

/** Loads the whole van. */
function loadAll(state: State): State {
  let current = state;
  while (current.phase === 'LOAD' && currentParcel(current) !== null) {
    current = placeNext(current);
  }
  return current;
}

/** Rotates the load queue so a parcel of `size` is next off the van. */
function queueFirst(state: State, size: Size): State {
  const index = state.loadQueue.findIndex((id) => state.parcels[id]?.size === size);
  if (index < 0) {
    throw new Error(`no ${size} parcel in the load queue`);
  }
  const id = state.loadQueue[index];
  if (id === undefined) {
    throw new Error('load queue index out of range');
  }
  return { ...state, loadQueue: [id, ...state.loadQueue.filter((other) => other !== id)] };
}

const slotOf = (state: State, parcelId: string) =>
  state.slots.find((slot) => slot.parcelId === parcelId);

/** The slot holding a pickup customer's parcel. Throws rather than silently
 * matching nothing, so a test can never pass vacuously. */
function customerSlot(state: State, customer: Customer | null | undefined): SlotRuntime {
  if (customer === null || customer === undefined || customer.kind !== 'pickup') {
    throw new Error('expected an active pickup customer');
  }
  const slot = slotOf(state, customer.parcelId);
  if (slot === undefined) {
    throw new Error(`no slot holds parcel ${customer.parcelId}`);
  }
  return slot;
}

function asPickup(customer: Customer | null | undefined): Extract<Customer, { kind: 'pickup' }> {
  if (customer === null || customer === undefined || customer.kind !== 'pickup') {
    throw new Error('expected a pickup customer');
  }
  return customer;
}

function asSender(customer: Customer | null | undefined): Extract<Customer, { kind: 'sender' }> {
  if (customer === null || customer === undefined || customer.kind !== 'sender') {
    throw new Error('expected a sender customer');
  }
  return customer;
}

describe('initialState', () => {
  it('applies the Daily profile: 21 slots, 15 parcels and one jam', () => {
    const state = initialState(1, DAILY_PROFILE);
    expect(state.slots).toHaveLength(21);
    expect(state.loadQueue).toHaveLength(15);
    expect(state.schedule.filter((entry) => entry.kind === 'jam')).toHaveLength(1);
    expect(state.phase).toBe('LOAD');
    expect(state.score).toBe(0);
    expect(state.summary).toBeNull();
    expect(state.slots.every((slot) => slot.state === 'empty')).toBe(true);
    expect(state.slots.every((slot) => !slot.jammed)).toBe(true);
    // Thursday is dry.
    expect(state.maskedDigit).toBeNull();
  });

  it('is deterministic for a seed', () => {
    expect(initialState(1, DAILY_PROFILE)).toEqual(initialState(1, DAILY_PROFILE));
  });

  it('shows the current parcel and the next two', () => {
    const state = initialState(1, DAILY_PROFILE);
    expect(currentParcel(state)?.id).toBe(state.loadQueue[0]);
    expect(upcomingParcels(state).map((parcel) => parcel.id)).toEqual([
      state.loadQueue[1],
      state.loadQueue[2],
    ]);
  });

  it('ignores ticks until the day is started', () => {
    const state = initialState(1, DAILY_PROFILE);
    const ticked = reduce(state, { type: 'tick', dtMs: 5_000 });
    expect(ticked.phaseElapsedMs).toBe(0);
    expect(reduce(ticked, { type: 'start' }).started).toBe(true);
  });

  it('ignores a tick that is not a positive, finite number', () => {
    const state = started(1, DAILY_PROFILE);
    for (const dtMs of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const ticked = reduce(state, { type: 'tick', dtMs });
      expect(ticked.phaseElapsedMs).toBe(0);
      expect(Number.isFinite(ticked.phaseElapsedMs)).toBe(true);
      expect(ticked.elapsed).toEqual({ load: 0, serve: 0, sweep: 0 });
    }
  });
});

describe('LOAD placement', () => {
  it('places a fitting parcel and advances the queue', () => {
    const state = queueFirst(started(1, DAILY_PROFILE), 'B');
    const parcel = currentParcel(state);
    const target = state.slots.find((slot) => slot.size === 'C');
    expect(parcel?.size).toBe('B');
    expect(target).toBeDefined();
    const next = reduce(state, { type: 'tapSlot', slotId: target?.id ?? '' });
    expect(findSlot(next, target?.id ?? '')?.state).toBe('full');
    expect(findSlot(next, target?.id ?? '')?.parcelId).toBe(parcel?.id);
    expect(next.loadQueue).toHaveLength(state.loadQueue.length - 1);
    expect(currentParcel(next)?.id).toBe(state.loadQueue[1]);
  });

  it('refuses a parcel that does not fit and only raises a wrong cue', () => {
    const state = queueFirst(started(1, DAILY_PROFILE), 'C');
    const small = state.slots.find((slot) => slot.size === 'A');
    const next = reduce(state, { type: 'tapSlot', slotId: small?.id ?? '' });
    expect(next.cues).toContain('wrong');
    expect({ ...next, cues: [] }).toEqual({ ...state, cues: [] });
    expect(next.score).toBe(state.score);
  });

  it('refuses an occupied slot', () => {
    const state = started(1, DAILY_PROFILE);
    const placed = placeNext(state);
    const occupied = placed.slots.find((slot) => slot.state === 'full');
    const next = reduce(placed, { type: 'tapSlot', slotId: occupied?.id ?? '' });
    expect(next.cues).toContain('wrong');
    expect(next.loadQueue).toEqual(placed.loadQueue);
  });

  it('moves to SERVE as soon as the queue is empty', () => {
    const state = run(started(3, TINY), { type: 'tick', dtMs: 2_000 });
    const loaded = loadAll(state);
    expect(loaded.phase).toBe('SERVE');
    expect(loaded.elapsed.load).toBe(2_000);
    expect(loaded.stats.unplaced).toBe(0);
  });

  it('ends LOAD on the timer, penalising every parcel left on the van', () => {
    const state = started(3, TINY);
    const partial = placeNext(state);
    const expired = reduce(partial, { type: 'tick', dtMs: TINY.loadMs });
    expect(expired.phase).toBe('SERVE');
    expect(expired.stats.unplaced).toBe(TINY.pickups - 1);
    expect(expired.score).toBe(0);
    expect(expired.loadQueue).toHaveLength(0);
    expect(expired.elapsed.load).toBe(TINY.loadMs);
  });

  it('drops the customers of parcels that never made it into the wall', () => {
    const state = started(3, TINY);
    const kept = placeNext(state).loadQueue;
    const expired = reduce(placeNext(state), { type: 'tick', dtMs: TINY.loadMs });
    const stillComing = expired.schedule.filter(isCustomerArrival).map((entry) => entry.request);
    for (const request of stillComing) {
      if (request.kind === 'pickup') {
        expect(kept).not.toContain(request.parcelId);
      }
    }
    expect(stillComing.filter((request) => request.kind === 'pickup')).toHaveLength(1);
  });

  it('lets the player close the van early with `continue`', () => {
    const state = run(started(3, TINY), { type: 'tick', dtMs: 3_000 });
    const closed = reduce(state, { type: 'continue' });
    expect(closed.phase).toBe('SERVE');
    expect(closed.stats.unplaced).toBe(TINY.pickups);
    expect(closed.elapsed.load).toBe(3_000);
  });
});

describe('SERVE customer queue', () => {
  const profile = profileWith({
    id: 'test-queue',
    columns: 2,
    pickups: 5,
    senders: 0,
    lookalikePairs: 0,
    loadMs: 10_000,
    serveMs: 30_000,
    arrivalWindowMs: 1_000,
  });

  const atServe = (): State => {
    const loaded = loadAll(started(11, profile));
    return reduce(loaded, { type: 'tick', dtMs: 1_200 });
  };

  it('shows at most the visible count from the profile and holds the rest pending', () => {
    const state = atServe();
    expect(visibleQueue(state)).toHaveLength(profile.visibleCustomers);
    expect(state.customers).toHaveLength(profile.pickups);
    const pending = state.customers.filter((customer) => !customer.visible);
    expect(pending).toHaveLength(profile.pickups - profile.visibleCustomers);
    for (const customer of pending) {
      expect(customer.waitedMs).toBe(0);
    }
  });

  it('makes the front of the visible queue active by default', () => {
    const state = atServe();
    expect(activeCustomer(state)?.id).toBe(visibleQueue(state)[0]?.id);
  });

  it('selects any visible customer and resets their hint timer', () => {
    const state = atServe();
    const second = visibleQueue(state)[1];
    const selected = reduce(state, { type: 'selectCustomer', customerId: second?.id ?? '' });
    expect(activeCustomer(selected)?.id).toBe(second?.id);
    expect(activeCustomer(selected)?.activeMs).toBe(0);
  });

  it('ignores selecting a pending customer', () => {
    const state = atServe();
    const pending = state.customers.find((customer) => !customer.visible);
    const selected = reduce(state, { type: 'selectCustomer', customerId: pending?.id ?? '' });
    expect(activeCustomer(selected)?.id).toBe(activeCustomer(state)?.id);
  });

  it('promotes a pending customer when a visible one leaves', () => {
    const state = atServe();
    const slot = customerSlot(state, activeCustomer(state));
    const served = run(state, { type: 'tapSlot', slotId: slot.id }, { type: 'tick', dtMs: 10 });
    expect(visibleQueue(served)).toHaveLength(profile.visibleCustomers);
    expect(served.customers).toHaveLength(profile.pickups - 1);
  });
});

describe('SERVE pickup service', () => {
  const profile = profileWith({
    id: 'test-pickup',
    columns: 2,
    pickups: 4,
    senders: 0,
    lookalikePairs: 0,
    loadMs: 10_000,
    serveMs: 40_000,
    arrivalWindowMs: 1_000,
  });

  const atServe = (): State =>
    reduce(loadAll(started(21, profile)), { type: 'tick', dtMs: 1_200 });

  it('opens the right door, frees the slot and scores the service', () => {
    const state = atServe();
    const active = asPickup(activeCustomer(state));
    const slot = customerSlot(state, active);
    const tapped = reduce(state, { type: 'tapSlot', slotId: slot.id });

    expect(findSlot(tapped, slot.id)?.state).toBe('open');
    expect(findSlot(tapped, slot.id)?.outcome).toBe('perfect');
    expect(tapped.customers.some((customer) => customer.id === active.id)).toBe(false);
    expect(tapped.stats.served).toBe(1);
    expect(tapped.stats.hinted).toBe(0);
    expect(tapped.score).toBe(servicePoints(active.waitedMs, profile.patienceMs));
    expect(tapped.cues).toContain('door');

    const settled = reduce(tapped, { type: 'tick', dtMs: profile.doorMs });
    expect(findSlot(settled, slot.id)?.state).toBe('empty');
    expect(findSlot(settled, slot.id)?.parcelId).toBeNull();
    expect(findSlot(settled, slot.id)?.outcome).toBe('perfect');
  });

  it('counts any other door as a wrong tap', () => {
    const state = atServe();
    const active = asPickup(activeCustomer(state));
    const wrong = state.slots.find(
      (slot) => slot.state === 'full' && slot.parcelId !== active.parcelId,
    );
    const tapped = reduce(state, { type: 'tapSlot', slotId: wrong?.id ?? '' });

    expect(findSlot(tapped, wrong?.id ?? '')?.state).toBe('full');
    expect(activeCustomer(tapped)?.wrongTaps).toBe(1);
    expect(tapped.stats.wrongTaps).toBe(1);
    expect(tapped.score).toBe(0);
    // Exactly one cue, so the audio layer cannot double-fire the buzz.
    expect(tapped.cues).toEqual(['wrong']);
  });

  it('replaces the cue list on every action, ticks included', () => {
    const state = atServe();
    const active = asPickup(activeCustomer(state));
    const wrong = state.slots.find(
      (slot) => slot.state === 'full' && slot.parcelId !== active.parcelId,
    );
    const tapped = reduce(state, { type: 'tapSlot', slotId: wrong?.id ?? '' });
    expect(tapped.cues).toEqual(['wrong']);
    expect(reduce(tapped, { type: 'tick', dtMs: 16 }).cues).toEqual([]);
    expect(reduce(tapped, { type: 'tick', dtMs: 0 }).cues).toEqual([]);
  });

  it('ignores a second tap on the door it just opened', () => {
    const state = atServe();
    const slot = customerSlot(state, activeCustomer(state));
    const opened = reduce(state, { type: 'tapSlot', slotId: slot.id });
    expect(findSlot(opened, slot.id)?.state).toBe('open');

    // Somebody else has stepped up to the counter by now; the stray tap from
    // the first customer's double-tap must not be charged to them.
    const next = activeCustomer(opened);
    expect(next).not.toBeNull();

    const doubleTapped = reduce(opened, { type: 'tapSlot', slotId: slot.id });
    expect(activeCustomer(doubleTapped)?.wrongTaps).toBe(0);
    expect(hintLevelOf(doubleTapped, activeCustomer(doubleTapped))).toBe(0);
    expect(doubleTapped.stats.wrongTaps).toBe(0);
    expect(doubleTapped.score).toBe(opened.score);
    expect(doubleTapped.cues).toEqual([]);
    expect({ ...doubleTapped, cues: [] }).toEqual({ ...opened, cues: [] });
  });

  it('marks a service after a hint as hinted', () => {
    const state = atServe();
    const hinted = reduce(state, { type: 'tick', dtMs: profile.hintDelay1Ms });
    expect(hintLevelOf(hinted, activeCustomer(hinted))).toBe(1);
    const slot = customerSlot(hinted, activeCustomer(hinted));
    const tapped = reduce(hinted, { type: 'tapSlot', slotId: slot.id });
    expect(findSlot(tapped, slot.id)?.outcome).toBe('hinted');
    expect(tapped.stats.hinted).toBe(1);
    expect(tapped.stats.served).toBe(1);
  });
});

describe('hint ladder', () => {
  const profile = profileWith({
    id: 'test-hints',
    columns: 2,
    pickups: 3,
    senders: 0,
    lookalikePairs: 0,
    loadMs: 10_000,
    serveMs: 40_000,
    arrivalWindowMs: 500,
  });

  const atServe = (): State => reduce(loadAll(started(31, profile)), { type: 'tick', dtMs: 600 });

  it('reaches level 1 after 6 s without a tap', () => {
    const state = atServe();
    const before = reduce(state, { type: 'tick', dtMs: profile.hintDelay1Ms - 1 });
    expect(hintLevelOf(before, activeCustomer(before))).toBe(0);
    const after = reduce(before, { type: 'tick', dtMs: 1 });
    expect(hintLevelOf(after, activeCustomer(after))).toBe(1);
    expect(hintColumn(after)).toBeNull();
  });

  it('reaches level 2 after 12 s and marks the parcel column', () => {
    const state = reduce(atServe(), { type: 'tick', dtMs: profile.hintDelay2Ms });
    expect(hintLevelOf(state, activeCustomer(state))).toBe(2);
    expect(hintColumn(state)).toBe(customerSlot(state, activeCustomer(state)).col);
  });

  it('reaches level 1 on the first wrong tap and level 2 on the second', () => {
    const state = atServe();
    const active = asPickup(activeCustomer(state));
    const others = state.slots.filter(
      (slot) => slot.state === 'full' && slot.parcelId !== active.parcelId,
    );
    const first = reduce(state, { type: 'tapSlot', slotId: others[0]?.id ?? '' });
    expect(hintLevelOf(first, activeCustomer(first))).toBe(1);
    const second = reduce(first, { type: 'tapSlot', slotId: others[1]?.id ?? '' });
    expect(hintLevelOf(second, activeCustomer(second))).toBe(2);
    expect(hintColumn(second)).toBe(customerSlot(second, activeCustomer(second)).col);
  });

  it('never decreases the level: a wrong tap after idling to level 2 keeps it', () => {
    const idled = reduce(atServe(), { type: 'tick', dtMs: profile.hintDelay2Ms });
    const active = asPickup(activeCustomer(idled));
    expect(hintLevelOf(idled, active)).toBe(2);
    const wrong = idled.slots.find(
      (slot) => slot.state === 'full' && slot.parcelId !== active.parcelId,
    );
    const tapped = reduce(idled, { type: 'tapSlot', slotId: wrong?.id ?? '' });
    expect(hintLevelOf(tapped, activeCustomer(tapped))).toBe(2);
    expect(hintColumn(tapped)).toBe(customerSlot(tapped, activeCustomer(tapped)).col);
    expect(activeCustomer(tapped)?.activeMs).toBe(0);
  });

  it('keeps the level when the active customer changes and comes back', () => {
    const idled = reduce(atServe(), { type: 'tick', dtMs: profile.hintDelay2Ms });
    const active = asPickup(activeCustomer(idled));
    const other = visibleQueue(idled).find((customer) => customer.id !== active.id);

    const switched = reduce(idled, { type: 'selectCustomer', customerId: other?.id ?? '' });
    // The newly active customer has their own (untouched) level and a fresh timer.
    expect(hintLevelOf(switched, activeCustomer(switched))).toBe(0);
    expect(activeCustomer(switched)?.activeMs).toBe(0);

    const back = reduce(switched, { type: 'selectCustomer', customerId: active.id });
    expect(hintLevelOf(back, activeCustomer(back))).toBe(2);
    expect(activeCustomer(back)?.activeMs).toBe(0);

    // ... and serving them is still a hinted service, not a free `perfect`.
    const slot = customerSlot(back, activeCustomer(back));
    const served = reduce(back, { type: 'tapSlot', slotId: slot.id });
    expect(findSlot(served, slot.id)?.outcome).toBe('hinted');
    expect(served.stats.hinted).toBe(1);
  });

  it('keeps the mistake-based level when the customer becomes active again', () => {
    const state = atServe();
    const active = asPickup(activeCustomer(state));
    const wrong = state.slots.find(
      (slot) => slot.state === 'full' && slot.parcelId !== active.parcelId,
    );
    const mistaken = reduce(state, { type: 'tapSlot', slotId: wrong?.id ?? '' });
    const other = visibleQueue(mistaken).find((customer) => customer.id !== active.id);
    const away = reduce(mistaken, { type: 'selectCustomer', customerId: other?.id ?? '' });
    const back = reduce(away, { type: 'selectCustomer', customerId: active.id });
    expect(hintLevelOf(back, activeCustomer(back))).toBe(1);
  });

  it('resets the idle timer on every tap', () => {
    const state = reduce(atServe(), { type: 'tick', dtMs: profile.hintDelay1Ms - 100 });
    const active = asPickup(activeCustomer(state));
    const wrong = state.slots.find(
      (slot) => slot.state === 'full' && slot.parcelId !== active.parcelId,
    );
    const tapped = reduce(state, { type: 'tapSlot', slotId: wrong?.id ?? '' });
    expect(activeCustomer(tapped)?.activeMs).toBe(0);
  });

  it('never hints a sender', () => {
    const senderProfile = profileWith({
      id: 'test-sender-hint',
      columns: 2,
      pickups: 1,
      senders: 1,
      lookalikePairs: 0,
      arrivalWindowMs: 200,
      patienceMs: 60_000,
      serveMs: 120_000,
    });
    const state = reduce(loadAll(started(41, senderProfile)), { type: 'tick', dtMs: 15_000 });
    const sender = asSender(state.customers.find((customer) => customer.kind === 'sender'));
    expect(sender.hintLevel).toBe(0);
    expect(hintLevelOf(state, sender)).toBe(0);

    const selected = reduce(state, { type: 'selectCustomer', customerId: sender.id });
    const idled = reduce(selected, { type: 'tick', dtMs: senderProfile.hintDelay2Ms });
    expect(hintLevelOf(idled, activeCustomer(idled))).toBe(0);
    expect(hintColumn(idled)).toBeNull();
  });
});

describe('SERVE sender service', () => {
  const profile = profileWith({
    id: 'test-senders',
    columns: 2,
    pickups: 2,
    senders: 2,
    lookalikePairs: 0,
    loadMs: 10_000,
    serveMs: 40_000,
    arrivalWindowMs: 300,
    senderSizeWeights: { A: 0, B: 1, C: 0 },
  });

  const atServe = (): State => {
    let state = reduce(loadAll(started(51, profile)), { type: 'tick', dtMs: 400 });
    const sender = state.customers.find((customer) => customer.kind === 'sender' && customer.visible);
    if (sender !== undefined) {
      state = reduce(state, { type: 'selectCustomer', customerId: sender.id });
    }
    return state;
  };

  it('accepts an empty slot at least as large as the sender needs', () => {
    const state = atServe();
    const sender = asSender(activeCustomer(state));
    const target = state.slots.find(
      (slot) => slot.state === 'empty' && fits(sender.needsSize, slot.size),
    );
    const placed = reduce(state, { type: 'tapSlot', slotId: target?.id ?? '' });
    expect(findSlot(placed, target?.id ?? '')?.state).toBe('outgoing');
    expect(findSlot(placed, target?.id ?? '')?.outcome).toBe('none');
    expect(placed.customers.some((customer) => customer.id === sender.id)).toBe(false);
    expect(placed.stats.served).toBe(1);
  });

  it('rejects a slot that is too small', () => {
    const state = atServe();
    const sender = asSender(activeCustomer(state));
    const tooSmall = state.slots.find(
      (slot) => slot.state === 'empty' && !fits(sender.needsSize, slot.size),
    );
    const tapped = reduce(state, { type: 'tapSlot', slotId: tooSmall?.id ?? '' });
    expect(findSlot(tapped, tooSmall?.id ?? '')?.state).toBe('empty');
    expect(activeCustomer(tapped)?.id).toBe(sender.id);
    expect(activeCustomer(tapped)?.wrongTaps).toBe(1);
    expect(tapped.stats.wrongTaps).toBe(1);
  });

  it('treats a door that is still swinging open as too early, not wrong', () => {
    // A pickup is served first, so one door is `open`; then a sender taps it.
    const pickupProfile = profileWith({
      id: 'test-open-door',
      columns: 2,
      pickups: 2,
      senders: 1,
      lookalikePairs: 0,
      loadMs: 10_000,
      serveMs: 60_000,
      patienceMs: 40_000,
      arrivalWindowMs: 300,
      senderSizeWeights: { A: 1, B: 0, C: 0 },
    });
    const state = reduce(loadAll(started(53, pickupProfile)), { type: 'tick', dtMs: 400 });
    const pickup = asPickup(
      state.customers.find((customer) => customer.visible && customer.kind === 'pickup'),
    );
    const opened = run(
      state,
      { type: 'selectCustomer', customerId: pickup.id },
      { type: 'tapSlot', slotId: customerSlot(state, pickup).id },
    );
    const openSlot = opened.slots.find((slot) => slot.state === 'open');
    expect(openSlot).toBeDefined();

    const sender = asSender(
      opened.customers.find((customer) => customer.visible && customer.kind === 'sender'),
    );
    const selected = reduce(opened, { type: 'selectCustomer', customerId: sender.id });
    const tapped = reduce(selected, { type: 'tapSlot', slotId: openSlot?.id ?? '' });

    expect(tapped.stats.wrongTaps).toBe(0);
    expect(activeCustomer(tapped)?.wrongTaps).toBe(0);
    expect(tapped.cues).toEqual([]);
    expect(findSlot(tapped, openSlot?.id ?? '')?.state).toBe('open');
  });

  it('rejects an occupied slot', () => {
    const state = atServe();
    const full = state.slots.find((slot) => slot.state === 'full');
    const tapped = reduce(state, { type: 'tapSlot', slotId: full?.id ?? '' });
    expect(findSlot(tapped, full?.id ?? '')?.state).toBe('full');
    expect(tapped.stats.wrongTaps).toBe(1);
  });
});

describe('patience', () => {
  // Enough arrivals still to come that SERVE cannot end when someone walks,
  // so the walked state is observable rather than swept past in the same tick.
  const profile = profileWith({
    id: 'test-patience',
    columns: 3,
    pickups: 6,
    senders: 2,
    lookalikePairs: 0,
    loadMs: 10_000,
    serveMs: 90_000,
    patienceMs: 5_000,
    arrivalWindowMs: 60_000,
    senderSizeWeights: { A: 1, B: 0, C: 0 },
  });

  const advanceUntil = (state: State, predicate: (candidate: State) => boolean): State => {
    let current = state;
    for (let i = 0; i < 500 && !predicate(current); i += 1) {
      current = reduce(current, { type: 'tick', dtMs: 100 });
    }
    if (!predicate(current)) {
      throw new Error('the day never reached the state the test needs');
    }
    return current;
  };

  const firstVisible = (state: State, kind: 'pickup' | 'sender') =>
    state.customers.find((customer) => customer.visible && customer.kind === kind);

  it('walks a pickup and leaves their parcel expired', () => {
    const state = advanceUntil(loadAll(started(61, profile)), (candidate) =>
      firstVisible(candidate, 'pickup') !== undefined,
    );
    const pickup = asPickup(firstVisible(state, 'pickup'));
    const slotId = customerSlot(state, pickup).id;
    expect(findSlot(state, slotId)?.state).toBe('full');

    const walked = reduce(state, { type: 'tick', dtMs: profile.patienceMs });
    expect(walked.phase).toBe('SERVE');
    expect(walked.customers.some((customer) => customer.id === pickup.id)).toBe(false);
    expect(findSlot(walked, slotId)?.state).toBe('expired');
    expect(findSlot(walked, slotId)?.outcome).toBe('walked');
    expect(walked.stats.walked).toBeGreaterThanOrEqual(1);
    expect(walked.score).toBe(0);
  });

  it('counts a walked sender as refused', () => {
    const state = advanceUntil(loadAll(started(61, profile)), (candidate) =>
      firstVisible(candidate, 'sender') !== undefined,
    );
    const sender = firstVisible(state, 'sender');
    const walked = reduce(state, { type: 'tick', dtMs: profile.patienceMs });
    expect(walked.customers.some((customer) => customer.id === sender?.id)).toBe(false);
    expect(walked.stats.refused).toBeGreaterThanOrEqual(1);
  });

  it('does not drain patience while a customer is pending', () => {
    const crowded = profileWith({
      id: 'test-pending-patience',
      columns: 3,
      pickups: 6,
      senders: 0,
      lookalikePairs: 0,
      arrivalWindowMs: 200,
      patienceMs: 5_000,
      serveMs: 60_000,
    });
    const state = reduce(loadAll(started(71, crowded)), { type: 'tick', dtMs: 300 });
    const pendingBefore = state.customers.filter((customer) => !customer.visible);
    expect(pendingBefore.length).toBeGreaterThan(0);
    const later = reduce(state, { type: 'tick', dtMs: 2_000 });
    for (const customer of later.customers.filter((entry) => !entry.visible)) {
      expect(customer.waitedMs).toBe(0);
    }
  });
});

describe('SERVE end', () => {
  const profile = profileWith({
    id: 'test-serve-end',
    columns: 2,
    pickups: 2,
    senders: 0,
    lookalikePairs: 0,
    loadMs: 10_000,
    serveMs: 8_000,
    patienceMs: 20_000,
    arrivalWindowMs: 200,
  });

  it('walks everyone still waiting when the timer expires', () => {
    const state = reduce(loadAll(started(81, profile)), { type: 'tick', dtMs: 300 });
    expect(visibleQueue(state)).toHaveLength(2);
    const ended = reduce(state, { type: 'tick', dtMs: profile.serveMs });
    expect(ended.customers).toHaveLength(0);
    expect(ended.stats.walked).toBe(2);
    expect(ended.phase).toBe('SWEEP');
    expect(ended.elapsed.serve).toBe(profile.serveMs);
  });

  it('ends as soon as the last customer is served', () => {
    let state = reduce(loadAll(started(81, profile)), { type: 'tick', dtMs: 300 });
    for (let guard = 0; guard < 10 && state.phase === 'SERVE'; guard += 1) {
      const active = activeCustomer(state);
      if (active === null) {
        break;
      }
      state = reduce(state, { type: 'tapSlot', slotId: customerSlot(state, active).id });
    }
    expect(state.stats.served).toBe(2);
    expect(state.phase).not.toBe('SERVE');
    expect(state.elapsed.serve).toBeLessThan(profile.serveMs);
  });

  it('waits for the schedule: an empty queue with arrivals to come stays in SERVE', () => {
    // Two arrivals, far apart: serve the first and the locker stands empty for
    // a while before the second turns up.
    const spread = profileWith({
      id: 'test-early-end',
      columns: 2,
      pickups: 2,
      senders: 0,
      lookalikePairs: 0,
      loadMs: 10_000,
      serveMs: 90_000,
      patienceMs: 20_000,
      arrivalWindowMs: 60_000,
    });
    let state = loadAll(started(83, spread));
    state = advanceUntilVisible(state);

    const active = activeCustomer(state);
    expect(active).not.toBeNull();
    expect(state.nextArrival).toBeLessThan(state.schedule.length);

    state = reduce(state, { type: 'tapSlot', slotId: customerSlot(state, active).id });
    expect(state.customers).toHaveLength(0);
    expect(state.phase).toBe('SERVE');

    // ... and it still does not end on the next tick.
    state = reduce(state, { type: 'tick', dtMs: 500 });
    expect(state.phase).toBe('SERVE');

    // Only once the last arrival has been admitted and served does SERVE end.
    state = advanceUntilVisible(state);
    state = reduce(state, { type: 'tapSlot', slotId: customerSlot(state, activeCustomer(state)).id });
    expect(state.phase).not.toBe('SERVE');
    expect(state.stats.served).toBe(2);
  });
});

/** Ticks in small steps until somebody is standing at the locker. */
function advanceUntilVisible(state: State): State {
  let current = state;
  for (let i = 0; i < 2_000 && activeCustomer(current) === null; i += 1) {
    current = reduce(current, { type: 'tick', dtMs: 100 });
  }
  if (activeCustomer(current) === null) {
    throw new Error('no customer ever became visible');
  }
  return current;
}

describe('SWEEP', () => {
  const profile = profileWith({
    id: 'test-sweep',
    columns: 2,
    pickups: 2,
    senders: 0,
    lookalikePairs: 0,
    loadMs: 10_000,
    serveMs: 6_000,
    patienceMs: 2_000,
    arrivalWindowMs: 200,
  });

  const atSweep = (): State =>
    run(
      loadAll(started(91, profile)),
      { type: 'tick', dtMs: 300 },
      { type: 'tick', dtMs: profile.serveMs },
    );

  it('marks every outgoing and expired door on entry', () => {
    const state = atSweep();
    expect(state.phase).toBe('SWEEP');
    const marked = state.slots.filter((slot) => slot.state === 'marked');
    expect(marked).toHaveLength(2);
    expect(state.slots.some((slot) => slot.state === 'expired')).toBe(false);
  });

  it('clears marked doors and finishes the day when the last one goes', () => {
    let state = atSweep();
    const marked = state.slots.filter((slot) => slot.state === 'marked').map((slot) => slot.id);
    state = reduce(state, { type: 'tapSlot', slotId: marked[0] ?? '' });
    expect(findSlot(state, marked[0] ?? '')?.state).toBe('empty');
    expect(state.phase).toBe('SWEEP');
    state = reduce(state, { type: 'tapSlot', slotId: marked[1] ?? '' });
    expect(state.phase).toBe('SUMMARY');
  });

  it('ignores taps on unmarked doors', () => {
    const state = atSweep();
    const empty = state.slots.find((slot) => slot.state === 'empty');
    const tapped = reduce(state, { type: 'tapSlot', slotId: empty?.id ?? '' });
    expect({ ...tapped, cues: [] }).toEqual({ ...state, cues: [] });
  });

  it('counts sweep time toward the total', () => {
    const state = reduce(atSweep(), { type: 'tick', dtMs: 3_000 });
    expect(state.elapsed.sweep).toBe(3_000);
    expect(totalTimeMs(state)).toBe(state.elapsed.load + state.elapsed.serve + 3_000);
  });

  it('never lets a broken frame make the day take forever', () => {
    // SWEEP is untimed, so nothing clamps the step the way LOAD and SERVE do.
    const state = reduce(atSweep(), { type: 'tick', dtMs: 3_000 });
    for (const dtMs of [Number.POSITIVE_INFINITY, Number.NaN, -1]) {
      const ticked = reduce(state, { type: 'tick', dtMs });
      expect(ticked.elapsed.sweep).toBe(3_000);
      expect(Number.isFinite(totalTimeMs(ticked))).toBe(true);
    }
  });

  it('is skipped when nothing needs sweeping', () => {
    const clean = profileWith({
      id: 'test-clean',
      columns: 2,
      pickups: 1,
      senders: 0,
      lookalikePairs: 0,
      loadMs: 10_000,
      serveMs: 30_000,
      arrivalWindowMs: 100,
    });
    let state = reduce(loadAll(started(101, clean)), { type: 'tick', dtMs: 200 });
    state = reduce(state, { type: 'tapSlot', slotId: customerSlot(state, activeCustomer(state)).id });
    expect(state.phase).toBe('SUMMARY');
    expect(state.elapsed.sweep).toBe(0);
  });
});

describe('summary', () => {
  const profile = profileWith({
    id: 'test-summary',
    columns: 2,
    pickups: 3,
    senders: 1,
    lookalikePairs: 0,
    loadMs: 4_000,
    serveMs: 6_000,
    patienceMs: 2_000,
    arrivalWindowMs: 200,
  });

  const finished = (): State => {
    let state = run(
      started(111, profile),
      { type: 'tick', dtMs: profile.loadMs },
      { type: 'tick', dtMs: profile.serveMs },
    );
    for (let guard = 0; guard < 50 && state.phase === 'SWEEP'; guard += 1) {
      const marked = state.slots.find((slot) => slot.state === 'marked');
      if (marked === undefined) {
        break;
      }
      state = reduce(state, { type: 'tapSlot', slotId: marked.id });
    }
    return state;
  };

  it('reports every field and a total time', () => {
    const state = finished();
    expect(state.phase).toBe('SUMMARY');
    const summary = state.summary;
    expect(summary).not.toBeNull();
    expect(summary?.score).toBe(state.score);
    expect(summary?.unplaced).toBe(profile.pickups);
    expect(summary?.timeMs).toBe(state.elapsed.load + state.elapsed.serve + state.elapsed.sweep);
    expect(Object.keys(summary?.slotOutcomes ?? {})).toHaveLength(state.slots.length);
    expect(state.cues).toContain('done');
  });

  it('floors the score at zero', () => {
    const state = finished();
    expect(state.score).toBe(0);
    expect(state.score).toBeGreaterThanOrEqual(0);
  });

  it('charges the unplaced penalty per parcel', () => {
    const state = run(started(111, profile), { type: 'tick', dtMs: profile.loadMs });
    expect(state.stats.unplaced).toBe(profile.pickups);
    expect(PENALTY.unplacedParcel).toBe(50);
  });
});

describe('phase order and determinism', () => {
  it('never moves a phase backwards', () => {
    let state = started(777, DAILY_PROFILE);
    const seen: number[] = [phaseRank(state.phase)];
    for (let i = 0; i < 400 && state.phase !== 'SUMMARY'; i += 1) {
      state = reduce(state, { type: 'tick', dtMs: 500 });
      const marked = state.slots.find((slot) => slot.state === 'marked');
      if (state.phase === 'SWEEP' && marked !== undefined) {
        state = reduce(state, { type: 'tapSlot', slotId: marked.id });
      }
      seen.push(phaseRank(state.phase));
    }
    expect(state.phase).toBe('SUMMARY');
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(PHASE_ORDER).toEqual(['LOAD', 'SERVE', 'SWEEP', 'SUMMARY']);
  });

  it('replays an action log to a deep-equal state', () => {
    const log: Action[] = [{ type: 'start' }];
    let state = initialState(777, DAILY_PROFILE);
    state = reduce(state, { type: 'start' });
    for (let i = 0; i < 1_200 && state.phase !== 'SUMMARY'; i += 1) {
      const parcel = currentParcel(state);
      const marked = state.slots.find((slot) => slot.state === 'marked');
      const active = activeCustomer(state);
      let action: Action = { type: 'tick', dtMs: 250 };
      if (state.phase === 'LOAD' && parcel !== null && i % 2 === 0) {
        const slot = state.slots.find(
          (candidate) => candidate.state === 'empty' && fits(parcel.size, candidate.size),
        );
        if (slot !== undefined) {
          action = { type: 'tapSlot', slotId: slot.id };
        }
      } else if (state.phase === 'SERVE' && active !== null && active.kind === 'pickup' && i % 3 === 0) {
        const slot = state.slots.find((candidate) => candidate.parcelId === active.parcelId);
        if (slot !== undefined) {
          action = { type: 'tapSlot', slotId: slot.id };
        }
      } else if (state.phase === 'SWEEP' && marked !== undefined) {
        action = { type: 'tapSlot', slotId: marked.id };
      }
      log.push(action);
      state = reduce(state, action);
    }

    const replay = (): State => log.reduce(reduce, initialState(777, DAILY_PROFILE));
    expect(replay()).toEqual(replay());
    expect(replay()).toEqual(state);
    expect(replay().phase).toBe('SUMMARY');
  });
});
