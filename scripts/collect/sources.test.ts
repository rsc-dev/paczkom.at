import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGiosIndex, parseGiosStations, parseSensorCommunity } from './sources.js';

describe('parseGiosStations', () => {
  it('reads id and coordinates from the Polish field names', () => {
    const json = {
      'Lista stacji pomiarowych': [
        { 'Identyfikator stacji': 11, 'WGS84 φ N': '50.912475', 'WGS84 λ E': '15.312190', 'Nazwa miasta': 'Czerniawa' },
        { 'Identyfikator stacji': 'x' },
      ],
    };
    expect(parseGiosStations(json)).toEqual([{ stationId: 11, lat: 50.912475, lon: 15.31219 }]);
  });

  it('returns nothing for an unexpected shape', () => {
    expect(parseGiosStations({ stations: [] })).toEqual([]);
  });
});

describe('parseGiosIndex', () => {
  it('reads the index and converts Warsaw time to UTC', () => {
    const json = {
      AqIndex: {
        'Identyfikator stacji pomiarowej': 11,
        'Data wykonania obliczeń indeksu': '2026-10-01 17:20:21',
        'Wartość indeksu': 1,
      },
    };
    expect(parseGiosIndex(json)).toEqual({ stationId: 11, level: 2, at: Date.parse('2026-10-01T15:20:21Z') });
  });

  it('keeps a station with no index as level null', () => {
    const json = {
      AqIndex: { 'Identyfikator stacji pomiarowej': 11, 'Data wykonania obliczeń indeksu': '2026-10-01 17:20:21', 'Wartość indeksu': -1 },
    };
    expect(parseGiosIndex(json)?.level).toBeNull();
  });

  it('is null without a station id or time', () => {
    expect(parseGiosIndex({ AqIndex: {} })).toBeNull();
  });
});

describe('parseSensorCommunity', () => {
  const entry = (location: number, timestamp: string, values: Record<string, string>, indoor = 0) => ({
    timestamp,
    location: { id: location, latitude: '50.06', longitude: '19.94', indoor },
    sensordatavalues: Object.entries(values).map(([value_type, value]) => ({ value_type, value })),
  });

  it('merges dust and humidity sensors at one location, latest reading wins', () => {
    const readings = parseSensorCommunity([
      entry(7, '2026-10-01 15:40:00', { P1: '30', P2: '20' }),
      entry(7, '2026-10-01 15:42:00', { P1: '31.5', P2: '21' }),
      entry(7, '2026-10-01 15:41:00', { temperature: '12', humidity: '77' }),
      entry(8, '2026-10-01 15:42:00', { P1: '10', P2: '5' }, 1),
    ]);
    expect(readings).toEqual([
      { sensorId: 7, lat: 50.06, lon: 19.94, indoor: false, at: Date.parse('2026-10-01T15:42:00Z'), pm25: 21, pm10: 31.5, humidity: 77 },
      { sensorId: 8, lat: 50.06, lon: 19.94, indoor: true, at: Date.parse('2026-10-01T15:42:00Z'), pm25: 5, pm10: 10, humidity: null },
    ]);
  });

  it('skips locations with no dust sensor and garbage values', () => {
    expect(parseSensorCommunity([entry(9, '2026-10-01 15:42:00', { humidity: '50' })])).toEqual([]);
    expect(parseSensorCommunity('nope')).toEqual([]);
  });
});

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('recorded fixtures still parse', () => {
  it('has hundreds of stations, indexes and citizen locations', () => {
    expect(parseGiosStations(fixture('gios-stations.json')).length).toBeGreaterThan(200);
    const indexes = Object.values(fixture('gios-index.json') as Record<string, unknown>).map(parseGiosIndex);
    expect(indexes.filter((i) => i !== null).length).toBeGreaterThan(150);
    expect(parseSensorCommunity(fixture('sensor-community.json')).length).toBeGreaterThan(300);
  });
});
