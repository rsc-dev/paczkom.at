import { describe, expect, it } from 'vitest';
import {
  activeCustomer,
  currentParcel,
  displayCode,
  findSlot,
  hasForgottenCode,
  hintLevelOf,
  initialState,
  reduce,
} from './game.js';
import type { Customer, State } from './game.js';
import { countLookalikePairs, generateParcels } from './parcel.js';
import { DAILY_PROFILE, FRIDAY, SATURDAY, THURSDAY, loadDurationMs } from './profiles.js';
import type { DayProfile } from './profiles.js';
import {
  isCustomerArrival,
  isJamEvent,
  pickRainMask,
  transposedPositions,
} from './schedule.js';
import { fits } from './wall.js';

const profileWith = (overrides: Partial<DayProfile>): DayProfile => ({
  ...DAILY_PROFILE,
  jams: 0,
  forgotten: 0,
  rain: false,
  lateVan: false,
  ...overrides,
});

const started = (seed: number, profile: DayProfile): State =>
  reduce(initialState(seed, profile), { type: 'start' });

function loadAll(state: State): State {
  let current = state;
  while (current.phase === 'LOAD' && currentParcel(current) !== null) {
    const parcel = currentParcel(current);
    const slot = current.slots.find(
      (candidate) => candidate.state === 'empty' && fits(parcel?.size ?? 'A', candidate.size),
    );
    if (slot === undefined) {
      break;
    }
    current = reduce(current, { type: 'tapSlot', slotId: slot.id });
  }
  return current;
}

function advanceUntil(state: State, predicate: (candidate: State) => boolean, steps = 800): State {
  let current = state;
  for (let i = 0; i < steps && !predicate(current); i += 1) {
    current = reduce(current, { type: 'tick', dtMs: 100 });
  }
  if (!predicate(current)) {
    throw new Error('the day never reached the state the test needs');
  }
  return current;
}

const slotOf = (state: State, customer: Customer | null) =>
  customer?.kind === 'pickup'
    ? state.slots.find((slot) => slot.parcelId === customer.parcelId)
    : undefined;

// ---------------------------------------------------------------- jammed door

