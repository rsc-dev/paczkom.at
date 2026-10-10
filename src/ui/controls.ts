import type { Mode } from '../core/game.js';

export type Command =
  | { readonly kind: 'step'; readonly dir: -1 | 1 }
  | { readonly kind: 'goto'; readonly pos: number }
  | { readonly kind: 'start'; readonly mode: Mode }
  | { readonly kind: 'clock' };

/** A/← and D/→ step one position; the numpad's 1–5 jump straight to one. */
const KEYS: Readonly<Record<string, Command>> = {
  KeyA: { kind: 'step', dir: -1 },
  ArrowLeft: { kind: 'step', dir: -1 },
  KeyD: { kind: 'step', dir: 1 },
  ArrowRight: { kind: 'step', dir: 1 },
  Numpad1: { kind: 'goto', pos: 1 },
  Numpad2: { kind: 'goto', pos: 2 },
  Numpad3: { kind: 'goto', pos: 3 },
  Numpad4: { kind: 'goto', pos: 4 },
  Numpad5: { kind: 'goto', pos: 5 },
  Space: { kind: 'start', mode: 'A' },
  Enter: { kind: 'start', mode: 'A' },
  KeyB: { kind: 'start', mode: 'B' },
};

export function commandForKey(code: string): Command | null {
  return Object.hasOwn(KEYS, code) ? (KEYS[code] ?? null) : null;
}

/** Where a movement command takes a courier standing at `current`; null for other commands. The rules clamp it. */
export function targetPos(current: number, command: Command): number | null {
  if (command.kind === 'step') {
    return current + command.dir;
  }
  return command.kind === 'goto' ? command.pos : null;
}

function commandFor(target: EventTarget | null): Command | null {
  const button = (target as Element | null)?.closest<HTMLElement>('[data-move],[data-start],[data-clock]');
  if (button === null || button === undefined) {
    return null;
  }
  const dir = button.dataset['move'];
  const mode = button.dataset['start'];
  if (dir === '-1' || dir === '1') {
    return { kind: 'step', dir: dir === '1' ? 1 : -1 };
  }
  if (mode === 'A' || mode === 'B') {
    return { kind: 'start', mode };
  }
  return button.hasAttribute('data-clock') ? { kind: 'clock' } : null;
}

/**
 * `pointerdown`, not `click`: a handheld button acts the moment it is pressed.
 * Keyboard and assistive-tech activation arrives as a `click` with no pointer
 * (`detail === 0`), which a real pointer press never produces, so nothing acts twice.
 */
export function bindControls(root: HTMLElement, lcd: Element, onCommand: (command: Command) => void): void {
  root.addEventListener('pointerdown', (event) => {
    const command = commandFor(event.target);
    if (command !== null) {
      event.preventDefault();
      onCommand(command);
    }
  });

  root.addEventListener('click', (event) => {
    if (event.detail === 0) {
      const command = commandFor(event.target);
      if (command !== null) {
        onCommand(command);
      }
    }
  });

  lcd.addEventListener('pointerdown', (event) => {
    const e = event as PointerEvent;
    const box = lcd.getBoundingClientRect();
    onCommand({ kind: 'step', dir: e.clientX - box.left < box.width / 2 ? -1 : 1 });
  });

  window.addEventListener('keydown', (event) => {
    // Browser shortcuts (Ctrl+L, Cmd+P…) and auto-repeat are not game input.
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const target = event.target as Element | null;
    // Text fields keep every key; a focused button or link keeps Enter and Space.
    if (target?.closest?.('textarea, input, select') != null) {
      return;
    }
    if ((event.code === 'Enter' || event.code === 'Space') && target?.closest?.('button, a') != null) {
      return;
    }
    const command = commandForKey(event.code);
    if (command !== null) {
      event.preventDefault();
      onCommand(command);
    }
  });
}
