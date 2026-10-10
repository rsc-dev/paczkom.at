// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindControls, commandForKey, targetPos } from './controls.js';
import type { Command } from './controls.js';

describe('commandForKey', () => {
  it.each([
    ['KeyA', { kind: 'step', dir: -1 }], ['ArrowLeft', { kind: 'step', dir: -1 }],
    ['KeyD', { kind: 'step', dir: 1 }], ['ArrowRight', { kind: 'step', dir: 1 }],
    ['Numpad1', { kind: 'goto', pos: 1 }], ['Numpad5', { kind: 'goto', pos: 5 }],
    ['Space', { kind: 'start', mode: 'A' }], ['Enter', { kind: 'start', mode: 'A' }], ['KeyB', { kind: 'start', mode: 'B' }],
  ])('%s', (code, command) => {
    expect(commandForKey(code)).toEqual(command);
  });

  it('ignores up and down and everything else', () => {
    for (const code of ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'KeyQ', 'Numpad7', 'Digit1']) {
      expect(commandForKey(code), code).toBeNull();
    }
  });
});

describe('targetPos', () => {
  it('steps one position or jumps, and has no target for other commands', () => {
    expect(targetPos(3, { kind: 'step', dir: -1 })).toBe(2);
    expect(targetPos(5, { kind: 'step', dir: 1 })).toBe(6);
    expect(targetPos(3, { kind: 'goto', pos: 5 })).toBe(5);
    expect(targetPos(3, { kind: 'clock' })).toBeNull();
    expect(targetPos(3, { kind: 'start', mode: 'A' })).toBeNull();
  });
});

describe('bindControls', () => {
  it('steps towards the tapped half of the screen', () => {
    document.body.innerHTML = '<div id="root"><div id="lcd"></div></div>';
    const lcd = document.getElementById('lcd') as HTMLElement;
    lcd.getBoundingClientRect = () => ({ left: 100, top: 0, width: 400, height: 240 }) as DOMRect;
    const seen = vi.fn<(command: Command) => void>();
    bindControls(document.getElementById('root') as HTMLElement, lcd, seen);
    lcd.dispatchEvent(new MouseEvent('pointerdown', { clientX: 120 }));
    lcd.dispatchEvent(new MouseEvent('pointerdown', { clientX: 480 }));
    expect(seen.mock.calls.map(([c]) => c)).toEqual([{ kind: 'step', dir: -1 }, { kind: 'step', dir: 1 }]);
  });

  it('turns buttons and keys into commands', () => {
    document.body.innerHTML =
      '<div id="root"><button data-move="1"></button><button data-move="-1"></button><button data-start="B"></button><button data-clock></button><div id="lcd"></div></div>';
    const root = document.getElementById('root') as HTMLElement;
    const lcd = document.getElementById('lcd') as HTMLElement;
    const seen = vi.fn<(command: Command) => void>();
    bindControls(root, lcd, seen);
    for (const button of root.querySelectorAll('[data-move]')) {
      button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    }
    root.querySelector('[data-start]')?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    root.querySelector('[data-clock]')?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Numpad3' }));
    expect(seen.mock.calls.map(([c]) => c)).toEqual([
      { kind: 'step', dir: 1 }, { kind: 'step', dir: -1 }, { kind: 'start', mode: 'B' }, { kind: 'clock' }, { kind: 'goto', pos: 3 },
    ]);
  });
});

describe('keyboard and assistive tech', () => {
  function setup(): { root: HTMLElement; seen: ReturnType<typeof vi.fn<(command: Command) => void>> } {
    document.body.innerHTML =
      '<div id="root"><button data-start="B"></button><button id="other"></button><textarea></textarea><div id="lcd"></div></div>';
    const root = document.getElementById('root') as HTMLElement;
    const seen = vi.fn<(command: Command) => void>();
    bindControls(root, document.getElementById('lcd') as HTMLElement, seen);
    return { root, seen };
  }

  it('leaves Enter and Space to a focused button', () => {
    const { root, seen } = setup();
    const button = root.querySelector('#other') as HTMLElement;
    const enter = new KeyboardEvent('keydown', { code: 'Enter', bubbles: true, cancelable: true });
    button.dispatchEvent(enter);
    button.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
    expect(seen).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
  });

  it('activates a game button from the keyboard (a click with no pointer)', () => {
    const { root, seen } = setup();
    root.querySelector('[data-start]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(seen.mock.calls.map(([c]) => c)).toEqual([{ kind: 'start', mode: 'B' }]);
  });

  it('does not act twice for a pointer click that already fired pointerdown', () => {
    const { root, seen } = setup();
    const button = root.querySelector('[data-start]') as HTMLElement;
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('ignores keys typed into a text field', () => {
    const { root, seen } = setup();
    root.querySelector('textarea')?.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
    expect(seen).not.toHaveBeenCalled();
  });

  it('leaves browser shortcuts alone', () => {
    const { seen } = setup();
    for (const init of [{ code: 'KeyD', ctrlKey: true }, { code: 'ArrowLeft', metaKey: true }, { code: 'KeyA', altKey: true }]) {
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented, init.code).toBe(false);
    }
    expect(seen).not.toHaveBeenCalled();
  });
});
