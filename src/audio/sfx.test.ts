import { describe, expect, it, vi } from 'vitest';
import type { Cue } from '../core/game.js';
import { createSfx } from './sfx.js';

/** Just enough of the Web Audio API to count the notes that were played. */
function fakeContext(): { context: AudioContext; starts: () => number; closed: () => boolean } {
  let started = 0;
  let closed = false;
  const param = (): unknown => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });

  const context = {
    currentTime: 0,
    state: 'running',
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
    resume: vi.fn(),
    close: () => {
      closed = true;
      return Promise.resolve();
    },
  } as unknown as AudioContext;

  return { context, starts: () => started, closed: () => closed };
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
