/**
 * Four synthesised cues, no audio files (design D11).
 *
 * The `AudioContext` is created lazily inside the first user gesture — iOS will
 * not let a page make noise before that — and never at all while muted, so a
 * muted session allocates no audio hardware.
 */
import type { Cue } from '../core/game.js';

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

/** One or two short oscillator sweeps per cue — that is the whole instrument. */
const VOICES: Readonly<Record<Cue, readonly Voice[]>> = {
  tap: [{ type: 'triangle', from: 880, to: 660, durationMs: 45, gain: 0.14 }],
  door: [{ type: 'sine', from: 190, to: 70, durationMs: 170, gain: 0.3 }],
  wrong: [{ type: 'sawtooth', from: 150, to: 80, durationMs: 220, gain: 0.16 }],
  done: [
    { type: 'sine', from: 660, to: 660, durationMs: 160, gain: 0.18 },
    { type: 'sine', from: 880, to: 880, durationMs: 260, gain: 0.18, delayMs: 150 },
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
