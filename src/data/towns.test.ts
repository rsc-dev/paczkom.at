import { describe, expect, it } from 'vitest';
import type { Town } from '../core/towns.js';
import townsJson from './towns.json' with { type: 'json' };

const towns = townsJson as Town[];

describe('src/data/towns.json', () => {
  it('has several hundred towns with unique, URL-safe slugs', () => {
    expect(towns.length).toBeGreaterThan(400);
    expect(new Set(towns.map((t) => t.slug)).size).toBe(towns.length);
    for (const town of towns) {
      expect(town.slug, town.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('uses Polish names and leaves out city districts', () => {
    const names = new Set(towns.map((t) => t.name));
    for (const name of ['Warszawa', 'Kraków', 'Łódź', 'Bielsko-Biała', 'Luboń', 'Czeladź', 'Zielonka']) {
      expect(names.has(name), name).toBe(true);
    }
    for (const district of ['Wola', 'Mokotów', 'Śródmieście', 'Warsaw']) {
      expect(names.has(district), district).toBe(false);
    }
  });

  it('keeps every town inside Poland', () => {
    for (const town of towns) {
      expect(town.lat).toBeGreaterThan(49);
      expect(town.lat).toBeLessThan(55);
      expect(town.lon).toBeGreaterThan(14);
      expect(town.lon).toBeLessThan(24.2);
    }
  });
});
