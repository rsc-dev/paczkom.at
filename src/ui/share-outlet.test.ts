// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n/index.js';
import { failScreenNodes, weekScreenNodes, weekShareOutlet } from './week-screens.js';
import type { FailScreenNodes, WeekScreenNodes } from './week-screens.js';
import type { ScreenName } from './screens.js';
import { mountApp } from './testing.js';

let week: WeekScreenNodes;
let fail: FailScreenNodes;

beforeEach(() => {
  setLang('pl');
  mountApp();
  week = weekScreenNodes(document);
  fail = failScreenNodes(document);
});

describe('where a week share confirmation goes', () => {
  it('to the Reklamacja screen when that is what is showing', () => {
    const outlet = weekShareOutlet('fail', week, fail);
    expect(outlet.shareNote).toBe(fail.shareNote);
    expect(outlet.fallback).toBe(fail.fallback);
  });

  it('to the week summary otherwise', () => {
    for (const screen of ['week', 'title', 'game'] as ScreenName[]) {
      const outlet = weekShareOutlet(screen, week, fail);
      expect(outlet.shareNote, screen).toBe(week.shareNote);
      expect(outlet.fallback, screen).toBe(week.fallback);
    }
  });

  it('never to the screen that is hidden', () => {
    const app = document.querySelector<HTMLElement>('#app');
    if (app === null) {
      throw new Error('no app');
    }
    app.dataset['screen'] = 'fail';
    const outlet = weekShareOutlet('fail', week, fail);
    // The week summary is the hidden one here, and it is not the outlet.
    expect(outlet.fallback.closest('#screen-week')).toBeNull();
    expect(outlet.fallback.closest('#screen-fail')).not.toBeNull();
  });
});
