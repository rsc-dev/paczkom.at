// scripts/collect/run.test.ts
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_HISTORY, parseHistory } from '../../src/core/history.js';
import { buildOutputs } from '../../src/core/outputs.js';
import { isNationalSummary, isTownCard, isTownIndex } from '../../src/core/publish.js';
import type { Town } from '../../src/core/towns.js';
import townsJson from '../../src/data/towns.json' with { type: 'json' };
import { loadSources, readHistory, writeOutputs } from './run.js';

const FIXTURES = 'scripts/collect/fixtures';
const SHELL =
  '<title>x</title><meta property="og:title" content="" /><meta property="og:description" content="" /><meta property="og:url" content="" /><meta property="og:image" content="" /><meta property="og:image:alt" content="" />';
// The fixtures were recorded at this instant (Task 10); grading against it
// yields real levels instead of "too old" for almost everything.
const NOW_MS = Date.parse('2026-10-01T17:12:00Z');

const citizenReading = (sensorId: number) => ({
  sensorId, lat: 50.06, lon: 19.94, indoor: false, at: Date.now(), pm25: 5, pm10: 8, humidity: null,
});

/** Silences stderr for a test and returns the spy so the warning text can be asserted. */
const spyOnStderr = () => vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

describe('loadSources from fixtures', () => {
  it('loads both sources with no failures', async () => {
    const sources = await loadSources({ fixtures: FIXTURES });
    expect(sources.failures).toEqual([]);
    expect(sources.stations.length).toBeGreaterThan(200);
    expect(sources.citizen.length).toBeGreaterThan(300);
  });

  it('reports a missing source as a failure, not a crash', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fx-'));
    writeFileSync(join(dir, 'sensor-community.json'), '[]');
    const sources = await loadSources({ fixtures: dir });
    expect(sources.failures).toEqual(['gios']);
  });
});

describe('loadSources in live mode (injected fetchers)', () => {
  it('flags both sources when they resolve without throwing but yield nothing', async () => {
    const stderr = spyOnStderr();
    const sources = await loadSources(
      {},
      {
        fetchGios: () => Promise.resolve({ stations: [], indexes: [] }),
        fetchSensorCommunity: () => Promise.resolve([]),
      },
    );
    expect(sources.failures).toEqual(['gios', 'sensor-community']);
    stderr.mockRestore();
  });

  it('flags only the source that throws, not a healthy one', async () => {
    const stderr = spyOnStderr();
    const sources = await loadSources(
      {},
      {
        fetchGios: () => Promise.reject(new Error('network down')),
        fetchSensorCommunity: () => Promise.resolve([citizenReading(1)]),
      },
    );
    expect(sources.failures).toEqual(['gios']);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('gios: Error: network down'));
    stderr.mockRestore();
  });

  it('reports no failures when both sources return data', async () => {
    const stderr = spyOnStderr();
    const sources = await loadSources(
      {},
      {
        fetchGios: () =>
          Promise.resolve({
            stations: [{ stationId: 1, lat: 50.06, lon: 19.94 }],
            indexes: [{ stationId: 1, level: 2, at: Date.now() }],
          }),
        fetchSensorCommunity: () => Promise.resolve([citizenReading(1)]),
      },
    );
    expect(sources.failures).toEqual([]);
    stderr.mockRestore();
  });
});

describe('readHistory', () => {
  it('returns empty history and warns when the file is missing', () => {
    const stderr = spyOnStderr();
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    const path = join(dir, 'missing.json');
    expect(readHistory(path)).toEqual(EMPTY_HISTORY);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining(`${path} not found`));
    stderr.mockRestore();
  });

  it('returns empty history and warns for truncated JSON instead of crashing', () => {
    const stderr = spyOnStderr();
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    const path = join(dir, 'h.json');
    writeFileSync(path, '{"version":1,"entries":[');
    expect(readHistory(path)).toEqual(EMPTY_HISTORY);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('history: SyntaxError'));
    stderr.mockRestore();
  });

  it('reads the entries of a valid history file without warning', () => {
    const stderr = spyOnStderr();
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    const path = join(dir, 'h.json');
    const raw = { version: 1, entries: [{ at: 1000, levels: { krakow: 2 } }] };
    writeFileSync(path, JSON.stringify(raw));
    expect(readHistory(path)).toEqual(parseHistory(raw));
    expect(stderr).not.toHaveBeenCalled();
    stderr.mockRestore();
  });
});

describe('writeOutputs', () => {
  it('writes valid JSON, a page and an image per town', async () => {
    const sources = await loadSources({ fixtures: FIXTURES });
    const out = mkdtempSync(join(tmpdir(), 'out-'));
    const output = buildOutputs({
      towns: (townsJson as Town[]).slice(0, 3), ...sources, history: EMPTY_HISTORY, nowMs: NOW_MS,
    });
    writeOutputs(out, output, SHELL);
    const read = (p: string): unknown => JSON.parse(readFileSync(join(out, p), 'utf8'));
    expect(isTownIndex(read('data/index.json'))).toBe(true);
    expect(isNationalSummary(read('data/national.json'))).toBe(true);
    const slug = output.cards[0]?.slug ?? '';
    expect(isTownCard(read(`data/towns/${slug}.json`))).toBe(true);
    expect(existsSync(join(out, slug, 'index.html'))).toBe(true);
    expect(existsSync(join(out, slug, 'og.png'))).toBe(true);
  });

  it('ships the shell as 404.html, so an unknown slug lands in the app', async () => {
    const sources = await loadSources({ fixtures: FIXTURES });
    const out = mkdtempSync(join(tmpdir(), 'out-'));
    const output = buildOutputs({
      towns: (townsJson as Town[]).slice(0, 3), ...sources, history: EMPTY_HISTORY, nowMs: NOW_MS,
    });
    writeOutputs(out, output, SHELL);
    expect(readFileSync(join(out, '404.html'), 'utf8')).toBe(SHELL);
  });
});
