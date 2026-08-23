import { describe, expect, it, vi } from 'vitest';
import type { Cue } from '../core/game.js';
import { createSfx } from './sfx.js';

/** Just enough of the Web Audio API to count the notes that were played. */
function fakeContext(state: AudioContextState = 'running'): {
  context: AudioContext;
  starts: () => number;
  closed: () => boolean;
  resumes: () => number;
} {
  let started = 0;
  let closed = false;
  let resumed = 0;
  const param = (): unknown => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });

  const context = {
    currentTime: 0,
    state,
    destination: {},
    createOscillator: (): unknown => ({
      type: 'sine',
      frequency: param(),
      connect: vi.fn(),
      start: () => {
        started += 1;
      },
      stop: vi.fn(),
    }),
    createGain: (): unknown => ({ gain: param(), connect: vi.fn() }),
    resume: () => {
      resumed += 1;
      return Promise.resolve();
    },
    close: () => {
      closed = true;
      return Promise.resolve();
    },
  } as unknown as AudioContext;

  return { context, starts: () => started, closed: () => closed, resumes: () => resumed };
}

describe('createSfx', () => {
  it('creates no audio context before the first gesture', () => {
    const create = vi.fn(() => fakeContext().context);
    const sfx = createSfx({ createContext: create });
    expect(sfx.hasContext()).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates one on unlock and reuses it', () => {
    const create = vi.fn(() => fakeContext().context);
    const sfx = createSfx({ createContext: create });
    sfx.unlock();
    sfx.unlock();
    sfx.play('tap');
    expect(create).toHaveBeenCalledTimes(1);
    expect(sfx.hasContext()).toBe(true);
  });

  it('never creates one while muted at boot', () => {
    const create = vi.fn(() => fakeContext().context);
    const sfx = createSfx({ muted: true, createContext: create });
    sfx.unlock();
    for (const cue of ['tap', 'door', 'wrong', 'done'] as Cue[]) {
      sfx.play(cue);
    }
    expect(create).not.toHaveBeenCalled();
    expect(sfx.hasContext()).toBe(false);
    expect(sfx.isMuted()).toBe(true);
  });

  it('plays each cue once, with a voice per note', () => {
    const fake = fakeContext();
    const sfx = createSfx({ createContext: () => fake.context });
    sfx.unlock();

    sfx.play('tap');
    expect(fake.starts()).toBe(1);
    sfx.play('wrong');
    expect(fake.starts()).toBe(2);
    // `done` is the two-note chime.
    sfx.play('done');
    expect(fake.starts()).toBe(4);
  });

  it('resumes a context the browser suspended, on unlock and on every cue', () => {
    // Safari suspends the context again after a phone call or a backgrounded
    // tab, long after the gesture that first unlocked it.
    const fake = fakeContext('suspended');
    const sfx = createSfx({ createContext: () => fake.context });

    sfx.unlock();
    expect(fake.resumes()).toBe(1);

    sfx.play('tap');
    expect(fake.resumes()).toBe(2);
    expect(fake.starts()).toBe(1);
  });

  it('does not resume a context that is already running', () => {
    const fake = fakeContext('running');
    const sfx = createSfx({ createContext: () => fake.context });
    sfx.unlock();
    sfx.play('tap');
    expect(fake.resumes()).toBe(0);
  });

  it('goes silent the moment it is muted, and drops the context', () => {
    const fake = fakeContext();
    const sfx = createSfx({ createContext: () => fake.context });
    sfx.unlock();
    sfx.play('door');
    const before = fake.starts();

    sfx.setMuted(true);
    sfx.play('door');
    sfx.play('wrong');

    expect(fake.starts()).toBe(before);
    expect(fake.closed()).toBe(true);
    expect(sfx.hasContext()).toBe(false);
  });

  it('comes back when unmuted', () => {
    const create = vi.fn(() => fakeContext().context);
    const sfx = createSfx({ muted: true, createContext: create });
    sfx.play('tap');
    expect(create).not.toHaveBeenCalled();

    sfx.setMuted(false);
    sfx.play('tap');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('survives a browser with no AudioContext', () => {
    const sfx = createSfx({ createContext: () => null });
    expect(() => {
      sfx.unlock();
      sfx.play('done');
    }).not.toThrow();
    expect(sfx.hasContext()).toBe(false);
  });

  it('survives a context that throws mid-cue', () => {
    const context = {
      currentTime: 0,
      state: 'running',
      destination: {} as AudioNode,
      createOscillator: () => {
        throw new Error('context is closed');
      },
      createGain: () => {
        throw new Error('context is closed');
      },
      resume: vi.fn(),
      close: () => Promise.resolve(),
    } as unknown as AudioContext;

    const sfx = createSfx({ createContext: () => context });
    sfx.unlock();
    expect(() => {
      sfx.play('wrong');
    }).not.toThrow();
  });
});
