/**
 * Entry point. The UI layer lands in a later task group; for now this only
 * proves the toolchain boots and the core module graph is reachable.
 */
import { DAILY_PROFILE } from './core/profiles.js';
import { buildWall } from './core/wall.js';

const root = document.querySelector<HTMLDivElement>('#app');

if (root) {
  const slots = buildWall(DAILY_PROFILE.columns);
  root.textContent = `paczkom.at — ${String(slots.length)} slots`;
}
