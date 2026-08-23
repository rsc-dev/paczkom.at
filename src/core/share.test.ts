import { describe, expect, it } from 'vitest';
import { initialState } from './game.js';
import type { SlotOutcome } from './game.js';
import { DAILY_PROFILE } from './profiles.js';
import {
  OUTCOME_EMOJI,
  SHARE_URL,
  buildGrid,
  buildShareText,
  formatTime,
} from './share.js';
import { buildWall } from './wall.js';

const PL = { mode: 'Dzisiaj', points: 'pkt' };
const EN = { mode: 'Today', points: 'pts' };

const outcomesFrom = (overrides: Record<string, SlotOutcome> = {}): Record<string, SlotOutcome> => {
  const base: Record<string, SlotOutcome> = Object.fromEntries(
    buildWall(3).map((slot) => [slot.id, 'none']),
  );
  return { ...base, ...overrides };
};

describe('buildGrid', () => {
  it('has one line per column and one emoji per slot', () => {
    const grid = buildGrid(buildWall(3), outcomesFrom());
    expect(grid).toHaveLength(3);
    for (const line of grid) {
      expect([...line]).toHaveLength(7);
    }
  });

  it('follows the wall order, top to bottom within a column', () => {
    const grid = buildGrid(buildWall(3), outcomesFrom({ c1r0: 'hinted' }));
    expect([...(grid[1] ?? '')][0]).toBe(OUTCOME_EMOJI.hinted);
    expect([...(grid[0] ?? '')][0]).toBe(OUTCOME_EMOJI.none);
  });

  it('maps every outcome to its emoji', () => {
    const grid = buildGrid(
      buildWall(3),
      outcomesFrom({ c0r0: 'perfect', c0r1: 'hinted', c0r2: 'walked' }),
    );
    expect([...(grid[0] ?? '')].slice(0, 4)).toEqual([
      OUTCOME_EMOJI.perfect,
      OUTCOME_EMOJI.hinted,
      OUTCOME_EMOJI.walked,
      OUTCOME_EMOJI.none,
    ]);
    expect(OUTCOME_EMOJI).toEqual({
      perfect: '📦',
      hinted: '🟧',
      walked: '🟥',
      none: '⬜',
    });
  });

  it('adapts to a wall of a different width', () => {
    const wall = buildWall(5);
    const grid = buildGrid(wall, Object.fromEntries(wall.map((slot) => [slot.id, 'none'])));
    expect(grid).toHaveLength(5);
  });

  it('reads a real day state', () => {
    const state = initialState(1, DAILY_PROFILE);
    const grid = buildGrid(state.slots, Object.fromEntries(state.slots.map((s) => [s.id, s.outcome])));
    expect(grid.join('\n')).toBe([OUTCOME_EMOJI.none.repeat(7)].concat(
      OUTCOME_EMOJI.none.repeat(7),
      OUTCOME_EMOJI.none.repeat(7),
    ).join('\n'));
  });
});

describe('formatTime', () => {
  it.each([
    [107_000, '1:47'],
    [0, '0:00'],
    [59_999, '0:59'],
    [60_000, '1:00'],
    [600_000, '10:00'],
    [3_661_000, '61:01'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatTime(ms)).toBe(expected);
  });

  it('clamps a negative time', () => {
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('buildShareText', () => {
  const grid = ['📦📦🟧📦📦📦📦', '📦🟥📦📦📦⬜⬜', '📦📦📦📦⬜⬜⬜'];

  it('matches the Polish share card from the design', () => {
    expect(
      buildShareText({ labels: PL, number: 12, grid, score: 1240, timeMs: 107_000 }),
    ).toBe(
      ['paczkom.at · Dzisiaj #12', ...grid, '1240 pkt · 1:47', 'https://paczkom.at'].join('\n'),
    );
  });

  it('localises only the label, never the grid or the URL', () => {
    const text = buildShareText({ labels: EN, number: 12, grid, score: 1240, timeMs: 107_000 });
    expect(text.split('\n')[0]).toBe('paczkom.at · Today #12');
    expect(text.split('\n').slice(1, 4)).toEqual(grid);
    expect(text.endsWith(SHARE_URL)).toBe(true);
    expect(text).toContain('1240 pts · 1:47');
  });
});
