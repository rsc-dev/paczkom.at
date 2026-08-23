/**
 * Pointer input. Two delegated listeners turn taps on doors and customer cards
 * into actions; nothing else in the view knows about events.
 */
import type { Action } from '../core/game.js';

export type Dispatch = (action: Action) => void;

function closestWithData(target: EventTarget | null, attribute: string): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const found = target.closest<HTMLElement>(`[${attribute}]`);
  return found;
}

/** Maps a tap on a door to `tapSlot`, and on a customer card to `selectCustomer`. */
export function bindGameInput(stage: HTMLElement, tray: HTMLElement, dispatch: Dispatch): void {
  stage.addEventListener('click', (event) => {
    const door = closestWithData(event.target, 'data-slot');
    const slotId = door?.dataset['slot'];
    if (slotId !== undefined) {
      dispatch({ type: 'tapSlot', slotId });
    }
  });

  tray.addEventListener('click', (event) => {
    const card = closestWithData(event.target, 'data-customer');
    const customerId = card?.dataset['customer'];
    if (customerId !== undefined && customerId !== '') {
      dispatch({ type: 'selectCustomer', customerId });
    }
  });
}

/**
 * Runs `handler` once, on the first pointer event anywhere. This is what
 * unlocks audio on iOS: the context may only be created inside a gesture.
 */
export function onFirstGesture(target: EventTarget, handler: () => void): void {
  const once = (): void => {
    target.removeEventListener('pointerdown', once);
    target.removeEventListener('keydown', once);
    handler();
  };
  target.addEventListener('pointerdown', once);
  target.addEventListener('keydown', once);
}
