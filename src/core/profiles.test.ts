import { describe, expect, it } from 'vitest';
import {
  DAILY_PROFILE,
  LATE_VAN_FACTOR,
  SATURDAY,
  THURSDAY,
  WEEK_DAY_KEYS,
  WEEK_PROFILES,
  loadDurationMs,
} from './profiles.js';
import type { DayProfile } from './profiles.js';
import { buildWall } from './wall.js';

const PROFILES: DayProfile[] = [...WEEK_PROFILES, DAILY_PROFILE];

describe.each(PROFILES)('profile $id', (profile) => {
  /**
   * The reducer relies on this: every customer has arrived and either been
   * served or walked before SERVE ends, so no slot can still be `full` when
   * SWEEP begins and the share grid can never disagree with `stats.walked`.
   */
  it('leaves the last arrival their full patience', () => {
    expect(profile.arrivalWindowMs + profile.patienceMs).toBeLessThanOrEqual(profile.serveMs);
  });

  it('asks for no more parcels than the wall can hold', () => {
    expect(profile.pickups).toBeLessThanOrEqual(buildWall(profile.columns).length);
  });

  it('leaves room for the senders it invites', () => {
    // Every sender needs an empty box at some point in the day.
    expect(profile.pickups).toBeLessThan(buildWall(profile.columns).length);
  });

  it('raises hints in order', () => {
    expect(profile.hintDelay1Ms).toBeLessThan(profile.hintDelay2Ms);
    expect(profile.hintDelay2Ms).toBeLessThan(profile.patienceMs);
  });

  it('has room for the look-alike pairs it asks for', () => {
    expect(profile.lookalikePairs * 2).toBeLessThanOrEqual(profile.pickups);
  });

  it('asks for no more forgotten codes or jams than it has pickups', () => {
    expect(profile.forgotten).toBeLessThanOrEqual(profile.pickups);
    expect(profile.jams).toBeLessThanOrEqual(profile.pickups);
  });

  /**
   * A parcel left on the van costs a star, so the load budget is the sharpest
   * edge in the game. Measured after the late van has taken its cut: a courier
   * who cannot hesitate at all is not a courier anyone can be.
   */
  it('gives the courier at least a second per parcel, late van included', () => {
    expect(loadDurationMs(profile) / profile.pickups).toBeGreaterThanOrEqual(1_000);
  });
});

describe('the week', () => {
  it('runs Monday to Saturday', () => {
    expect(WEEK_PROFILES).toHaveLength(6);
    expect(WEEK_PROFILES.map((profile) => profile.id)).toEqual([...WEEK_DAY_KEYS]);
  });

  it('escalates: never fewer columns, parcels or customers than the day before', () => {
    for (let i = 1; i < WEEK_PROFILES.length; i += 1) {
      const before = WEEK_PROFILES[i - 1];
      const day = WEEK_PROFILES[i];
      expect(day?.columns).toBeGreaterThanOrEqual(before?.columns ?? 0);
      expect(day?.pickups).toBeGreaterThan(before?.pickups ?? 0);
      expect(day?.patienceMs).toBeLessThanOrEqual(before?.patienceMs ?? 0);
    }
  });

  it('tightens the load budget per parcel day by day, and never by more than half', () => {
    const budgets = WEEK_PROFILES.map((profile) => loadDurationMs(profile) / profile.pickups);
    for (let i = 1; i < budgets.length; i += 1) {
      const before = budgets[i - 1] ?? 0;
      const today = budgets[i] ?? 0;
      expect(today).toBeLessThanOrEqual(before);
      // The old Friday halved Thursday's budget in one step; that is the cliff.
      expect(today).toBeGreaterThanOrEqual(before / 2);
    }
  });

  it('matches the numbers design D2 fixes', () => {
    expect(
      WEEK_PROFILES.map((profile) => [
        profile.columns,
        profile.pickups,
        profile.senders,
        profile.lookalikePairs,
        profile.patienceMs / 1000,
      ]),
    ).toEqual([
      [2, 8, 0, 0, 24],
      [2, 9, 2, 0, 24],
      [3, 12, 3, 1, 22],
      [3, 15, 4, 2, 20],
      [4, 20, 6, 2, 20],
      [5, 27, 8, 3, 18],
    ]);
  });

  it('turns the weather on in the order the design describes', () => {
    expect(
      WEEK_PROFILES.map((profile) => [profile.jams, profile.forgotten, profile.rain, profile.lateVan]),
    ).toEqual([
      [0, 0, false, false],
      [0, 0, false, false],
      [0, 0, false, false],
      [1, 0, false, false],
      [0, 2, false, true],
      [1, 2, true, true],
    ]);
  });

  it('gives Saturday a 35-slot wall', () => {
    expect(buildWall(SATURDAY.columns)).toHaveLength(35);
  });
});

describe('loadDurationMs', () => {
  it('is the profile value on an ordinary day', () => {
    expect(loadDurationMs(THURSDAY)).toBe(THURSDAY.loadMs);
  });

  it('is 60 % of it when the van is late', () => {
    expect(LATE_VAN_FACTOR).toBe(0.6);
    expect(loadDurationMs(SATURDAY)).toBe(30_000);
  });
});

describe('daily profile', () => {
  it('is Thursday-grade', () => {
    expect({ ...DAILY_PROFILE, id: 'thu' }).toEqual(THURSDAY);
  });

  it('matches the numbers the daily-mode spec fixes', () => {
    expect(DAILY_PROFILE.columns).toBe(3);
    expect(DAILY_PROFILE.pickups).toBe(15);
    expect(DAILY_PROFILE.senders).toBe(4);
    expect(DAILY_PROFILE.lookalikePairs).toBe(2);
    expect(DAILY_PROFILE.jams).toBe(1);
    expect(DAILY_PROFILE.loadMs).toBe(25_000);
    expect(DAILY_PROFILE.serveMs).toBe(65_000);
    expect(DAILY_PROFILE.patienceMs).toBe(20_000);
    expect(DAILY_PROFILE.arrivalWindowMs).toBe(45_000);
  });
});
