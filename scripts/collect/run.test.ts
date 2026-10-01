// scripts/collect/run.test.ts
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMPTY_HISTORY, parseHistory } from '../../src/core/history.js';
import { buildOutputs } from '../../src/core/outputs.js';
import { isNationalSummary, isTownCard, isTownIndex } from '../../src/core/publish.js';
import type { Town } from '../../src/core/towns.js';
import townsJson from '../../src/data/towns.json' with { type: 'json' };
import { loadSources, readHistory, writeOutputs } from './run.js';

const FIXTURES = 'scripts/collect/fixtures';
const SHELL = '<title>x</title><meta property="og:title" content="" /><meta property="og:description" content="" /><meta property="og:url" content="" /><meta property="og:image" content="" />';
// The fixtures were recorded at this instant (Task 10); grading against it
// yields real levels instead of "too old" for almost everything.
const NOW_MS = Date.parse('2026-10-01T17:12:00Z');

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

describe('readHistory', () => {
  it('returns empty history when the file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    expect(readHistory(join(dir, 'missing.json'))).toEqual(EMPTY_HISTORY);
  });

  it('returns empty history for truncated JSON instead of crashing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    const path = join(dir, 'h.json');
    writeFileSync(path, '{"version":1,"entries":[');
    expect(readHistory(path)).toEqual(EMPTY_HISTORY);
  });

  it('reads the entries of a valid history file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    const path = join(dir, 'h.json');
    const raw = { version: 1, entries: [{ at: 1000, levels: { krakow: 2 } }] };
    writeFileSync(path, JSON.stringify(raw));
    expect(readHistory(path)).toEqual(parseHistory(raw));
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
});
