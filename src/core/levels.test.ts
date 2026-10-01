import { describe, expect, it } from 'vitest';
import { LEVELS, levelFromGiosIndex, pmLevel, worseLevel } from './levels.js';

describe('pmLevel', () => {
  it.each([
    [0.1, 1], [13, 1], [13.01, 2], [35, 2], [35.1, 3], [55, 3], [55.1, 4],
    [75, 4], [75.1, 5], [110, 5], [110.1, 6], [900, 6],
  ])('PM2.5 %d µg/m³ is level %d', (pm25, level) => {
    expect(pmLevel(pm25, null)).toBe(level);
  });

  it.each([
    [20, 1], [20.1, 2], [50, 2], [50.1, 3], [80, 3], [80.1, 4],
    [110, 4], [110.1, 5], [150, 5], [150.1, 6],
  ])('PM10 %d µg/m³ is level %d', (pm10, level) => {
    expect(pmLevel(null, pm10)).toBe(level);
  });

  it('takes the worse of the two pollutants', () => {
    expect(pmLevel(10, 60)).toBe(3);
    expect(pmLevel(80, 10)).toBe(5);
  });

  it('is null with nothing to grade', () => {
    expect(pmLevel(null, null)).toBeNull();
  });
});

describe('levelFromGiosIndex', () => {
  it('maps GIOŚ 0–5 to levels 1–6', () => {
    expect([0, 1, 2, 3, 4, 5].map(levelFromGiosIndex)).toEqual([...LEVELS]);
  });

  it.each([-1, 6, 2.5, null, undefined, '3'])('rejects %s', (value) => {
    expect(levelFromGiosIndex(value)).toBeNull();
  });
});

describe('worseLevel', () => {
  it('is the higher number', () => {
    expect(worseLevel(2, 5)).toBe(5);
    expect(worseLevel(4, 1)).toBe(4);
  });
});