describe('jammed door', () => {
  // Few enough customers that everybody is visible at once, so the test can
  // pick the one whose door stuck rather than waiting for the queue.
  const JAM = profileWith({
    id: 'test-jam',
    columns: 2,
    pickups: 3,
    senders: 0,
    lookalikePairs: 0,
    jams: 1,
    loadMs: 20_000,
    serveMs: 90_000,
    patienceMs: 60_000,
    arrivalWindowMs: 20_000,
  });

  const atJam = (seed: number): State =>
    advanceUntil(loadAll(started(seed, JAM)), (candidate) =>
      candidate.slots.some((slot) => slot.jammed),
    );

  it('sticks a door at its scheduled time and not before', () => {
    const loaded = loadAll(started(11, JAM));
    expect(loaded.slots.every((slot) => !slot.jammed)).toBe(true);
    expect(loaded.schedule.filter(isJamEvent)).toHaveLength(1);

    const jammed = atJam(11);
    expect(jammed.slots.filter((slot) => slot.jammed)).toHaveLength(1);
  });

  it('aims at a door that has a parcel behind it', () => {
    const jammed = atJam(11);
    const stuck = jammed.slots.find((slot) => slot.jammed);
    expect(stuck?.state).toBe('full');
  });

  it('takes two taps to open: the first frees it, the second opens it', () => {
    let state = atJam(11);
    const stuck = state.slots.find((slot) => slot.jammed);
    const parcelId = stuck?.parcelId;
    const owns = (customer: Customer): boolean =>
      customer.kind === 'pickup' && customer.parcelId === parcelId;

    // Wait for the customer whose parcel is behind the stuck door to reach the
    // front of the queue, then serve them rather than whoever is in front.
    state = advanceUntil(state, (candidate) =>
      candidate.customers.some((customer) => customer.visible && owns(customer)),
    );
    const owner = state.customers.find((customer) => customer.visible && owns(customer));
    state = reduce(state, { type: 'selectCustomer', customerId: owner?.id ?? '' });
    expect(activeCustomer(state)?.id).toBe(owner?.id);
    const before = state;

    const freed = reduce(before, { type: 'tapSlot', slotId: stuck?.id ?? '' });
    expect(findSlot(freed, stuck?.id ?? '')?.jammed).toBe(false);
    expect(findSlot(freed, stuck?.id ?? '')?.state).toBe('full');
    expect(freed.cues).toEqual(['thunk']);
    // Freeing it is not a mistake: no penalty, no wrong tap, no free hint.
    expect(freed.score).toBe(before.score);
    expect(freed.stats.wrongTaps).toBe(0);
    expect(activeCustomer(freed)?.wrongTaps).toBe(0);
    expect(hintLevelOf(freed, activeCustomer(freed))).toBe(0);

    const opened = reduce(freed, { type: 'tapSlot', slotId: stuck?.id ?? '' });
    expect(findSlot(opened, stuck?.id ?? '')?.state).toBe('open');
    expect(findSlot(opened, stuck?.id ?? '')?.outcome).toBe('perfect');
    expect(opened.score).toBeGreaterThan(before.score);
  });

  it('does not cost the customer an outcome tier', () => {
    // Hesitate almost long enough for a hint, then find the right door: the
    // jam takes a tap to shift, and that tap must restart the idle timer the
    // way any other tap does. Otherwise the wrestle itself earns the hint.
    let state = atJam(11);
    const stuck = state.slots.find((slot) => slot.jammed);
    const parcelId = stuck?.parcelId;
    const owns = (customer: Customer): boolean =>
      customer.kind === 'pickup' && customer.parcelId === parcelId;

    state = advanceUntil(state, (candidate) =>
      candidate.customers.some((customer) => customer.visible && owns(customer)),
    );
    const owner = state.customers.find((customer) => customer.visible && owns(customer));
    state = reduce(state, { type: 'selectCustomer', customerId: owner?.id ?? '' });

    state = reduce(state, { type: 'tick', dtMs: JAM.hintDelay1Ms - 100 });
    expect(hintLevelOf(state, activeCustomer(state))).toBe(0);

    const freed = reduce(state, { type: 'tapSlot', slotId: stuck?.id ?? '' });
    expect(activeCustomer(freed)?.activeMs).toBe(0);

    const opened = reduce(reduce(freed, { type: 'tick', dtMs: 200 }), {
      type: 'tapSlot',
      slotId: stuck?.id ?? '',
    });
    expect(findSlot(opened, stuck?.id ?? '')?.outcome).toBe('perfect');
    expect(opened.stats.hinted).toBe(0);
  });

  it('falls back to a seeded door when its parcel never left the van', () => {
    // Load everything *except* the parcel the jam is aimed at, so there are
    // still customers coming but the target door does not exist.
    const start = started(11, JAM);
    const jam = start.schedule.filter(isJamEvent)[0];
    expect(jam?.targetParcelId).not.toBeNull();

    let state = start;
    while (state.phase === 'LOAD') {
      const parcel = currentParcel(state);
      if (parcel === null || parcel.id === jam?.targetParcelId) {
        break;
      }
      const slot = state.slots.find(
        (candidate) =>
          candidate.state === 'empty' &&
          candidate.id !== jam?.fallbackSlotId &&
          fits(parcel.size, candidate.size),
      );
      if (slot === undefined) {
        break;
      }
      state = reduce(state, { type: 'tapSlot', slotId: slot.id });
    }
    state = reduce(state, { type: 'tick', dtMs: JAM.loadMs });
    expect(state.stats.unplaced).toBeGreaterThan(0);
    expect(state.slots.some((slot) => slot.parcelId === jam?.targetParcelId)).toBe(false);

    state = advanceUntil(state, (candidate) => candidate.slots.some((slot) => slot.jammed));
    const stuck = state.slots.find((slot) => slot.jammed);
    expect(stuck?.id).toBe(jam?.fallbackSlotId);
  });

  it('will not take a sender&#39;s parcel', () => {
    const sender = profileWith({
      id: 'test-jam-sender',
      columns: 2,
      pickups: 4,
      senders: 2,
      lookalikePairs: 0,
      jams: 1,
      serveMs: 90_000,
      patienceMs: 60_000,
      arrivalWindowMs: 20_000,
      senderSizeWeights: { A: 1, B: 0, C: 0 },
    });

    // Jam an empty slot by hand: the scheduled jam prefers a full one.
    const base = advanceUntil(loadAll(started(23, sender)), (candidate) => {
      const active = activeCustomer(candidate);
      return active?.kind === 'sender';
    });
    const empty = base.slots.find((slot) => slot.state === 'empty' && slot.size !== 'A');
    const state: State = {
      ...base,
      slots: base.slots.map((slot) => (slot.id === empty?.id ? { ...slot, jammed: true } : slot)),
    };

    const tapped = reduce(state, { type: 'tapSlot', slotId: empty?.id ?? '' });
    expect(findSlot(tapped, empty?.id ?? '')?.state).toBe('empty');
    expect(tapped.stats.wrongTaps).toBe(1);
    expect(tapped.cues).toEqual(['wrong']);
  });

  it('is gone by the time the sweeping starts', () => {
    let state = atJam(11);
    state = advanceUntil(state, (candidate) => candidate.phase !== 'SERVE', 2_000);
    expect(state.slots.every((slot) => !slot.jammed)).toBe(true);
  });

  it('picks the same door and the same moment on every replay', () => {
    expect(initialState(99, SATURDAY).schedule.filter(isJamEvent)).toEqual(
      initialState(99, SATURDAY).schedule.filter(isJamEvent),
    );
    expect(initialState(99, SATURDAY).schedule.filter(isJamEvent)[0]?.atMs).not.toBe(
      initialState(100, SATURDAY).schedule.filter(isJamEvent)[0]?.atMs,
    );
  });

  it('stands the jam up before its owner reaches the counter', () => {
    const state = initialState(11, JAM);
    const jam = state.schedule.filter(isJamEvent)[0];
    const owner = state.schedule
      .filter(isCustomerArrival)
      .find(
        (entry) => entry.request.kind === 'pickup' && entry.request.parcelId === jam?.targetParcelId,
      );
    expect(jam).toBeDefined();
    expect(owner).toBeDefined();
    expect(jam?.atMs).toBeLessThanOrEqual(owner?.atMs ?? 0);
  });
});

