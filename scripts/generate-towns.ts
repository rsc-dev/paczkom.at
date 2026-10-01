/**
 * Regenerates src/data/towns.json from GeoNames (CC BY 4.0). Needs `unzip`.
 *
 *   npm run gen:towns
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectTowns } from './towns/select.js';
import type { GeoNamesPlace } from './towns/select.js';

const work = mkdtempSync(join(tmpdir(), 'geonames-'));

async function download(url: string, name: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${String(response.status)}`);
  }
  const zip = join(work, `${name}.zip`);
  writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, 'PL.txt', '-d', join(work, name)]);
  return readFileSync(join(work, name, 'PL.txt'), 'utf8');
}

const rows = (text: string): string[][] =>
  text.split('\n').filter((line) => line !== '').map((line) => line.split('\t'));

const places: GeoNamesPlace[] = rows(await download('https://download.geonames.org/export/dump/PL.zip', 'places')).map(
  (c) => ({
    id: c[0] ?? '',
    name: c[1] ?? '',
    lat: Number(c[4]),
    lon: Number(c[5]),
    featureClass: c[6] ?? '',
    featureCode: c[7] ?? '',
    population: Number(c[14] ?? 0),
  }),
);

// alternateNames columns: altId, geonameId, isolanguage, name, isPreferredName, isShortName, isColloquial, isHistoric, …
const polishNames = new Map<string, string>();
const preferred = new Set<string>();
for (const c of rows(await download('https://download.geonames.org/export/dump/alternatenames/PL.zip', 'alt'))) {
  const [, id, lang, name, isPreferred, , , isHistoric] = c;
  if (id === undefined || name === undefined || lang !== 'pl' || isHistoric === '1' || preferred.has(id)) {
    continue;
  }
  polishNames.set(id, name);
  if (isPreferred === '1') {
    preferred.add(id);
  }
}

const include = new Set(
  JSON.parse(readFileSync(fileURLToPath(new URL('./towns/include.json', import.meta.url)), 'utf8')) as string[],
);
const towns = selectTowns(places, polishNames, include);
const target = fileURLToPath(new URL('../src/data/towns.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(towns, null, 1)}\n`);
process.stdout.write(`wrote ${String(towns.length)} towns to ${target}\n`);
