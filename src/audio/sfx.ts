/**
 * Square-wave beeps like an LCD handheld, no audio files.
 *
 * The `AudioContext` is created lazily inside the first user gesture — iOS will
 * not let a page make noise before that — and never at all while muted, so a
 * muted session allocates no audio hardware.
 */
import type { GameEvent } from '../core/game.js';

export type Cue = 'step' | 'throw' | 'catch' | 'miss' | 'deliver' | 'bonus' | 'over';

/** The cue a game event makes; a drone drop sounds like a throw, the bird is silent. */
export function cueFor(event: GameEvent): Cue | null {
  switch (event) {
    case 'step':
    case 'throw':
    case 'catch':
    case 'miss':
    case 'deliver':
    case 'bonus':
    case 'over':
      return event;
    case 'drop':
      return 'throw';
    case 'bird':
      return null;
  }
}

export interface Sfx {
  /** Called from the first pointer/key event; a no-op while muted. */
  unlock(): void;
  play(cue: Cue): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** For tests and for the "muted at boot" guarantee. */
  hasContext(): boolean;
}

type ContextFactory = () => AudioContext | null;

export interface SfxOptions {
  readonly muted?: boolean;
  readonly createContext?: ContextFactory;
}

function browserContext(): AudioContext | null {
  const Ctor = globalThis.AudioContext;
  if (typeof Ctor !== 'function') {
    return null;
  }
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

interface Voice {
  readonly type: OscillatorType;
  readonly from: number;
  readonly to: number;
  readonly durationMs: number;
  readonly gain: number;
  readonly delayMs?: number;
}

/** One to three short square-wave notes per cue — that is the whole instrument. */
const VOICES: Readonly<Record<Cue, readonly Voice[]>> = {
  step: [{ type: 'square', from: 1200, to: 1200, durationMs: 18, gain: 0.05 }],
  catch: [{ type: 'square', from: 1760, to: 1760, durationMs: 60, gain: 0.12 }],
  miss: [{ type: 'square', from: 220, to: 110, durationMs: 300, gain: 0.16 }],
  throw: [
    { type: 'square', from: 1320, to: 1320, durationMs: 50, gain: 0.06 },
    { type: 'square', from: 1660, to: 1660, durationMs: 50, gain: 0.06, delayMs: 70 },
  ],
  deliver: [
    { type: 'square', from: 523, to: 523, durationMs: 90, gain: 0.1 },
    { type: 'square', from: 659, to: 659, durationMs: 90, gain: 0.1, delayMs: 100 },
    { type: 'square', from: 784, to: 784, durationMs: 140, gain: 0.1, delayMs: 200 },
  ],
  bonus: [
    { type: 'square', from: 1046, to: 1046, durationMs: 90, gain: 0.1 },
    { type: 'square', from: 1318, to: 1318, durationMs: 90, gain: 0.1, delayMs: 100 },
    { type: 'square', from: 1568, to: 1568, durationMs: 140, gain: 0.1, delayMs: 200 },
  ],
  over: [
    { type: 'square', from: 784, to: 784, durationMs: 150, gain: 0.12 },
    { type: 'square', from: 659, to: 659, durationMs: 150, gain: 0.12, delayMs: 170 },
    { type: 'square', from: 523, to: 523, durationMs: 300, gain: 0.12, delayMs: 340 },
  ],
};

export function createSfx(options: SfxOptions = {}): Sfx {
  const createContext: ContextFactory = options.createContext ?? browserContext;
  let muted = options.muted ?? false;
  let context: AudioContext | null = null;

  const ensureContext = (): AudioContext | null => {
    if (muted) {
      return null;
    }
    context ??= createContext();
    return context;
  };

  const playVoice = (ctx: AudioContext, voice: Voice): void => {
    const start = ctx.currentTime + (voice.delayMs ?? 0) / 1000;
    const end = start + voice.durationMs / 1000;

    const oscillator = ctx.createOscillator();
    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.from, start);
    if (voice.to !== voice.from) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(voice.to, 1), end);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(voice.gain, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  };

  return {
    unlock(): void {
      const ctx = ensureContext();
      if (ctx !== null && ctx.state !== 'running') {
        void ctx.resume();
      }
    },

    play(cue: Cue): void {
      if (muted) {
        return;
      }
      const ctx = ensureContext();
      if (ctx === null) {
        return;
      }
      // A context can be suspended again by the browser — a phone call, a
      // backgrounded tab — long after the gesture that unlocked it.
      if (ctx.state !== 'running') {
        void ctx.resume();
      }
      try {
        for (const voice of VOICES[cue]) {
          playVoice(ctx, voice);
        }
      } catch {
        // A dead audio context must never take the game down with it.
      }
    },

    setMuted(next: boolean): void {
      muted = next;
      if (muted && context !== null) {
        void context.close();
        context = null;
      }
    },

    isMuted(): boolean {
      return muted;
    },

    hasContext(): boolean {
      return context !== null;
    },
  };
}
