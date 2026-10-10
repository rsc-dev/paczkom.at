import { describe, expect, it } from 'vitest';
import { CRATE_SIZE, HEARTS, LOCKER, hazards, lastStep, level, move, newGame, step, tickInterval } from './game.js';
import type { Flight, GameEvent, GameState } from './game.js';

const at = (over: Partial<GameState>): GameState => ({ ...newGame('A', 7), ...over });
const thrown = (spot: number, s: number): Flight => ({ kind: 'throw', spot, step: s });
const dropped = (spot: number, s: number): Flight => ({ kind: 'drop', spot, step: s });

describe('catching', () => {
  it('catches a parcel at its last step into the crate', () => {
    const { state, events } = step(at({ pos: 2, flights: [thrown(1, 4)] }));
    expect(state.crate).toBe(1);
    expect(events).toContain('catch');
    expect(state.hearts).toBe(HEARTS);
  });

  it('loses a heart, pauses and clears the board when nobody is under the parcel', () => {
    const { state, events } = step(at({ pos: 4, flights: [thrown(1, 4), thrown(2, 1)] }));
    expect(events).toContain('miss');
    expect(state.hearts).toBe(HEARTS - 1);
    expect(state.broken).toBe(1);
    expect(state.pause).toBeGreaterThan(0);
    expect(state.flights).toEqual([]);
  });

  it('loses the parcel when the crate is full', () => {
    const { state, events } = step(at({ pos: 1, crate: CRATE_SIZE, flights: [thrown(0, 4)] }));
    expect(events).toContain('miss');
    expect(state.crate).toBe(CRATE_SIZE);
    expect(state.hearts).toBe(HEARTS - 1);
  });

  it('catches drone drops at their own last step', () => {
    expect(step(at({ pos: 3, flights: [dropped(2, 2)] })).state.crate).toBe(1);
  });

  it('ends the shift when the last heart goes', () => {
    const { state, events } = step(at({ pos: 5, hearts: 1, flights: [thrown(0, 4)] }));
    expect(events).toContain('over');
    expect(state.over).toBe(true);
    expect(state.hearts).toBe(0);
  });
});

describe('moving and delivering', () => {
  it('moves one position at a time and stops at the edges', () => {
    expect(move(at({ pos: 1 }), 0).state.pos).toBe(1);
    expect(move(at({ pos: 4 }), 5).state.pos).toBe(5);
    expect(move(at({ pos: 5 }), 6).state.pos).toBe(5);
  });

  it('delivers the crate at the locker for 2 points a parcel', () => {
    const { state, events } = move(at({ pos: 4, crate: 3, score: 10 }), LOCKER);
    expect(state).toMatchObject({ pos: 5, crate: 0, score: 16 });
    expect(events).toEqual(['deliver']);
  });

  it('does nothing at the locker with an empty crate, or when already there', () => {
    expect(move(at({ pos: 4, crate: 0 }), LOCKER).events).toEqual([]);
    expect(move(at({ pos: 5, crate: 2 }), LOCKER).events).toEqual([]);
  });

  it('refills hearts once when a delivery crosses 100 or 300', () => {
    const { state, events } = move(at({ pos: 4, crate: 3, score: 98, hearts: 1 }), LOCKER);
    expect(state.hearts).toBe(HEARTS);
    expect(events).toEqual(['deliver', 'bonus']);
    expect(move(at({ pos: 4, crate: 1, score: 100, hearts: 1 }), LOCKER).state.hearts).toBe(1);
  });

  it('ignores moves while play is frozen after a broken parcel', () => {
    const frozen = at({ pos: 4, crate: 2, pause: 2, broken: 1 });
    expect(move(frozen, LOCKER)).toEqual({ state: frozen, events: [] });
  });

  it('ignores moves after the shift ends', () => {
    const over = at({ over: true, pos: 2 });
    expect(move(over, 3)).toEqual({ state: over, events: [] });
  });
});

