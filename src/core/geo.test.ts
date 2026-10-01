import { describe, expect, it } from 'vitest';
import { closestTown, distanceKm, townFor, townRadiusKm } from './geo.js';

const krakow = { slug: 'krakow', lat: 50.0614, lon: 19.9366, population: 800_000 };
const wieliczka = { slug: 'wieliczka', lat: 49.987, lon: 20.0647, population: 23_000 };
const towns = [krakow, wieliczka];

describe('distanceKm', () => {
  it('is about 252 km from Warsaw to Kraków', () => {
    expect(distanceKm(52.2297, 21.0122, 50.0614, 19.9366)).toBeCloseTo(252, -1);
  });
  it('is zero for the same point', () => {
    expect(distanceKm(50, 20, 50, 20)).toBe(0);
  });
});

describe('townRadiusKm', () => {
  it('grows with population, clamped to 3–15 km', () => {
    expect(townRadiusKm(5_000)).toBe(3);
    expect(townRadiusKm(40_000)).toBeCloseTo(4);
    expect(townRadiusKm(250_000)).toBeCloseTo(10);
    expect(townRadiusKm(2_000_000)).toBe(15);
  });
});

describe('townFor', () => {
  it('picks the nearest town whose radius contains the point', () => {
    expect(townFor(50.0647, 19.945, towns)?.slug).toBe('krakow');
    expect(townFor(49.99, 20.06, towns)?.slug).toBe('wieliczka');
  });
  it('is null outside every radius', () => {
    expect(townFor(51.5, 17.0, towns)).toBeNull();
  });
});

describe('closestTown', () => {
  it('ignores radius', () => {
    expect(closestTown(51.5, 17.0, towns)?.slug).toBe('krakow');
    expect(closestTown(0, 0, [])).toBeNull();
  });
});
