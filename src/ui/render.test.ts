// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activeCustomer, currentParcel, initialState, reduce } from '../core/game.js';
import type { State } from '../core/game.js';
import { DAILY_PROFILE } from '../core/profiles.js';
import { fits } from '../core/wall.js';
import { setLang } from '../i18n/index.js';
import { createGameView, doorLabel, renderGame } from './render.js';
import type { GameView } from './render.js';
import { mountApp, recordMutations } from './testing.js';

let view: GameView;
let state: State;

const started = (seed: number): State => reduce(initialState(seed, DAILY_PROFILE), { type: 'start' });

function placeNext(current: State): State {
  const parcel = currentParcel(current);
  if (parcel === null) {
    return current;
  }
  const slot = current.slots.find((candidate) => candidate.state === 'empty' && fits(parcel.size, candidate.size));
  return slot === undefined ? current : reduce(current, { type: 'tapSlot', slotId: slot.id });
}

beforeEach(() => {
  setLang('pl');
  mountApp();
  state = started(7);
  view = createGameView(document, state);
  renderGame(view, state);
});

afterEach(() => {
  setLang('pl');
});

describe('door rendering', () => {
  it('reflects a slot moving from empty to full and touches nothing else', () => {
    const parcel = currentParcel(state);
    const target = state.slots.find(
      (slot) => slot.state === 'empty' && fits(parcel?.size ?? 'A', slot.size),
    );
    const recorder = recordMutations(view.stage);

    const next = reduce(state, { type: 'tapSlot', slotId: target?.id ?? '' });
    renderGame(view, next);

    expect(view.doors.get(target?.id ?? '')?.root.dataset['state']).toBe('full');

    // Only the tapped door changed; the screen panel is expected to move on.
    const touchedDoors = new Set(
      recorder
        .changed()
        .map((entry) => entry.split(':')[0] ?? '')
        .filter((id) => /^c\d+r\d+$/.test(id)),
    );
    recorder.stop();
    expect([...touchedDoors]).toEqual([target?.id]);

    for (const slot of next.slots) {
      expect(view.doors.get(slot.id)?.root.dataset['state']).toBe(slot.state);
    }
  });

  it('writes an accessible label containing the slot id', () => {
    const label = view.doors.get('c1r2')?.root.getAttribute('aria-label') ?? '';
    expect(label).toContain('c1r2');
    expect(label).toContain('rozmiar');
    expect(doorLabel(state.slots[9]!)).toContain(state.slots[9]!.id);
  });

  it('relabels every door when the language changes', () => {
    setLang('en');
    renderGame(view, state);
    const label = view.doors.get('c1r2')?.root.getAttribute('aria-label') ?? '';
    expect(label).toContain('Box c1r2');
    expect(label).toContain('size');
  });

  it('marks the whole hinted column and nothing outside it', () => {
    let next = state;
    while (next.phase === 'LOAD' && currentParcel(next) !== null) {
      next = placeNext(next);
    }
    // Idle until somebody is being served with a level-2 hint.
    for (let i = 0; i < 400 && next.phase === 'SERVE'; i += 1) {
      next = reduce(next, { type: 'tick', dtMs: 250 });
      const active = activeCustomer(next);
      if (active?.kind === 'pickup' && active.hintLevel === 2) {
        break;
      }
    }
    const active = activeCustomer(next);
    expect(active?.kind).toBe('pickup');

    renderGame(view, next);
    const hinted = [...view.doors.values()].filter(
      (door) => door.root.dataset['hint'] === 'column',
    );
    expect(hinted).toHaveLength(7);
    expect(new Set(hinted.map((door) => door.slot.col)).size).toBe(1);
  });
});

describe('tray rendering', () => {
  it('shows the next parcels during LOAD and nothing interactive', () => {
    const cards = view.cards.filter((card) => !card.root.hidden);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.root.dataset['upcoming']).toBe('true');
      expect(card.root.disabled).toBe(true);
      expect(card.root.dataset['customer']).toBeUndefined();
    }
  });

  it('shows the visible customers during SERVE, with the active one marked', () => {
    let next = state;
    while (next.phase === 'LOAD' && currentParcel(next) !== null) {
      next = placeNext(next);
    }
    for (let i = 0; i < 200 && activeCustomer(next) === null; i += 1) {
      next = reduce(next, { type: 'tick', dtMs: 250 });
    }
    renderGame(view, next);

    const cards = view.cards.filter((card) => !card.root.hidden);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.filter((card) => card.root.dataset['active'] === 'true')).toHaveLength(1);
    expect(cards[0]?.root.dataset['customer']).toBe(activeCustomer(next)?.id);
    expect(cards[0]?.root.disabled).toBe(false);
  });
});