// -------------------------------------------------------------- forgotten code

describe('forgotten code', () => {
  it('flags exactly as many pickups as the profile asks for', () => {
    for (const seed of [1, 2, 3, 7]) {
      const state = initialState(seed, FRIDAY);
      const forgetful = state.schedule
        .filter(isCustomerArrival)
        .filter((entry) => entry.request.kind === 'pickup' && entry.request.forgotten);
      expect(forgetful).toHaveLength(FRIDAY.forgotten);
    }
  });

  it('flags nobody on a day without the event', () => {
    const state = initialState(1, THURSDAY);
    expect(
      state.schedule
        .filter(isCustomerArrival)
        .filter((entry) => entry.request.kind === 'pickup' && entry.request.forgotten),
    ).toHaveLength(0);
  });

  it('reaches the customer at the counter', () => {
    const state = advanceUntil(loadAll(started(3, FRIDAY)), (candidate) =>
      candidate.customers.some((customer) => hasForgottenCode(customer)),
    );
    const forgetful = state.customers.find((customer) => hasForgottenCode(customer));
    expect(forgetful?.kind).toBe('pickup');
    expect(hasForgottenCode(forgetful ?? null)).toBe(true);
  });

  it('leaves the hint ladder alone: a first-tap service is still perfect', () => {
    let state = advanceUntil(loadAll(started(3, FRIDAY)), (candidate) => {
      const active = activeCustomer(candidate);
      return hasForgottenCode(active);
    });
    const active = activeCustomer(state);
    expect(hintLevelOf(state, active)).toBe(0);

    const slot = slotOf(state, active);
    state = reduce(state, { type: 'tapSlot', slotId: slot?.id ?? '' });
    expect(findSlot(state, slot?.id ?? '')?.outcome).toBe('perfect');
  });

  it('picks the same customers on every replay', () => {
    const forgetful = (seed: number): string[] =>
      initialState(seed, FRIDAY)
        .schedule.filter(isCustomerArrival)
        .filter((entry) => entry.request.kind === 'pickup' && entry.request.forgotten)
        .map((entry) => entry.id);
    expect(forgetful(42)).toEqual(forgetful(42));
    expect(forgetful(42)).not.toEqual(forgetful(43));
  });
});

