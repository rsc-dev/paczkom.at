/**
 * The Polski Indeks Jakości Powietrza, six levels. GIOŚ numbers them 0–5; the
 * card shows 1–6 so "4/6" reads naturally.
 */
export type Level = 1 | 2 | 3 | 4 | 5 | 6;

export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5, 6];

/** Inclusive upper bound of levels 1–5 in µg/m³; anything above is level 6. */
export const PM25_BANDS: readonly number[] = [13, 35, 55, 75, 110];
export const PM10_BANDS: readonly number[] = [20, 50, 80, 110, 150];

function bandLevel(value: number, bands: readonly number[]): Level {
  const index = bands.findIndex((upper) => value <= upper);
  return (index === -1 ? 6 : index + 1) as Level;
}

export function worseLevel(a: Level, b: Level): Level {
  return a >= b ? a : b;
}

/** The worse of the PM2.5 and PM10 levels; null when neither is known. */
export function pmLevel(pm25: number | null, pm10: number | null): Level | null {
  const levels: Level[] = [];
  if (pm25 !== null) {
    levels.push(bandLevel(pm25, PM25_BANDS));
  }
  if (pm10 !== null) {
    levels.push(bandLevel(pm10, PM10_BANDS));
  }
  return levels.reduce<Level | null>((worst, level) => (worst === null ? level : worseLevel(worst, level)), null);
}

/** GIOŚ reports -1 or null when it has no index; anything outside 0–5 is no data. */
export function levelFromGiosIndex(value: unknown): Level | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5
    ? ((value + 1) as Level)
    : null;
}
