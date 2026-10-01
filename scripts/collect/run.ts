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

const readFixture = (dir: string, name: string): unknown => {
  const path = join(dir, name);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as unknown) : null;
};

/**
 * A source "failed" when we could not read it at all — the fetch threw, or in
 * fixtures mode the file is missing — not when it legitimately parsed to zero
 * items. Parsers never throw (see sources.ts); a structurally-empty but
 * present response is real data for a quiet hour, and `MIN_TOWNS_WITH_DATA`
 * is what decides whether that hour is publishable.
 */
export async function loadSources(mode: { fixtures?: string }): Promise<Sources> {
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
      ({ stations, indexes } = await fetchGios());
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
      citizen = await fetchSensorCommunity();
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
  const when = formatWhen(Date.parse(output.national.updatedAt), 'pl');
  for (const card of output.cards) {
    writeJson(join(out, 'data', 'towns', `${card.slug}.json`), card);
    mkdirSync(join(out, card.slug), { recursive: true });
    writeFileSync(join(out, card.slug, 'index.html'), townPage(shell, card, when));
    writeFileSync(join(out, card.slug, 'og.png'), renderTownOg(card, when));
  }
}
