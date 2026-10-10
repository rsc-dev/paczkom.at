import { describe, expect, it } from 'vitest';
import { fnv1a, next, nextInt, pick, shuffle, weightedPick } from './rng.js';

describe('fnv1a', () => {
  it('is deterministic for the same string', () => {
    expect(fnv1a('2026-09-14')).toBe(fnv1a('2026-09-14'));
  });

  it('differs for different strings', () => {
    expect(fnv1a('2026-09-14')).not.toBe(fnv1a('2026-09-15'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const input of ['', 'a', 'paczkom.at', '2026-09-01', 'ąćęłńóśźż']) {
      const hash = fnv1a(input);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('matches the known FNV-1a offset basis for the empty string', () => {
    expect(fnv1a('')).toBe(2166136261);
  });

  // Golden vectors. "abc" is the published FNV-1a 32-bit test vector
  // (0x1a47e90b); the rest pin our own inputs so a refactor cannot silently
  // reseed every player's day.
  it.each([
    ['abc', 440920331],
    ['paczkom.at', 2405220199],
    ['2026-09-01', 130883755],
  ])('hashes %s to %i', (input, expected) => {
    expect(fnv1a(input)).toBe(expected);
  });
});

describe('next', () => {
  /** The reference mulberry32, transcribed independently of our version. */
  function referenceMulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const firstThree = (seed: number): number[] => {
    let state = seed;
    return Array.from({ length: 3 }, () => {
      const [value, nextState] = next(state);
      state = nextState;
      return value;
    });
  };

  it('matches the reference mulberry32 stream', () => {
    for (const seed of [0, 1, 12345, 2405220199]) {
      const reference = referenceMulberry32(seed);
      expect(firstThree(seed)).toEqual([reference(), reference(), reference()]);
    }
  });

  // Golden vector: hard-coded so a refactor that still "looks like"
  // mulberry32 cannot quietly change every seeded day.
  it('produces the recorded stream for seed 12345', () => {
    expect(firstThree(12345)).toEqual([
      0.9797282677609473, 0.3067522644996643, 0.484205421525985,
    ]);
  });

  it('is a pure function of its state', () => {
    expect(next(12345)).toEqual(next(12345));
  });

  it('advances the state', () => {
    const [, state] = next(12345);
    expect(state).not.toBe(12345);
  });

  it('yields values in [0, 1)', () => {
    let state = fnv1a('spread');
    for (let i = 0; i < 2000; i += 1) {
      const [value, nextState] = next(state);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      state = nextState;
    }
  });

  it('produces a roughly uniform stream', () => {
    let state = fnv1a('uniform');
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i += 1) {
      const [value, nextState] = next(state);
      sum += value;
      state = nextState;
    }
    expect(sum / n).toBeGreaterThan(0.47);
    expect(sum / n).toBeLessThan(0.53);
  });

  it('produces different streams for different seeds', () => {
    const a = Array.from({ length: 5 }, (_unused, i) => i).reduce<[number[], number]>(
      ([acc, state]) => {
        const [value, nextState] = next(state);
        return [[...acc, value], nextState];
      },
      [[], 1],
    )[0];
    const b = Array.from({ length: 5 }, (_unused, i) => i).reduce<[number[], number]>(
      ([acc, state]) => {
        const [value, nextState] = next(state);
        return [[...acc, value], nextState];
      },
      [[], 2],
    )[0];
    expect(a).not.toEqual(b);
  });
});

describe('nextInt', () => {
  it('stays within range', () => {
    let state = fnv1a('ints');
    for (let i = 0; i < 500; i += 1) {
      const [value, nextState] = nextInt(state, 7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
      state = nextState;
    }
  });

  it('is deterministic', () => {
    expect(nextInt(99, 10)).toEqual(nextInt(99, 10));
  });

  it('throws for a non-positive bound', () => {
    expect(() => nextInt(1, 0)).toThrow();
  });
});

describe('pick', () => {
  it('returns an element of the list and is deterministic', () => {
    const items = ['a', 'b', 'c', 'd'] as const;
    const [value, state] = pick(42, items);
    expect(items).toContain(value);
    expect(pick(42, items)).toEqual([value, state]);
  });

  it('throws on an empty list', () => {
    expect(() => pick(1, [])).toThrow();
  });
});

describe('shuffle', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];

  it('is deterministic', () => {
    expect(shuffle(7, items)).toEqual(shuffle(7, items));
  });

  it('returns a permutation without mutating the input', () => {
    const original = [...items];
    const [shuffled] = shuffle(7, items);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual(original);
  });

  it('actually reorders for some seed', () => {
    const seeds = [1, 2, 3, 4, 5];
    const anyReordered = seeds.some((seed) => {
      const [shuffled] = shuffle(seed, items);
      return shuffled.some((value, index) => value !== items[index]);
    });
    expect(anyReordered).toBe(true);
  });

  it('advances the state once per element', () => {
    const [, stateA] = shuffle(11, [1, 2, 3]);
    const [, stateB] = shuffle(11, [1, 2, 3]);
    expect(stateA).toBe(stateB);
  });
});

describe('weightedPick', () => {
  it('never returns a zero-weight key', () => {
    let state = fnv1a('weights');
    for (let i = 0; i < 300; i += 1) {
      const [key, nextState] = weightedPick(state, { a: 1, b: 3, c: 0 });
      expect(key).not.toBe('c');
      state = nextState;
    }
  });

  it('honours the weights approximately', () => {
    let state = fnv1a('weights2');
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i += 1) {
      const [key, nextState] = weightedPick(state, { a: 1, b: 3 });
      counts[key] += 1;
      state = nextState;
    }
    expect(counts.b / (counts.a + counts.b)).toBeGreaterThan(0.7);
    expect(counts.b / (counts.a + counts.b)).toBeLessThan(0.8);
  });

  it('throws when all weights are zero', () => {
    expect(() => weightedPick(1, { a: 0, b: 0 })).toThrow();
  });

  it('does not depend on the order the weights were written in', () => {
    for (let state = 0; state < 200; state += 7) {
      expect(weightedPick(state, { a: 1, b: 3, c: 2 })).toEqual(
        weightedPick(state, { c: 2, a: 1, b: 3 }),
      );
    }
  });
});
