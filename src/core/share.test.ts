import { describe, expect, it } from 'vitest';
import { initialState } from './game.js';
import type { SlotOutcome } from './game.js';
import { DAILY_PROFILE } from './profiles.js';
import {
  OUTCOME_EMOJI,
  SHARE_URL,
  buildGrid,
  buildShareText,
  buildWeekShareText,
  formatTime,
  weekUrl,
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

describe('buildWeekShareText', () => {
  const day = (label: string, stars: number, score: number) => ({
    label,
    stars,
    score,
    failed: false,
  });

  it('matches the Polish week card from the design', () => {
    expect(
      buildWeekShareText({
        modeLabel: 'Tydzień',
        totalLabel: 'Razem',
        points: 'pkt',
        seed: 'k3j9x',
        days: [
          day('Pn', 3, 1240),
          day('Wt', 3, 1380),
          day('Śr', 2, 1610),
          day('Cz', 2, 1720),
          day('Pt', 1, 1950),
          { label: 'So', stars: 0, score: 0, failed: true },
        ],
      }),
    ).toBe(
      [
        'paczkom.at · Tydzień',
        'Pn ⭐⭐⭐ 1240',
        'Wt ⭐⭐⭐ 1380',
        'Śr ⭐⭐ 1610',
        'Cz ⭐⭐ 1720',
        'Pt ⭐ 1950',
        'So ❌',
        'Razem 7900 pkt',
        'https://paczkom.at/?week=k3j9x',
      ].join('\n'),
    );
  });

  it('has one line per day and ends with the link that replays it', () => {
    const text = buildWeekShareText({
      modeLabel: 'Week',
      totalLabel: 'Total',
      points: 'pts',
      seed: 'k3j9x',
      days: Array.from({ length: 6 }, (_unused, i) => day('Mo', 3, 100 * i)),
    });
    expect(text.split('\n')).toHaveLength(9);
    expect(text.endsWith(weekUrl('k3j9x'))).toBe(true);
    expect(text).toContain('https://paczkom.at/?week=k3j9x');
  });

  it('stops at the day a failed week ran out on', () => {
    const text = buildWeekShareText({
      modeLabel: 'Tydzień',
      totalLabel: 'Razem',
      points: 'pkt',
      seed: 'abc',
      days: [
        day('Pn', 3, 100),
        day('Wt', 3, 100),
        day('Śr', 2, 100),
        day('Cz', 1, 100),
        { label: 'Pt', stars: 0, score: 100, failed: true },
      ],
    });
    const lines = text.split('\n');
    // Header, five days, total, URL — no Saturday.
    expect(lines).toHaveLength(8);
    expect(lines[5]).toBe('Pt ❌');
    expect(text).not.toContain('So');
  });

  it('leaves the day labels to the caller and the emoji alone', () => {
    const text = buildWeekShareText({
      modeLabel: 'Week',
      totalLabel: 'Total',
      points: 'pts',
      seed: 'abc',
      days: [day('Mon', 3, 10)],
    });
    expect(text).toContain('Mon ⭐⭐⭐ 10');
  });

  it('adds the days up above the link, failed day included', () => {
    const lines = buildWeekShareText({
      modeLabel: 'Week',
      totalLabel: 'Total',
      points: 'pts',
      seed: 'abc',
      days: [day('Mon', 3, 1200), { label: 'Tue', stars: 0, score: 300, failed: true }],
    }).split('\n');
    expect(lines.at(-2)).toBe('Total 1500 pts');
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
