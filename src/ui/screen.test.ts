// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { activeCustomer, currentParcel, initialState, reduce } from '../core/game.js';
import type { Customer, State } from '../core/game.js';
import { DAILY_PROFILE, FRIDAY } from '../core/profiles.js';
import { fits } from '../core/wall.js';
import { colourName, setLang } from '../i18n/index.js';
import { panelContent, renderPanel } from './screen.js';
import { need } from './dom.js';
import { mountApp } from './testing.js';

const started = (seed: number, profile = DAILY_PROFILE): State =>
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

function asPickup(customer: Customer | null): Extract<Customer, { kind: 'pickup' }> {
  if (customer === null || customer.kind !== 'pickup') {
    throw new Error('expected a pickup customer at the counter');
  }
  return customer;
}

/** True once a customer who has lost their code is the one being served. */
const forgottenAtCounter = (candidate: State): boolean => {
  const active = activeCustomer(candidate);
  return active !== null && active.kind === 'pickup' && active.forgotten;
};

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
    expect(content.hint?.sticker).toBe(parcel?.sticker);
    expect(content.hint?.text.length).toBeGreaterThan(0);
    expect(content.wait).toBeNull();
  });
});

describe('panel during SERVE', () => {
  /** The first *pickup* to reach the counter, so the test cannot pass vacuously. */
  const servingPickup = (): State =>
    advanceUntil(loadAll(started(7)), (candidate) => activeCustomer(candidate)?.kind === 'pickup');

  it('shows the code and nothing else at hint level 0', () => {
    const state = servingPickup();
    const active = asPickup(activeCustomer(state));
    const content = panelContent(state);
    expect(active.hintLevel).toBe(0);
    expect(content.code).toBe(state.parcels[active.parcelId]?.code);
    expect(content.hint).toBeNull();
    expect(content.wait).toBeCloseTo(1 - active.waitedMs / DAILY_PROFILE.patienceMs);
  });

  it('reveals the colour and sticker once the ladder moves', () => {
    const state = advanceUntil(servingPickup(), (candidate) => {
      const active = activeCustomer(candidate);
      return active?.kind === 'pickup' && active.hintLevel >= 1;
    });
    const active = asPickup(activeCustomer(state));
    const content = panelContent(state);
    const parcel = state.parcels[active.parcelId];
    expect(parcel).toBeDefined();
    expect(content.hint?.colour).toBe(parcel?.colour);
    // The theme draws the sticker from this; the prose line names it too.
    expect(content.hint?.sticker).toBe(parcel?.sticker);
    expect(content.hint?.text).toContain(colourName(parcel?.colour ?? 'red', 'pl'));
  });

  it('asks for a box of the right size for a sender', () => {
    const state = advanceUntil(
      loadAll(started(7)),
      (candidate) => activeCustomer(candidate)?.kind === 'sender',
    );
    const active = activeCustomer(state);
    expect(active?.kind).toBe('sender');
    setLang('en');
    const content = panelContent(state);
    expect(content.prose).toBe(true);
    expect(content.hint).toBeNull();
    const needsSize = active?.kind === 'sender' ? active.needsSize : 'A';
    expect(content.code.toLowerCase()).toContain(
      needsSize === 'A' ? 'small' : needsSize === 'B' ? 'medium' : 'large',
    );
  });

  it('shows no digits for a customer who forgot their code, only a description', () => {
    setLang('en');
    const state = advanceUntil(loadAll(started(3, FRIDAY)), forgottenAtCounter);
    const active = asPickup(activeCustomer(state));
    expect(active.forgotten).toBe(true);
    const parcel = state.parcels[active.parcelId];
    const content = panelContent(state);

    // Prose where the code would be, and not a digit in sight.
    expect(content.prose).toBe(true);
    expect(content.code).toBe('Cannot remember the code');
    expect(content.code).not.toMatch(/\d/);
    expect(content.code).not.toContain(parcel?.code ?? '');

    // ... and the description they *can* give: size, colour, sticker.
    expect(content.hint).not.toBeNull();
    expect(content.hint?.colour).toBe(parcel?.colour);
    expect(content.hint?.sticker).toBe(parcel?.sticker);
    expect(content.hint?.text).toContain(colourName(parcel?.colour ?? 'red', 'en'));
    // The hint ladder has not moved: the description is theirs from the start.
    expect(active.hintLevel).toBe(0);
  });

  it('writes the forgotten description into the panel', () => {
    setLang('en');
    const state = advanceUntil(loadAll(started(3, FRIDAY)), forgottenAtCounter);
    mountApp();
    const nodes = panelNodes(document);
    renderPanel(nodes, state);

    expect(nodes.code.textContent).toBe('Cannot remember the code');
    expect(nodes.code.dataset['empty']).toBe('true');
    expect(nodes.hint.hidden).toBe(false);
    expect(nodes.hintText.textContent).not.toBe('');
    expect(nodes.swatch.dataset['colour']).not.toBe('');
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

/** The panel's nodes, as `createGameView` would find them. */
function panelNodes(root: ParentNode) {
  return {
    root: need<HTMLElement>(root, '#panel'),
    kicker: need<HTMLElement>(root, '#panel-kicker'),
    code: need<HTMLElement>(root, '#panel-code'),
    hint: need<HTMLElement>(root, '#panel-hint'),
    swatch: need<HTMLElement>(root, '#panel-swatch'),
    sticker: need<HTMLElement>(root, '#panel-sticker'),
    stickerName: need<HTMLElement>(root, '#panel-sticker-name'),
    hintText: need<HTMLElement>(root, '#panel-hint-text'),
    wait: need<HTMLElement>(root, '#panel-wait'),
  };
}
