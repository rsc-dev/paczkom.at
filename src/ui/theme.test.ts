// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { initialState, reduce } from '../core/game.js';
import type { State } from '../core/game.js';
import { DAILY_PROFILE } from '../core/profiles.js';
import { setLang } from '../i18n/index.js';
import { createGameView, renderGame } from './render.js';
import type { GameView } from './render.js';
import { mountApp, recordMutations } from './testing.js';

let app: HTMLElement;
let view: GameView;
let state: State;

beforeEach(() => {
  setLang('pl');
  app = mountApp();
  state = reduce(initialState(7, DAILY_PROFILE), { type: 'start' });
  view = createGameView(document, state);
  renderGame(view, state);
});

/**
 * The theming promise (design D10): switching `data-theme` restyles everything
 * without the game touching the DOM. If a swap ever needed a re-render, a theme
 * would stop being "just a CSS file".
 */
describe('theme swap', () => {
  it('changes nothing in the document but the root attribute', () => {
    const recorder = recordMutations(app);
    document.documentElement.dataset['theme'] = 'dusk';

    expect(recorder.changed()).toEqual([]);
    recorder.stop();
    expect(document.documentElement.dataset['theme']).toBe('dusk');
  });

  it('leaves every door and parcel describing itself the same way', () => {
    const before = [...view.doors.values()].map((door) => ({
      state: door.root.dataset['state'],
      size: door.root.dataset['size'],
      hint: door.root.dataset['hint'],
    }));

    document.documentElement.dataset['theme'] = 'cozy-pixel';

    expect(
      [...view.doors.values()].map((door) => ({
        state: door.root.dataset['state'],
        size: door.root.dataset['size'],
        hint: door.root.dataset['hint'],
      })),
    ).toEqual(before);
  });

  it('describes doors and parcels only through data attributes', () => {
    // Nothing carries an inline colour, a look-bearing class or a glyph the
    // theme cannot replace.
    for (const door of view.doors.values()) {
      expect(door.root.className).toBe('door');
      expect(door.root.getAttribute('style') ?? '').not.toContain('color');
      expect(door.root.dataset['state']).toBeDefined();
      expect(door.root.dataset['size']).toBeDefined();
      expect(door.root.querySelector('.door__mark')?.textContent).toBe('');
    }

    const card = view.cards[0];
    expect(card?.swatch.dataset['colour']).toBeDefined();
    expect(card?.sticker.dataset['sticker']).toBeDefined();
  });
});
