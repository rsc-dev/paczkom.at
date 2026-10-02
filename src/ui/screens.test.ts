// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n/index.js';
import { applyStaticText, showScreen } from './screens.js';
import { mountApp } from './testing.js';

let app: HTMLElement;
beforeEach(() => {
  setLang('pl');
  app = mountApp();
});

describe('screens', () => {
  it('has one section per screen name', () => {
    for (const name of ['loading', 'error', 'picker', 'card', 'ranking']) {
      expect(document.querySelector(`#screen-${name}`), name).not.toBeNull();
    }
  });

  it('switches by data-screen and fills static text', () => {
    showScreen(app, 'ranking');
    expect(app.dataset['screen']).toBe('ranking');
    applyStaticText(document);
    expect(document.querySelector('#ranking-title')?.textContent).toBe('Polska teraz');
  });
});
