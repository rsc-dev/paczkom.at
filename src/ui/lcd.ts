import { displayScore, level } from '../core/game.js';
import type { GameState, Mode } from '../core/game.js';
import { setAttr } from './dom.js';

export type LcdView =
  | { readonly kind: 'game'; readonly state: GameState; readonly blink: boolean }
  | { readonly kind: 'clock'; readonly hours: number; readonly minutes: number; readonly pos: number; readonly blink: boolean }
  | { readonly kind: 'record'; readonly mode: Mode; readonly record: number };

const DIGITS: Readonly<Record<string, string>> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', ' ': '',
};
const pad4 = (v: number): string => String(v).padStart(4, ' ');

export function displayText(view: LcdView): string {
  switch (view.kind) {
    case 'game':
      return view.state.over && !view.blink ? '    ' : pad4(displayScore(view.state.score));
    case 'record':
      return pad4(displayScore(view.record));
    case 'clock':
      return `${String(view.hours).padStart(2, ' ')}${String(view.minutes).padStart(2, '0')}`;
  }
}

export function litSegments(view: LcdView): Set<string> {
  const lit = new Set<string>();
  [...displayText(view)].forEach((char, i) => {
    for (const s of DIGITS[char] ?? '') {
      lit.add(`d${String(i)}${s}`);
    }
  });
  if (view.kind === 'clock') {
    lit.add(`c-${String(view.pos)}`);
    lit.add('t-0');
    if (view.blink) {
      lit.add('colon');
    }
    return lit;
  }
  if (view.kind === 'record') {
    lit.add(`lbl-${view.mode}`);
    return lit;
  }
  const { state, blink } = view;
  lit.add(`lbl-${state.mode}`);
  lit.add(`lv-${String(level(state.mode, state.score))}`);
  lit.add(`t-${String(state.thrower)}`);
  lit.add(`c-${String(state.pos)}`);
  for (let k = 1; k <= state.crate; k += 1) {
    lit.add(`k-${String(state.pos)}-${String(k)}`);
  }
  for (let h = 0; h < state.hearts; h += 1) {
    lit.add(`h-${String(h)}`);
  }
  for (const f of state.flights) {
    lit.add(`${f.kind === 'throw' ? 'p' : 'q'}-${String(f.spot)}-${String(f.step)}`);
    if (f.kind === 'drop') {
      lit.add(`drone-${String(f.spot)}`);
    }
  }
  if (state.bird !== null) {
    lit.add(`bird-${String(state.bird.spot)}`);
  }
  if (state.broken !== null && blink) {
    lit.add(`b-${String(state.broken)}`);
  }
  return lit;
}

export function renderLcd(svg: Element, view: LcdView): void {
  const lit = litSegments(view);
  for (const element of svg.querySelectorAll('[data-seg]')) {
    setAttr(element, 'data-on', lit.has(element.getAttribute('data-seg') ?? '') ? '' : null);
  }
  setAttr(svg, 'data-display', displayText(view));
}
