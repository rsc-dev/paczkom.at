import { describe, expect, it } from 'vitest';
import { EMPTY_HISTORY, appendHistory } from './history.js';
import { buildOutputs } from './outputs.js';
import type { CitizenReading } from './readings.js';

const NOW = Date.parse('2026-10-01T15:30:00Z');
const towns = [
  { slug: 'krakow', name: 'Kraków', lat: 50.0614, lon: 19.9366, population: 800_000 },
  { slug: 'nowy-targ', name: 'Nowy Targ', lat: 49.4775, lon: 20.0327, population: 33_000 },
  { slug: 'pustkowo', name: 'Pustkowo', lat: 54.0, lon: 15.0, population: 6_000 },
];
const sensor = (id: number, lat: number, lon: number, pm25: number, pm10: number): CitizenReading => ({
  sensorId: id, lat, lon, indoor: false, at: NOW - 300_000, pm25, pm10, humidity: 60,
});

const history = appendHistory(EMPTY_HISTORY, { at: NOW - 24 * 3_600_000, levels: { krakow: 2 } });

const out = buildOutputs({
  towns,
  stations: [{ stationId: 400, lat: 50.06, lon: 19.94 }],
  indexes: [{ stationId: 400, level: 4, at: NOW - 600_000 }],
  citizen: [
    sensor(1, 49.48, 20.03, 10, 15), sensor(2, 49.47, 20.04, 12, 18), sensor(3, 49.476, 20.03, 8, 14),
    sensor(4, 50.07, 19.93, 48, 70),
    sensor(5, 52.0, 17.0, 300, 400), // nowhere near a town
  ],
  history,
  nowMs: NOW,
});

const card = (slug: string) => out.cards.find((c) => c.slug === slug);

describe('buildOutputs', () => {
  it('grades every town, GIOŚ first', () => {
    expect(card('krakow')).toMatchObject({ level: 4, source: 'gios', pm25: 48, sensorCount: 1, levelYesterday: 2 });
    expect(card('nowy-targ')).toMatchObject({ level: 1, source: 'citizen', sensorCount: 3, lowConfidence: false });
    expect(card('pustkowo')).toMatchObject({ level: null, source: 'none', percentileBetter: null });
  });

  it('ranks against towns with data only', () => {
    expect(card('nowy-targ')?.percentileBetter).toBe(50);
    expect(card('krakow')?.percentileBetter).toBe(0);
    expect(out.national.withData).toBe(2);
    expect(out.national.total).toBe(3);
  });

  it('records this hour in the history and reads worst-today from it', () => {
    expect(out.history.entries.at(-1)).toEqual({ at: NOW, levels: { krakow: 4, 'nowy-targ': 1, pustkowo: null } });
    expect(card('krakow')?.worstToday).toEqual({ level: 4, hour: '17:00' });
  });

  it('stamps every file with the same time and lists every town in the index', () => {
    expect(new Set(out.cards.map((c) => c.updatedAt))).toEqual(new Set([new Date(NOW).toISOString()]));
    expect(out.index.map((t) => t.slug)).toEqual(['krakow', 'nowy-targ', 'pustkowo']);
  });
});
