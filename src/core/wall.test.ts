import { describe, expect, it } from 'vitest';
import { COLUMN_LAYOUT, UNITS_PER_COLUMN, buildWall, fits, sizeRank, slotCapacity } from './wall.js';
import type { Size } from './wall.js';

describe('buildWall', () => {
  it('lays a column out as A A A A B B C over 12 units', () => {
    const wall = buildWall(1);
    expect(wall.map((slot) => slot.size)).toEqual(['A', 'A', 'A', 'A', 'B', 'B', 'C']);
    expect(wall.map((slot) => slot.row)).toEqual([0, 1, 2, 3, 4, 6, 8]);
    expect(wall.map((slot) => slot.span)).toEqual([1, 1, 1, 1, 2, 2, 4]);
    expect(COLUMN_LAYOUT).toEqual(['A', 'A', 'A', 'A', 'B', 'B', 'C']);
    const units = wall.reduce((sum, slot) => sum + slot.span, 0);
    expect(units).toBe(UNITS_PER_COLUMN);
  });

  it('builds a three-column wall of 21 slots: 12 A, 6 B, 3 C', () => {
    const wall = buildWall(3);
    expect(wall).toHaveLength(21);
    expect(wall.filter((slot) => slot.size === 'A')).toHaveLength(12);
    expect(wall.filter((slot) => slot.size === 'B')).toHaveLength(6);
    expect(wall.filter((slot) => slot.size === 'C')).toHaveLength(3);
  });

  it('is data-driven in the column count', () => {
    expect(buildWall(2)).toHaveLength(14);
    expect(buildWall(5)).toHaveLength(35);
    for (const columns of [2, 3, 5]) {
      const wall = buildWall(columns);
      for (let col = 0; col < columns; col += 1) {
        const column = wall.filter((slot) => slot.col === col);
        expect(column.map((slot) => slot.size)).toEqual(COLUMN_LAYOUT);
        expect(column.reduce((sum, slot) => sum + slot.span, 0)).toBe(UNITS_PER_COLUMN);
      }
    }
  });

  it('ids slots as c{col}r{index} and orders them column by column', () => {
    const wall = buildWall(3);
    expect(wall.map((slot) => slot.id).slice(0, 8)).toEqual([
      'c0r0',
      'c0r1',
      'c0r2',
      'c0r3',
      'c0r4',
      'c0r5',
      'c0r6',
      'c1r0',
    ]);
    expect(new Set(wall.map((slot) => slot.id)).size).toBe(wall.length);
    for (const slot of wall) {
      expect(slot.id).toBe(`c${String(slot.col)}r${String(slot.index)}`);
    }
  });

  it('rejects a non-positive column count', () => {
    expect(() => buildWall(0)).toThrow();
    expect(() => buildWall(-1)).toThrow();
    expect(() => buildWall(1.5)).toThrow();
  });
});

describe('fits', () => {
  const cases: [Size, Size, boolean][] = [
    ['A', 'A', true],
    ['A', 'B', true],
    ['A', 'C', true],
    ['B', 'A', false],
    ['B', 'B', true],
    ['B', 'C', true],
    ['C', 'A', false],
    ['C', 'B', false],
    ['C', 'C', true],
  ];

  it.each(cases)('a %s parcel in a %s slot -> %s', (parcel, slot, expected) => {
    expect(fits(parcel, slot)).toBe(expected);
  });

  it('ranks A < B < C', () => {
    expect(sizeRank('A')).toBeLessThan(sizeRank('B'));
    expect(sizeRank('B')).toBeLessThan(sizeRank('C'));
  });
});

describe('slotCapacity', () => {
  it('counts the slots of each size in a wall', () => {
    expect(slotCapacity(buildWall(3))).toEqual({ A: 12, B: 6, C: 3 });
    expect(slotCapacity(buildWall(2))).toEqual({ A: 8, B: 4, C: 2 });
  });
});
