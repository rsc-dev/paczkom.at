// scripts/collect.ts
/**
 * The hourly job: fetch, grade, write. Runs after `vite build`, into dist/.
 *
 *   npm run collect                                   live, into dist/
 *   npm run collect -- --fixtures scripts/collect/fixtures --now 2026-10-01T15:30:00Z
 *   npm run collect -- --check-live                   fetch and parse only
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { MIN_TOWNS_WITH_DATA, buildOutputs } from '../src/core/outputs.js';
import townsJson from '../src/data/towns.json' with { type: 'json' };
import { loadSources, readHistory, writeOutputs } from './collect/run.js';

const { values } = parseArgs({
  options: {
    fixtures: { type: 'string' },
    now: { type: 'string' },
    out: { type: 'string', default: 'dist' },
    history: { type: 'string', default: '.history/history.json' },
    'check-live': { type: 'boolean', default: false },
  },
});

const fail = (message: string): never => {
  process.stderr.write(`collect: ${message}\n`);
  process.exit(1);
};

const nowMs = values.now === undefined ? Date.now() : Date.parse(values.now);
if (Number.isNaN(nowMs)) {
  fail(`--now is not a date: ${String(values.now)}`);
}

const sources = await loadSources(values.fixtures === undefined ? {} : { fixtures: values.fixtures });
process.stdout.write(
  `stations ${String(sources.stations.length)}, indexes ${String(sources.indexes.length)}, citizen ${String(sources.citizen.length)}\n`,
);

if (values['check-live']) {
  if (sources.failures.length > 0) {
    fail(`sources returned nothing: ${sources.failures.join(', ')}`);
  }
  process.exit(0);
}
if (sources.failures.length === 2) {
  fail('both sources failed; keeping the previous deploy');
}

const historyPath = values.history;
const history = readHistory(historyPath);

const output = buildOutputs({ towns: townsJson, ...sources, history, nowMs });
if (output.national.withData < MIN_TOWNS_WITH_DATA) {
  fail(`only ${String(output.national.withData)} towns graded (minimum ${String(MIN_TOWNS_WITH_DATA)})`);
}

const shellPath = join(values.out, 'index.html');
if (!existsSync(shellPath)) {
  fail(`${shellPath} not found; run vite build first`);
}
writeOutputs(values.out, output, readFileSync(shellPath, 'utf8'));

mkdirSync(dirname(historyPath), { recursive: true });
writeFileSync(historyPath, JSON.stringify(output.history));
process.stdout.write(`graded ${String(output.national.withData)} of ${String(output.national.total)} towns\n`);
