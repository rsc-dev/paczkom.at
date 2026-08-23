// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../core/game.js';
import { bindGameInput, onFirstGesture } from './input.js';

let stage: HTMLElement;
let tray: HTMLElement;
let actions: Action[];

beforeEach(() => {
  document.body.innerHTML = `
    <div id="stage">
      <button class="door" data-slot="c1r2"><span class="door__face"><span class="door__size">B</span></span></button>
      <section id="panel"><span id="panel-code">1234</span></section>
    </div>
    <div id="tray">
      <button class="card" data-customer="k4"><span class="card__code">1234</span></button>
      <button class="card" data-upcoming="true"><span class="card__code">5678</span></button>
    </div>`;
  stage = document.querySelector<HTMLElement>('#stage')!;
  tray = document.querySelector<HTMLElement>('#tray')!;
  actions = [];
  bindGameInput(stage, tray, (action) => actions.push(action));
});

describe('bindGameInput', () => {
  it('turns a tap anywhere inside a door into tapSlot', () => {
    document.querySelector<HTMLElement>('.door__size')?.click();
    expect(actions).toEqual([{ type: 'tapSlot', slotId: 'c1r2' }]);
  });

  it('ignores a tap on the stage that is not a door', () => {
    document.querySelector<HTMLElement>('#panel-code')?.click();
    expect(actions).toEqual([]);
  });

  it('turns a tap on a customer card into selectCustomer', () => {
    document.querySelector<HTMLElement>('.card__code')?.click();
    expect(actions).toEqual([{ type: 'selectCustomer', customerId: 'k4' }]);
  });

  it('ignores a tap on an upcoming-parcel card', () => {
    document.querySelectorAll<HTMLElement>('.card')[1]?.click();
    expect(actions).toEqual([]);
  });
});

describe('onFirstGesture', () => {
  it('runs once, on the first pointer event', () => {
    const handler = vi.fn();
    onFirstGesture(window, handler);

    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('also counts a key press, for keyboard players', () => {
    const handler = vi.fn();
    onFirstGesture(window, handler);
    window.dispatchEvent(new Event('keydown'));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
