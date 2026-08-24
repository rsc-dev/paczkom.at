/**
 * The reputation meter: filled stars for what is left, hollow ones for what has
 * gone. The stars that went *this day* are marked so the theme can animate them
 * out on the day-summary screen; what that looks like is a CSS decision.
 */
import { STARTING_STARS } from '../core/week.js';
import { t } from '../i18n/index.js';
import { setAttr } from './dom.js';

export interface StarsModel {
  readonly stars: number;
  /** Stars lost in the day just played; drawn as the ones fading out. */
  readonly lost?: number;
  readonly total?: number;
}

export function renderStars(element: HTMLElement, model: StarsModel): void {
  const total = model.total ?? STARTING_STARS;
  const lost = model.lost ?? 0;

  while (element.children.length > total) {
    element.lastElementChild?.remove();
  }
  while (element.children.length < total) {
    const star = document.createElement('span');
    star.className = 'stars__star';
    star.setAttribute('aria-hidden', 'true');
    element.append(star);
  }

  [...element.children].forEach((child, index) => {
    const filled = index < model.stars;
    // The lost ones sit immediately above what is left.
    const justLost = index >= model.stars && index < model.stars + lost;
    setAttr(child, 'data-filled', String(filled));
    setAttr(child, 'data-lost', justLost ? 'true' : null);
  });

  setAttr(element, 'role', 'img');
  setAttr(element, 'aria-label', t('hud.stars', { count: model.stars, total }));
}
