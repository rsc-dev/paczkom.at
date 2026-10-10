import { describe, expect, it } from 'vitest';
import { EMPTY_RECORDS, recordsFrom, withScore } from './record.js';

describe('records', () => {
  it('reads stored records and ignores garbage', () => {
    expect(recordsFrom({ A: 12, B: 3 })).toEqual({ A: 12, B: 3 });
    for (const bad of [null, 'x', { A: -1, B: 'y' }, { A: 1.5 }]) {
      expect(recordsFrom(bad)).toEqual(EMPTY_RECORDS);
    }
  });

  it('keeps the higher score per game and says when it is new', () => {
    expect(withScore({ A: 10, B: 0 }, 'A', 12)).toEqual({ records: { A: 12, B: 0 }, isNew: true });
    expect(withScore({ A: 10, B: 0 }, 'A', 10)).toEqual({ records: { A: 10, B: 0 }, isNew: false });
    expect(withScore({ A: 10, B: 0 }, 'B', 0)).toEqual({ records: { A: 10, B: 0 }, isNew: false });
  });
});
