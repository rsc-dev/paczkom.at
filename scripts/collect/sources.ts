/**
 * Fetching and parsing the two open sources. Parsers never throw: a malformed
 * row is skipped, a malformed response is an empty list, and the collector's
 * minimum-towns rule decides whether the hour is publishable.
 *
 * GIOŚ: https://powietrze.gios.gov.pl/pjp/content/api — station/findAll and
 * other metadata endpoints are rate-limited to 2 requests/minute, the
 * current-index endpoint to 1500 requests/minute; reuse requires citing GIOŚ
 * as the source. Sensor.Community: ODbL 1.0.
 */
import { levelFromGiosIndex } from '../../src/core/levels.js';
import type { CitizenReading, GiosIndex, GiosStation } from '../../src/core/readings.js';
import { warsawLocalToMs } from '../../src/core/time.js';

export const GIOS_BASE = 'https://api.gios.gov.pl/pjp-api/v1/rest';
export const SENSOR_COMMUNITY_URL = 'https://data.sensor.community/airrohr/v1/filter/country=PL';
const GIOS_CONCURRENCY = 8;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export function parseGiosStations(json: unknown): GiosStation[] {
  const list = isObj(json) ? json['Lista stacji pomiarowych'] : null;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.flatMap((s: unknown) => {
    if (!isObj(s)) {
      return [];
    }
    const stationId = num(s['Identyfikator stacji']);
    const lat = num(s['WGS84 φ N']);
    const lon = num(s['WGS84 λ E']);
    return stationId === null || lat === null || lon === null ? [] : [{ stationId, lat, lon }];
  });
}

export function parseGiosIndex(json: unknown): GiosIndex | null {
  const index = isObj(json) ? json['AqIndex'] : null;
  if (!isObj(index)) {
    return null;
  }
  const stationId = num(index['Identyfikator stacji pomiarowej']);
  const computed = index['Data wykonania obliczeń indeksu'];
  const at = typeof computed === 'string' ? warsawLocalToMs(computed) : null;
  if (stationId === null || at === null) {
    return null;
  }
  return { stationId, level: levelFromGiosIndex(index['Wartość indeksu']), at };
}

export function parseSensorCommunity(json: unknown): CitizenReading[] {
  if (!Array.isArray(json)) {
    return [];
  }
  interface Acc { lat: number; lon: number; indoor: boolean; dustAt: number; pm25: number | null; pm10: number | null; humidity: number | null; humidAt: number }
  const byLocation = new Map<number, Acc>();
  for (const entry of json as unknown[]) {
    if (!isObj(entry) || !isObj(entry['location']) || !Array.isArray(entry['sensordatavalues'])) {
      continue;
    }
    const loc = entry['location'];
    const id = num(loc['id']);
    const lat = num(loc['latitude']);
    const lon = num(loc['longitude']);
    const at = typeof entry['timestamp'] === 'string' ? Date.parse(`${entry['timestamp'].replace(' ', 'T')}Z`) : NaN;
    if (id === null || lat === null || lon === null || Number.isNaN(at)) {
      continue;
    }
    const values = new Map<string, number>();
    for (const v of entry['sensordatavalues'] as unknown[]) {
      const value = isObj(v) ? num(v['value']) : null;
      if (isObj(v) && typeof v['value_type'] === 'string' && value !== null) {
        values.set(v['value_type'], value);
      }
    }
    const acc = byLocation.get(id) ?? {
      lat, lon, indoor: num(loc['indoor']) === 1, dustAt: -1, pm25: null, pm10: null, humidity: null, humidAt: -1,
    };
    if ((values.has('P1') || values.has('P2')) && at > acc.dustAt) {
      acc.dustAt = at;
      acc.pm10 = values.get('P1') ?? null;
      acc.pm25 = values.get('P2') ?? null;
    }
    if (values.has('humidity') && at > acc.humidAt) {
      acc.humidAt = at;
      acc.humidity = values.get('humidity') ?? null;
    }
    byLocation.set(id, acc);
  }
  return [...byLocation.entries()]
    .filter(([, a]) => a.dustAt >= 0)
    .sort(([a], [b]) => a - b)
    .map(([sensorId, a]) => ({
      sensorId, lat: a.lat, lon: a.lon, indoor: a.indoor, at: a.dustAt, pm25: a.pm25, pm10: a.pm10, humidity: a.humidity,
    }));
}

export async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  // GIOŚ's REST layer negotiates JSON-LD, not plain JSON; it 406s otherwise.
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/ld+json' } });
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${String(response.status)}`);
  }
  return (await response.json()) as unknown;
}

async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next] as T;
      next += 1;
      results.push(await fn(item));
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export async function fetchGios(): Promise<{ stations: GiosStation[]; indexes: GiosIndex[] }> {
  const stations = parseGiosStations(await fetchJson(`${GIOS_BASE}/station/findAll?size=500`, 30_000));
  const indexes = await mapLimited(stations, GIOS_CONCURRENCY, async (s) => {
    try {
      return parseGiosIndex(await fetchJson(`${GIOS_BASE}/aqindex/getIndex/${String(s.stationId)}`, 15_000));
    } catch {
      return null;
    }
  });
  return { stations, indexes: indexes.filter((i): i is GiosIndex => i !== null) };
}

export async function fetchSensorCommunity(): Promise<CitizenReading[]> {
  return parseSensorCommunity(await fetchJson(SENSOR_COMMUNITY_URL, 120_000));
}
