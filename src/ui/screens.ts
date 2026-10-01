import { isMessageKey, t } from '../i18n/index.js';
import { setText } from './dom.js';

export type ScreenName = 'loading' | 'error' | 'picker' | 'card' | 'ranking';

export function showScreen(app: HTMLElement, name: ScreenName): void {
  if (app.dataset['screen'] !== name) {
    app.dataset['screen'] = name;
  }
}

/** Fills every element carrying a `data-t` key. Re-run on a language switch. */
export function applyStaticText(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-t]')) {
    const key = element.dataset['t'];
    if (key !== undefined && isMessageKey(key)) {
      setText(element, t(key));
    }
  }
}
