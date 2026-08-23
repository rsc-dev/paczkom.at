import { afterEach, describe, expect, it } from 'vitest';
import { activeCustomer, currentParcel, initialState, reduce } from '../core/game.js';
import type { State } from '../core/game.js';
import { DAILY_PROFILE } from '../core/profiles.js';
import { fits } from '../core/wall.js';
import { colourName, setLang } from '../i18n/index.js';
import { panelContent } from './screen.js';

const started = (seed: number): State => reduce(initialState(seed, DAILY_PROFILE), { type: 'start' });

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

function advanceUntil(state: State, predicate: (candidate: State) => boolean): State {
  let current = state;
  for (let i = 0; i < 600 && !predicate(current); i += 1) {
    current = reduce(current, { type: 'tick', dtMs: 250 });
  }
  if (!predicate(current)) {
    throw new Error('the day never reached the state the test needs');
  }
  return current;
}

afterEach(() => {
  setLang('pl');
});

describe('panel during LOAD', () => {
  it('shows the parcel in hand: its code, colour and sticker', () => {
    const state = started(7);
    const parcel = currentParcel(state);
    const content = panelContent(state);
    expect(content.code).toBe(parcel?.code);
    expect(content.prose).toBe(false);
    expect(content.hint?.colour).toBe(parcel?.colour);
    expect(content.hint?.text.length).toBeGreaterThan(0);
    expect(content.wait).toBeNull();
  });
});

describe('panel during SERVE', () => {
  const serving = (): State =>
    advanceUntil(loadAll(started(7)), (candidate) => activeCustomer(candidate) !== null);

  it('shows the code and nothing else at hint level 0', () => {
    const state = serving();
    const active = activeCustomer(state);
    if (active?.kind !== 'pickup') {
      return;
    }
    const content = panelContent(state);
    expect(content.code).toBe(state.parcels[active.parcelId]?.code);
    expect(content.hint).toBeNull();
    expect(content.wait).toBeCloseTo(1 - active.waitedMs / DAILY_PROFILE.patienceMs);
  });

  it('reveals the colour and sticker once the ladder moves', () => {
    const state = advanceUntil(serving(), (candidate) => {
      const active = activeCustomer(candidate);
      return active?.kind === 'pickup' && active.hintLevel >= 1;
    });
    const active = activeCustomer(state);
    const content = panelContent(state);
    const parcel = active?.kind === 'pickup' ? state.parcels[active.parcelId] : undefined;
    expect(parcel).toBeDefined();
    expect(content.hint?.colour).toBe(parcel?.colour);
    // The hint line names the colour in the current language.
    expect(content.hint?.text).toContain(
      colourName(parcel?.colour ?? 'red', 'pl'),
    );
  });

  it('asks for a box of the right size for a sender', () => {
    const state = advanceUntil(loadAll(started(7)), (candidate) => {
      const active = activeCustomer(candidate);
      return active?.kind === 'sender';
    });
    const active = activeCustomer(state);
    setLang('en');
    const content = panelContent(state);
    expect(content.prose).toBe(true);
    expect(content.hint).toBeNull();
    if (active?.kind === 'sender') {
      expect(content.code.toLowerCase()).toContain(
        active.needsSize === 'A' ? 'small' : active.needsSize === 'B' ? 'medium' : 'large',
      );
    }
  });

  it('says so when nobody is at the locker', () => {
    setLang('en');
    const idle: State = { ...started(7), phase: 'SERVE' };
    expect(panelContent(idle).code).toBe('Nobody here. For now.');
    expect(panelContent(idle).wait).toBeNull();
  });
});

describe('panel during SWEEP', () => {
  it('asks for the marked boxes and counts them down', () => {
    setLang('en');
    const state: State = { ...started(7), phase: 'SWEEP' };
    const marked: State = {
      ...state,
      slots: state.slots.map((slot, index) => (index < 3 ? { ...slot, state: 'marked' } : slot)),
    };
    const content = panelContent(marked);
    expect(content.code).toBe('Clear the marked boxes');
    expect(content.hint?.text).toBe('Left: 3');
    expect(content.hint?.colour).toBeNull();
  });
});