describe('the bird', () => {
  it('knocks a throw passing its perch to the neighbouring spot', () => {
    const { state } = step(at({ pos: 5, bird: { spot: 1, ticks: 4 }, flights: [thrown(1, 1)] }));
    expect(state.flights[0]).toMatchObject({ spot: 2, step: 2 });
    const edge = step(at({ pos: 5, bird: { spot: 3, ticks: 4 }, flights: [thrown(3, 1)] }));
    expect(edge.state.flights[0]?.spot).toBe(2);
  });

  it('leaves drone drops alone', () => {
    const { state } = step(at({ pos: 5, bird: { spot: 1, ticks: 4 }, flights: [dropped(1, 1)] }));
    expect(state.flights[0]?.spot).toBe(1);
  });
});

describe('spawning', () => {
  /**
   * A perfect player: moving is instant, so before every tick empty a full
   * crate at the locker, then stand under the parcel that resolves this tick.
   */
  function play(mode: 'A' | 'B', seed: number, ticks: number, check: (s: GameState, e: GameEvent[]) => void): GameState {
    let state = newGame(mode, seed);
    for (let i = 0; i < ticks && !state.over; i += 1) {
      if (state.crate === CRATE_SIZE) {
        state = move(state, LOCKER).state;
      }
      const due = state.flights.find((f) => f.step === lastStep(f));
      if (due !== undefined) {
        state = move(state, due.spot + 1).state;
      }
      const next = step(state);
      state = next.state;
      check(state, next.events);
    }
    return state;
  }

  it('lets a perfect player reach the top level without dropping a parcel', () => {
    const end = play('A', 3, 1500, (_s, e) => {
      expect(e).not.toContain('miss');
    });
    expect(end.over).toBe(false);
    expect(level('A', end.score)).toBe(5);
  });

  it('never lands two parcels on the same tick and never starts two at once', () => {
    play('B', 3, 600, (s) => {
      const due = s.flights.filter((f) => f.step === lastStep(f));
      expect(due.length).toBeLessThanOrEqual(1);
      expect(s.flights.filter((f) => f.step === 0).length).toBeLessThanOrEqual(1);
    });
  });

  it('keeps level 1 to one parcel in flight', () => {
    play('A', 11, 200, (s) => {
      if (level('A', s.score) === 1) {
        expect(s.flights.length).toBeLessThanOrEqual(1);
      }
    });
  });

  it('sends drones only from level 3, and the bird only from level 2', () => {
    play('A', 5, 300, (s, e) => {
      if (level('A', s.score) < 3) {
        expect(e).not.toContain('drop');
      }
      if (level('A', s.score) < 2) {
        expect(e).not.toContain('bird');
      }
    });
    let drones = 0;
    play('B', 5, 400, (_s, e) => {
      drones += e.filter((x) => x === 'drop').length;
    });
    expect(drones).toBeGreaterThan(0);
  });

  it('replays exactly from the same seed', () => {
    const run = (): GameEvent[][] => {
      let s = newGame('B', 42);
      const log: GameEvent[][] = [];
      for (let i = 0; i < 120; i += 1) {
        const r = step(s);
        s = r.state;
        log.push(r.events);
      }
      return log;
    };
    expect(run()).toEqual(run());
  });
});

describe('levels and tempo', () => {
  it('rises with score; Game B starts at level 3', () => {
    expect([0, 15, 16, 32, 48, 72].map((s) => level('A', s))).toEqual([1, 1, 2, 3, 4, 5]);
    expect(level('B', 0)).toBe(3);
  });

  it('sends hazards more often at the top level', () => {
    expect(hazards(1)).toEqual({ drone: 0, bird: 0 });
    expect(hazards(2).drone).toBe(0);
    expect(hazards(5).drone).toBeGreaterThan(hazards(4).drone);
    expect(hazards(5).bird).toBeGreaterThan(hazards(4).bird);
  });

  it('speeds up per level and keeps a 260 ms floor', () => {
    expect([tickInterval('A', 0), tickInterval('A', 16), tickInterval('A', 72)]).toEqual([700, 600, 360]);
    expect(tickInterval('A', 5000)).toBe(260);
  });
});
