import { describe, expect, it } from 'vitest';
import { decodeLog } from './actionLog.js';
import { SCRIPTED_DAYS } from './fixtures/scripted-days.js';
import { initialState, reduce } from './game.js';
import type { State } from './game.js';
import { DAILY_PROFILE } from './profiles.js';

const replay = (seed: number, actions: readonly string[]): State =>
  decodeLog(actions).reduce(reduce, initialState(seed, DAILY_PROFILE));

describe.each(SCRIPTED_DAYS)('scripted day: $name', (day) => {
  it('reaches SUMMARY with the recorded result', () => {
    const state = replay(day.seed, day.actions);
    expect(state.phase).toBe('SUMMARY');
    expect(state.summary).toEqual(day.expected);
  });

  it('replays to a deep-equal state every time', () => {
    expect(replay(day.seed, day.actions)).toEqual(replay(day.seed, day.actions));
  });

  it('leaves the wall clear', () => {
    const state = replay(day.seed, day.actions);
    expect(state.slots.every((slot) => slot.state === 'empty')).toBe(true);
    expect(state.customers).toHaveLength(0);
  });

  it('accounts for every customer exactly once', () => {
    const state = replay(day.seed, day.actions);
    const summary = day.expected;
    expect(summary.served + summary.walked + summary.refused).toBe(state.schedule.length);
  });
});

describe('scripted day coverage', () => {
  const byName = (name: string) => SCRIPTED_DAYS.find((day) => day.name === name);

  it('has three logs covering the interesting shapes of a day', () => {
    expect(SCRIPTED_DAYS).toHaveLength(3);
  });

  it('covers a day served without a single hint', () => {
    const perfect = byName('perfect day')?.expected;
    expect(perfect?.served).toBe(DAILY_PROFILE.pickups + DAILY_PROFILE.senders);
    expect(perfect?.hinted).toBe(0);
    expect(perfect?.wrongTaps).toBe(0);
    expect(perfect?.walked).toBe(0);
    expect(perfect?.score).toBeGreaterThan(0);
    expect(Object.values(perfect?.slotOutcomes ?? {}).filter((outcome) => outcome === 'perfect'))
      .toHaveLength(DAILY_PROFILE.pickups);
  });

  it('covers a day earned through the hint ladder', () => {
    const hinted = byName('hinted day')?.expected;
    expect(hinted?.hinted).toBeGreaterThan(0);
    expect(hinted?.wrongTaps).toBeGreaterThan(0);
    expect(Object.values(hinted?.slotOutcomes ?? {})).toContain('hinted');
  });

  it('covers a day of walkers, refusals and parcels left on the van', () => {
    const walked = byName('walked and refused day')?.expected;
    expect(walked?.walked).toBeGreaterThan(0);
    expect(walked?.refused).toBeGreaterThan(0);
    expect(walked?.unplaced).toBeGreaterThan(0);
    expect(walked?.score).toBe(0);
    expect(Object.values(walked?.slotOutcomes ?? {})).toContain('walked');
  });
});
