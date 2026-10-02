import { describe, expect, it } from 'vitest';
import { gradeTown, median, usableReading } from './grade.js';
import type { CitizenReading } from './readings.js';

const NOW = Date.parse('2026-10-01T15:30:00Z');
const MIN = 60_000;

const reading = (over: Partial<CitizenReading> = {}): CitizenReading => ({
  sensorId: 1, lat: 50, lon: 20, indoor: false, at: NOW - 5 * MIN, pm25: 20, pm10: 30, humidity: 50, ...over,
});

describe('usableReading', () => {
  it('accepts a normal outdoor reading', () => {
    expect(usableReading(reading(), NOW)).toBe(true);
  });

  it.each<[string, Partial<CitizenReading>]>([
    ['indoor', { indoor: true }],
    ['older than 2 h', { at: NOW - 121 * MIN }],
    ['from the future', { at: NOW + 10 * MIN }],
    ['missing PM2.5', { pm25: null }],
    ['missing PM10', { pm10: null }],
    ['zero', { pm25: 0 }],
    ['negative', { pm10: -1 }],
    ['over 1000', { pm10: 1001 }],
    ['PM2.5 above PM10 + 5', { pm25: 40, pm10: 34 }],
  ])('rejects %s', (_label, over) => {
    expect(usableReading(reading(over), NOW)).toBe(false);
  });

  it('allows PM2.5 up to PM10 + 5', () => {
    expect(usableReading(reading({ pm25: 39, pm10: 34 }), NOW)).toBe(true);
  });
});

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('gradeTown', () => {
  const three = [reading({ pm25: 10, pm10: 15 }), reading({ pm25: 40, pm10: 60 }), reading({ pm25: 20, pm10: 30 })];

  it('uses the worst fresh GIOŚ index, with PM from citizen sensors', () => {
    const hour = gradeTown(
      [
        { stationId: 1, level: 2, at: NOW - 20 * MIN },
        { stationId: 2, level: 4, at: NOW - 20 * MIN },
      ],
      three,
      NOW,
    );
    expect(hour).toEqual({ level: 4, pm25: 20, pm10: 30, source: 'gios', sensorCount: 3, lowConfidence: false });
  });

  it('ignores GIOŚ indexes that are missing or older than 3 h', () => {
    const hour = gradeTown(
      [
        { stationId: 1, level: null, at: NOW - 20 * MIN },
        { stationId: 2, level: 6, at: NOW - 181 * MIN },
      ],
      three,
      NOW,
    );
    expect(hour.source).toBe('citizen');
    expect(hour.level).toBe(2);
  });

  it('grades the citizen medians when there is no GIOŚ station', () => {
    expect(gradeTown([], three, NOW)).toEqual({
      level: 2, pm25: 20, pm10: 30, source: 'citizen', sensorCount: 3, lowConfidence: false,
    });
  });

  it('flags low confidence with fewer than 3 sensors', () => {
    expect(gradeTown([], three.slice(0, 2), NOW).lowConfidence).toBe(true);
  });

  it('flags low confidence when the median humidity is over 80 %', () => {
    const humid = three.map((r) => ({ ...r, humidity: 85 }));
    expect(gradeTown([], humid, NOW).lowConfidence).toBe(true);
  });

  it('has no level and no source with nothing usable', () => {
    expect(gradeTown([], [reading({ indoor: true })], NOW)).toEqual({
      level: null, pm25: null, pm10: null, source: 'none', sensorCount: 0, lowConfidence: false,
    });
  });
});
