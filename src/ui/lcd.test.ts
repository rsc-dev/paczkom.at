// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { newGame } from '../core/game.js';
import type { GameState } from '../core/game.js';
import { displayText, litSegments } from './lcd.js';

const game = (over: Partial<GameState>): GameState => ({ ...newGame('A', 1), ...over });
const lit = (over: Partial<GameState>, blink = true) => litSegments({ kind: 'game', state: game(over), blink });

describe('litSegments', () => {
  it('lights the courier at his position with his crate fill', () => {
    const s = lit({ pos: 2, crate: 2 });
    expect(['c-2', 'k-2-1', 'k-2-2'].every((id) => s.has(id))).toBe(true);
    expect(s.has('k-2-3') || s.has('c-3')).toBe(false);
  });

  it('lights throws, drops and the drone above a dropping spot', () => {
    const s = lit({ flights: [{ kind: 'throw', spot: 1, step: 3 }, { kind: 'drop', spot: 3, step: 0 }] });
    expect(['p-1-3', 'q-3-0', 'drone-3'].every((id) => s.has(id))).toBe(true);
  });

  it('shows hearts, the bird, the thrower frame and the level', () => {
    const s = lit({ hearts: 2, bird: { spot: 0, ticks: 3 }, thrower: 1, score: 40 });
    expect(['h-0', 'h-1', 'bird-0', 't-1', 'lv-3', 'lbl-A'].every((id) => s.has(id))).toBe(true);
    expect(s.has('h-2') || s.has('t-0') || s.has('lv-4')).toBe(false);
  });

  it('blinks the broken parcel during the freeze', () => {
    expect(lit({ pause: 2, broken: 2 }, true).has('b-2')).toBe(true);
    expect(lit({ pause: 2, broken: 2 }, false).has('b-2')).toBe(false);
  });
});

describe('displayText', () => {
  it('shows the score right-aligned, the clock, and blinks after the shift', () => {
    expect(displayText({ kind: 'game', state: game({ score: 42 }), blink: true })).toBe('  42');
    expect(displayText({ kind: 'game', state: game({ score: 1234 }), blink: true })).toBe(' 234');
    expect(displayText({ kind: 'game', state: game({ over: true }), blink: false })).toBe('    ');
    expect(displayText({ kind: 'clock', hours: 9, minutes: 5, pos: 3, blink: true })).toBe(' 905');
    expect(displayText({ kind: 'record', mode: 'B', record: 210 })).toBe(' 210');
  });
});
