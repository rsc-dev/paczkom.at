import { isMessageKey, t } from '../i18n/index.js';
import { setAttr, setText } from './dom.js';

/** Fills `data-t` text and `data-t-label` aria-labels. Re-run on a language switch. */
export function applyStaticText(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-t]')) {
    const key = element.dataset['t'];
    if (key !== undefined && isMessageKey(key)) {
      setText(element, t(key));
    }
  }
  for (const element of root.querySelectorAll('[data-t-label]')) {
    const key = element.getAttribute('data-t-label') ?? '';
    if (isMessageKey(key)) {
      setAttr(element, 'aria-label', t(key));
    }
  }
}
