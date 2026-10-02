import { describe, expect, it } from 'vitest';
import { EMPTY_HISTORY, appendHistory, levelYesterday, parseHistory, worstToday } from './history.js';
import type { History } from './history.js';

const H = 3_600_000;
const at = (iso: string): number => Date.parse(iso);

function build(points: [string, number | null][]): History {
  return points.reduce(
    (history, [iso, level]) => appendHistory(history, { at: at(iso), levels: { krakow: level as never } }),
    EMPTY_HISTORY,
  );
}

describe('parseHistory', () => {
  it.each([undefined, null, 'x', {}, { version: 2, entries: [] }, { version: 1, entries: 'nope' }])(
    'falls back to empty for %j',
    (value) => {
      expect(parseHistory(value)).toEqual(EMPTY_HISTORY);
    },
  );

  it('drops malformed entries and keeps good ones', () => {
    const parsed = parseHistory({
      version: 1,
      entries: [{ at: 5, levels: { a: 3 } }, { at: 'x', levels: {} }, { at: 6, levels: { b: 9 } }],
    });
    expect(parsed.entries).toEqual([{ at: 5, levels: { a: 3 } }, { at: 6, levels: { b: null } }]);
  });
});

describe('appendHistory', () => {
  it('keeps 48 hours and replaces an entry for the same hour', () => {
    let history = EMPTY_HISTORY;
    for (let i = 0; i < 60; i += 1) {
      history = appendHistory(history, { at: i * H, levels: {} });
    }
    history = appendHistory(history, { at: 59 * H + 60_000, levels: { x: 2 } });
    expect(history.entries).toHaveLength(49);
    expect(history.entries[0]?.at).toBe(11 * H);
    expect(history.entries.at(-1)?.levels).toEqual({ x: 2 });
  });
});

describe('worstToday', () => {
  it('finds the worst Warsaw-today hour, earliest on a tie', () => {
    const history = build([
      ['2026-10-01T21:00:00Z', 6], // 23:00 on 1 Oct in Warsaw: yesterday
      ['2026-10-01T22:30:00Z', 2], // 00:30 on 2 Oct
      ['2026-10-02T05:00:00Z', 4],
      ['2026-10-02T07:00:00Z', 4],
      ['2026-10-02T08:00:00Z', null],
    ]);
    expect(worstToday(history, 'krakow', at('2026-10-02T09:00:00Z'))).toEqual({ level: 4, hour: '07:00' });
  });

  it('is null with no data today', () => {
    expect(worstToday(EMPTY_HISTORY, 'krakow', at('2026-10-02T09:00:00Z'))).toBeNull();
  });
});

describe('levelYesterday', () => {
  it('is the level closest to 24 h ago, within 45 minutes', () => {
    const history = build([
      ['2026-10-01T08:20:00Z', 3],
      ['2026-10-01T09:25:00Z', 5],
    ]);
    expect(levelYesterday(history, 'krakow', at('2026-10-02T09:30:00Z'))).toBe(5);
    expect(levelYesterday(history, 'krakow', at('2026-10-02T11:00:00Z'))).toBeNull();
  });
});
