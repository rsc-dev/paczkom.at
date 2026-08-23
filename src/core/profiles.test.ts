import { describe, expect, it } from 'vitest';
import { DAILY_PROFILE } from './profiles.js';
import type { DayProfile } from './profiles.js';
import { buildWall } from './wall.js';

const PROFILES: DayProfile[] = [DAILY_PROFILE];

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

  it('raises hints in order', () => {
    expect(profile.hintDelay1Ms).toBeLessThan(profile.hintDelay2Ms);
    expect(profile.hintDelay2Ms).toBeLessThan(profile.patienceMs);
  });

  it('has room for the look-alike pairs it asks for', () => {
    expect(profile.lookalikePairs * 2).toBeLessThanOrEqual(profile.pickups);
  });
});

describe('daily profile', () => {
  it('matches the numbers the daily-mode spec fixes', () => {
    expect(DAILY_PROFILE.columns).toBe(3);
    expect(DAILY_PROFILE.pickups).toBe(16);
    expect(DAILY_PROFILE.senders).toBe(4);
    expect(DAILY_PROFILE.lookalikePairs).toBe(2);
    expect(DAILY_PROFILE.loadMs).toBe(25_000);
    expect(DAILY_PROFILE.serveMs).toBe(65_000);
    expect(DAILY_PROFILE.patienceMs).toBe(20_000);
    expect(DAILY_PROFILE.arrivalWindowMs).toBe(45_000);
  });
});
