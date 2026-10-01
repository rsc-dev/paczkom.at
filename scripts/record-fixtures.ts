/**
 * Records real responses for the collector's offline mode and tests. Re-run
 * when a source changes shape; commit the result.
 *
 *   npm run record:fixtures
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GIOS_BASE, SENSOR_COMMUNITY_URL, fetchJson } from './collect/sources.js';

const out = (name: string): string => fileURLToPath(new URL(`./collect/fixtures/${name}`, import.meta.url));
const save = (name: string, value: unknown): void => {
  writeFileSync(out(name), `${JSON.stringify(value)}\n`);
  process.stdout.write(`wrote ${name}\n`);
};

const stations = await fetchJson(`${GIOS_BASE}/station/findAll?size=500`, 30_000);
save('gios-stations.json', stations);

const list = (stations as Record<string, { 'Identyfikator stacji': number }[]>)['Lista stacji pomiarowych'] ?? [];
const indexes: Record<string, unknown> = {};
for (const station of list) {
  const id = station['Identyfikator stacji'];
  try {
    indexes[String(id)] = await fetchJson(`${GIOS_BASE}/aqindex/getIndex/${String(id)}`, 15_000);
  } catch {
    // A station without an index is a normal hour; the fixture keeps the gap.
  }
}
save('gios-index.json', indexes);

save('sensor-community.json', await fetchJson(SENSOR_COMMUNITY_URL, 120_000));
