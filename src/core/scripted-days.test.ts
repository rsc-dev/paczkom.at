import { describe, expect, it } from 'vitest';
import { decodeLog } from './actionLog.js';
import { SCRIPTED_DAYS } from './fixtures/scripted-days.js';
import type { ScriptedDay } from './fixtures/scripted-days.js';
import { initialState, reduce } from './game.js';
import type { State } from './game.js';
import { DAILY_PROFILE, SATURDAY, THURSDAY, WEEK_PROFILES } from './profiles.js';
import type { DayProfile } from './profiles.js';
import { isCustomerArrival } from './schedule.js';

function profileOf(id: string): DayProfile {
  if (id === 'daily') {
    return DAILY_PROFILE;
  }
  const found = WEEK_PROFILES.find((profile) => profile.id === id);
  if (found === undefined) {
    throw new Error(`scripted day names an unknown profile: ${id}`);
  }
  return found;
}

const replay = (day: ScriptedDay): State =>
  decodeLog(day.actions).reduce(reduce, initialState(day.seed, profileOf(day.profile)));

describe.each(SCRIPTED_DAYS)('scripted day: $name', (day) => {
  it('reaches SUMMARY with the recorded result', () => {
    const state = replay(day);
    expect(state.phase).toBe('SUMMARY');
    expect(state.summary).toEqual(day.expected);
  });

  it('replays to a deep-equal state every time', () => {
    expect(replay(day)).toEqual(replay(day));
  });

  it('leaves the wall clear and nothing stuck', () => {
    const state = replay(day);
    expect(state.slots.every((slot) => slot.state === 'empty')).toBe(true);
    expect(state.slots.every((slot) => !slot.jammed)).toBe(true);
    expect(state.customers).toHaveLength(0);
  });

  it('accounts for every customer exactly once', () => {
    const state = replay(day);
    const summary = day.expected;
    expect(summary.served + summary.walked + summary.refused).toBe(
      state.schedule.filter(isCustomerArrival).length,
    );
  });
});

describe('scripted day coverage', () => {
  const byName = (name: string) => SCRIPTED_DAYS.find((day) => day.name === name);

  it('covers the interesting shapes of a day, plus the two event days', () => {
    expect(SCRIPTED_DAYS).toHaveLength(5);
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

  it('covers Thursday, where a door jams and costs a tap but no penalty', () => {
    const thursday = byName('thursday with a jam');
    expect(thursday?.profile).toBe('thu');
    expect(thursday?.expected.served).toBe(THURSDAY.pickups + THURSDAY.senders);
    expect(thursday?.expected.wrongTaps).toBe(0);
    // The jam shows up as an extra tap in the log, not as a mark on the score.
    const perfect = byName('perfect day');
    expect(thursday?.expected.score).toBe(perfect?.expected.score);
  });

  it('covers Saturday, with every event at once, and it is still winnable', () => {
    const saturday = byName('saturday with everything');
    expect(saturday?.profile).toBe('sat');
    expect(saturday?.expected.served).toBe(SATURDAY.pickups + SATURDAY.senders);
    expect(saturday?.expected.walked).toBe(0);
    expect(saturday?.expected.refused).toBe(0);
    expect(saturday?.expected.unplaced).toBe(0);
  });

  it('replays Saturday with the rain mask and the forgotten codes in place', () => {
    const saturday = byName('saturday with everything');
    if (saturday === undefined) {
      throw new Error('missing Saturday fixture');
    }
    const start = initialState(saturday.seed, SATURDAY);
    expect(start.maskedDigit).not.toBeNull();
    expect(
      start.schedule
        .filter(isCustomerArrival)
        .filter((entry) => entry.request.kind === 'pickup' && entry.request.forgotten),
    ).toHaveLength(SATURDAY.forgotten);
    expect(start.schedule.filter((entry) => entry.kind === 'jam')).toHaveLength(SATURDAY.jams);
  });
});
