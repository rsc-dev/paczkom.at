/**
 * The smallest possible DOM layer: find elements once, and only touch an
 * attribute or a text node when the value actually changed. Everything the view
 * writes is a `data-*` attribute or text — never a colour, never a class that
 * encodes a look.
 */

export function need<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`missing element: ${selector}`);
  }
  return found;
}

/** Writes only when the attribute differs, so the DOM stays quiet. */
export function setAttr(element: Element, name: string, value: string | null): void {
  const current = element.getAttribute(name);
  if (value === null) {
    if (current !== null) {
      element.removeAttribute(name);
    }
    return;
  }
  if (current !== value) {
    element.setAttribute(name, value);
  }
}

export function setText(element: Element, value: string): void {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

export function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) {
    element.hidden = hidden;
  }
}

export function setVar(element: HTMLElement, name: string, value: string): void {
  if (element.style.getPropertyValue(name) !== value) {
    element.style.setProperty(name, value);
  }
}

/** `0`–`1` as a CSS percentage, for the meter and patience bars. */
export function percent(fraction: number): string {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return `${String(Math.round(clamped * 1000) / 10)}%`;
}
