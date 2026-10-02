export interface GeoTown {
  readonly lat: number;
  readonly lon: number;
  readonly population: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance (haversine). */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** clamp(2 km × √(population / 10 000), 3 km, 15 km). */
export function townRadiusKm(population: number): number {
  return Math.min(15, Math.max(3, 2 * Math.sqrt(population / 10_000)));
}

function nearest<T extends GeoTown>(lat: number, lon: number, towns: readonly T[], withinRadius: boolean): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const town of towns) {
    const distance = distanceKm(lat, lon, town.lat, town.lon);
    if (withinRadius && distance > townRadiusKm(town.population)) {
      continue;
    }
    if (distance < bestDistance) {
      best = town;
      bestDistance = distance;
    }
  }
  return best;
}

/** The town a sensor or station belongs to, or null if it is out in the country. */
export function townFor<T extends GeoTown>(lat: number, lon: number, towns: readonly T[]): T | null {
  return nearest(lat, lon, towns, true);
}

/** For "use my location": the nearest town, however far. */
export function closestTown<T extends GeoTown>(lat: number, lon: number, towns: readonly T[]): T | null {
  return nearest(lat, lon, towns, false);
}