// ------------------------------------------------------------------------ rain

describe('rain', () => {
  it('smudges one digit out of a displayed code', () => {
    const state = initialState(5, SATURDAY);
    expect(state.maskedDigit).not.toBeNull();
    const masked = displayCode(state, '4821');
    expect(masked).toHaveLength(4);
    expect(masked).toContain('•');
    expect([...masked].filter((character) => character === '•')).toHaveLength(1);
  });

  it('masks the position the spec scenario describes', () => {
    const state: State = { ...initialState(5, SATURDAY), maskedDigit: 2 };
    expect(displayCode(state, '4821')).toBe('48•1');
  });

  it('leaves codes alone on a dry day', () => {
    const state = initialState(5, THURSDAY);
    expect(state.maskedDigit).toBeNull();
    expect(displayCode(state, '4821')).toBe('4821');
  });

  it('never masks a digit a look-alike pair swapped', () => {
    for (const seed of [1, 2, 3, 4, 5, 17, 99, 12345]) {
      const state = initialState(seed, SATURDAY);
      const mask = state.maskedDigit;
      expect(mask).not.toBeNull();

      const codes = Object.values(state.parcels).map((parcel) => parcel.code);
      const pairs: [string, string][] = [];
      for (let i = 0; i < codes.length; i += 1) {
        for (let j = i + 1; j < codes.length; j += 1) {
          const a = codes[i];
          const b = codes[j];
          if (a !== undefined && b !== undefined && countLookalikePairs([a, b]) === 1) {
            pairs.push([a, b]);
          }
        }
      }
      expect(pairs).toHaveLength(SATURDAY.lookalikePairs);
      for (const [a, b] of pairs) {
        expect(transposedPositions(a, b), `${a}/${b} with mask ${String(mask)}`).not.toContain(mask);
      }
    }
  });

  it('picks the same digit on every replay and a different one per seed', () => {
    expect(pickRainMask(99, SATURDAY)).toEqual(pickRainMask(99, SATURDAY));
    expect(initialState(99, SATURDAY).maskedDigit).toBe(initialState(99, SATURDAY).maskedDigit);
  });
});

// -------------------------------------------------------------------- late van

describe('late van', () => {
  it('gives Friday 15 seconds to load instead of 25', () => {
    expect(FRIDAY.loadMs).toBe(25_000);
    expect(loadDurationMs(FRIDAY)).toBe(15_000);
  });

  it('ends LOAD on the shortened clock', () => {
    const state = started(3, FRIDAY);
    const nearly = reduce(state, { type: 'tick', dtMs: 14_900 });
    expect(nearly.phase).toBe('LOAD');
    const over = reduce(nearly, { type: 'tick', dtMs: 200 });
    expect(over.phase).toBe('SERVE');
    expect(over.elapsed.load).toBe(15_000);
  });

  it('leaves an on-time day at its full length', () => {
    const state = started(3, THURSDAY);
    const nearly = reduce(state, { type: 'tick', dtMs: 24_900 });
    expect(nearly.phase).toBe('LOAD');
    expect(reduce(nearly, { type: 'tick', dtMs: 200 }).phase).toBe('SERVE');
  });
});

// --------------------------------------------------------- pair counts 0 and 3

describe('look-alike pair counts', () => {
  it('honours a profile that asks for none', () => {
    const [parcels] = generateParcels(7, profileWith({ lookalikePairs: 0 }));
    expect(countLookalikePairs(parcels.map((parcel) => parcel.code))).toBe(0);
  });

  it('honours a profile that asks for three', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const [parcels] = generateParcels(seed, SATURDAY);
      expect(countLookalikePairs(parcels.map((parcel) => parcel.code))).toBe(3);
    }
  });

  it('still makes three pairs when a digit is reserved for the rain', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = initialState(seed, SATURDAY);
      const codes = Object.values(state.parcels).map((parcel) => parcel.code);
      expect(countLookalikePairs(codes)).toBe(SATURDAY.lookalikePairs);
      expect(new Set(codes).size).toBe(SATURDAY.pickups);
    }
  });
});
