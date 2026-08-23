import { describe, expect, it } from 'vitest';
import {
  COLOURS,
  STICKERS,
  adjacentTranspositions,
  countLookalikePairs,
  generateParcels,
  isLookalikePair,
  planPlacement,
} from './parcel.js';
import { DAILY_PROFILE } from './profiles.js';
import type { DayProfile } from './profiles.js';
import { buildWall } from './wall.js';

const profileWith = (overrides: Partial<DayProfile>): DayProfile => ({
  ...DAILY_PROFILE,
  ...overrides,
});

describe('adjacentTranspositions', () => {
  it('lists the codes reachable by swapping two neighbouring digits', () => {
    expect(adjacentTranspositions('4821').sort()).toEqual(['4281', '4812', '8421'].sort());
  });

  it('skips swaps that change nothing', () => {
    expect(adjacentTranspositions('1123')).toEqual(['1213', '1132']);
  });

  it('skips swaps that would produce a leading zero', () => {
    expect(adjacentTranspositions('1023')).toEqual(['1203', '1032']);
  });
});

describe('isLookalikePair', () => {
  it('accepts one adjacent transposition', () => {
    expect(isLookalikePair('4821', '4812')).toBe(true);
  });

  it('rejects identical codes', () => {
    expect(isLookalikePair('4821', '4821')).toBe(false);
  });

  it('rejects a non-adjacent transposition', () => {
    expect(isLookalikePair('4821', '1824')).toBe(false);
  });
});

describe('generateParcels', () => {
  it('gives every parcel a unique id and a unique 4-digit code', () => {
    const [parcels] = generateParcels(12345, profileWith({ pickups: 20, lookalikePairs: 2 }));
    expect(parcels).toHaveLength(20);
    expect(new Set(parcels.map((parcel) => parcel.code)).size).toBe(20);
    expect(new Set(parcels.map((parcel) => parcel.id)).size).toBe(20);
    for (const parcel of parcels) {
      expect(parcel.code).toMatch(/^[1-9][0-9]{3}$/);
    }
  });

  it('draws colours and stickers from the token sets', () => {
    const [parcels] = generateParcels(999, DAILY_PROFILE);
    for (const parcel of parcels) {
      expect(COLOURS).toContain(parcel.colour);
      expect(STICKERS).toContain(parcel.sticker);
    }
  });

  it('produces identical parcels for the same seed and profile', () => {
    expect(generateParcels(12345, DAILY_PROFILE)).toEqual(generateParcels(12345, DAILY_PROFILE));
  });

  it('produces different parcels for different seeds', () => {
    const [a] = generateParcels(1, DAILY_PROFILE);
    const [b] = generateParcels(2, DAILY_PROFILE);
    expect(a).not.toEqual(b);
  });

  it('advances the RNG state', () => {
    const [, state] = generateParcels(12345, DAILY_PROFILE);
    expect(state).not.toBe(12345);
  });

  it('produces exactly the requested number of look-alike pairs and no others', () => {
    for (const seed of [1, 2, 3, 4, 5, 77, 12345]) {
      const [parcels] = generateParcels(seed, DAILY_PROFILE);
      expect(countLookalikePairs(parcels.map((parcel) => parcel.code))).toBe(
        DAILY_PROFILE.lookalikePairs,
      );
    }
  });

  it('honours a profile that asks for no look-alike pairs', () => {
    const [parcels] = generateParcels(5, profileWith({ lookalikePairs: 0 }));
    expect(countLookalikePairs(parcels.map((parcel) => parcel.code))).toBe(0);
  });

  it('produces a size mix that fits the wall', () => {
    const wall = buildWall(DAILY_PROFILE.columns);
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12345]) {
      const [parcels] = generateParcels(seed, DAILY_PROFILE);
      const placement = planPlacement(parcels, wall);
      expect(placement).not.toBeNull();
      const slotIds = Object.values(placement ?? {});
      expect(new Set(slotIds).size).toBe(parcels.length);
    }
  });

  it('still fits when the wall is nearly full', () => {
    const profile = profileWith({ columns: 2, pickups: 14, lookalikePairs: 1 });
    const wall = buildWall(profile.columns);
    for (const seed of [1, 2, 3, 4, 5]) {
      const [parcels] = generateParcels(seed, profile);
      expect(planPlacement(parcels, wall)).not.toBeNull();
    }
  });

  it('refuses to generate more parcels than the wall can hold', () => {
    expect(() => generateParcels(1, profileWith({ columns: 1, pickups: 8 }))).toThrow();
  });
});

describe('planPlacement', () => {
  it('returns null when a parcel cannot fit anywhere', () => {
    const wall = buildWall(1).filter((slot) => slot.size === 'A');
    const parcel = { id: 'p0', size: 'C' as const, code: '1234', colour: 'red' as const, sticker: 'none' as const };
    expect(planPlacement([parcel], wall)).toBeNull();
  });
});
