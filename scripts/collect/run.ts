// scripts/collect/run.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectOutput } from '../../src/core/outputs.js';
import { EMPTY_HISTORY, parseHistory } from '../../src/core/history.js';
import type { History } from '../../src/core/history.js';
import { isNationalSummary, isTownCard, isTownIndex } from '../../src/core/publish.js';
import type { CitizenReading, GiosIndex, GiosStation } from '../../src/core/readings.js';
import { formatWhen, renderTownOg } from './og.js';
import { townPage } from './pages.js';
import { fetchGios, fetchSensorCommunity, parseGiosIndex, parseGiosStations, parseSensorCommunity } from './sources.js';

export interface Sources {
  readonly stations: GiosStation[];
  readonly indexes: GiosIndex[];
  readonly citizen: CitizenReading[];
  /** Which sources gave nothing: 'gios', 'sensor-community'. */
  readonly failures: string[];
}

/** Injectable so tests can simulate a live fetch without a network call. */
interface Fetchers {
  readonly fetchGios: () => Promise<{ stations: GiosStation[]; indexes: GiosIndex[] }>;
  readonly fetchSensorCommunity: () => Promise<CitizenReading[]>;
}

const readFixture = (dir: string, name: string): unknown => {
  const path = join(dir, name);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as unknown) : null;
};

/**
 * In fixtures mode, a source "failed" when its fixture file is missing — not
 * when it legitimately parsed to zero items — because `--fixtures` is a fixed
 * snapshot and an empty-but-present file is a deliberately recorded case (see
 * run.test.ts). In live mode there is no such file to check for presence, so
 * a fetch that resolves without throwing but yields nothing (e.g. GIOŚ with
 * every per-station index call failing, or Sensor.Community replying `[]`) is
 * itself the signal: the source gave nothing, and --check-live and the exit-1
 * "both sources failed" guard both depend on that. Either way,
 * `MIN_TOWNS_WITH_DATA` remains the real safety net for low-but-nonzero data.
 */
export async function loadSources(
  mode: { fixtures?: string },
  fetchers: Fetchers = { fetchGios, fetchSensorCommunity },
): Promise<Sources> {
  const failures: string[] = [];
  let stations: GiosStation[] = [];
  let indexes: GiosIndex[] = [];
  let citizen: CitizenReading[] = [];

  try {
    if (mode.fixtures !== undefined) {
      stations = parseGiosStations(readFixture(mode.fixtures, 'gios-stations.json'));
      const indexRaw = readFixture(mode.fixtures, 'gios-index.json');
      indexes = Object.values((indexRaw ?? {}) as Record<string, unknown>)
        .map(parseGiosIndex)
        .filter((i): i is GiosIndex => i !== null);
      if (indexRaw === null) {
        failures.push('gios');
      }
    } else {
      ({ stations, indexes } = await fetchers.fetchGios());
      if (indexes.length === 0) {
        failures.push('gios');
      }
    }
  } catch (error) {
    process.stderr.write(`gios: ${String(error)}\n`);
    failures.push('gios');
  }

  try {
    if (mode.fixtures !== undefined) {
      const citizenRaw = readFixture(mode.fixtures, 'sensor-community.json');
      citizen = parseSensorCommunity(citizenRaw);
      if (citizenRaw === null) {
        failures.push('sensor-community');
      }
    } else {
      citizen = await fetchers.fetchSensorCommunity();
      if (citizen.length === 0) {
        failures.push('sensor-community');
      }
    }
  } catch (error) {
    process.stderr.write(`sensor-community: ${String(error)}\n`);
    failures.push('sensor-community');
  }

  return { stations, indexes, citizen, failures };
}

/**
 * Reads the history cache. A missing file is a first run; an unreadable or
 * corrupt one (evicted cache, truncated JSON after a killed write) is not
 * fatal either — it costs the "vs yesterday" line for a day, never the run.
 */
export function readHistory(path: string): History {
  if (!existsSync(path)) {
    process.stderr.write(`history: ${path} not found; starting with empty history\n`);
    return EMPTY_HISTORY;
  }
  try {
    return parseHistory(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch (error) {
    process.stderr.write(`history: ${String(error)}\n`);
    return EMPTY_HISTORY;
  }
}

const writeJson = (path: string, value: unknown): void => {
  writeFileSync(path, JSON.stringify(value));
};

/** Validates before writing: a shape bug fails the run instead of shipping. */
export function writeOutputs(out: string, output: CollectOutput, shell: string): void {
  if (!isTownIndex(output.index) || !isNationalSummary(output.national) || !output.cards.every(isTownCard)) {
    throw new Error('collector produced data that does not match the published shapes');
  }
  mkdirSync(join(out, 'data', 'towns'), { recursive: true });
  writeJson(join(out, 'data', 'index.json'), output.index);
  writeJson(join(out, 'data', 'national.json'), output.national);
  // Pages serves this for any unknown path (e.g. a retired or mistyped slug);
  // the app's own route logic falls back to the town picker from there.
  writeFileSync(join(out, '404.html'), shell);
  const when = formatWhen(Date.parse(output.national.updatedAt), 'pl');
  for (const card of output.cards) {
    writeJson(join(out, 'data', 'towns', `${card.slug}.json`), card);
    mkdirSync(join(out, card.slug), { recursive: true });
    writeFileSync(join(out, card.slug, 'index.html'), townPage(shell, card, when));
    writeFileSync(join(out, card.slug, 'og.png'), renderTownOg(card, when));
  }
}
