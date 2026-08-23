/**
 * The locker's own screen: the code in large tabular figures and, once the hint
 * ladder has moved, the parcel's colour and sticker underneath it in small
 * type. Whatever the panel says, the answer is still on the wall.
 */
import { activeCustomer, currentParcel, hintLevelOf } from '../core/game.js';
import type { Customer, State } from '../core/game.js';
import { hintLine, t } from '../i18n/index.js';
import { percent, setAttr, setHidden, setText, setVar } from './dom.js';

export interface PanelNodes {
  readonly root: HTMLElement;
  readonly kicker: HTMLElement;
  readonly code: HTMLElement;
  readonly hint: HTMLElement;
  readonly swatch: HTMLElement;
  readonly hintText: HTMLElement;
  readonly wait: HTMLElement;
}

interface PanelContent {
  readonly kicker: string;
  readonly code: string;
  /** True when `code` is prose rather than a four-digit code. */
  readonly prose: boolean;
  readonly hint: { readonly colour: string | null; readonly text: string } | null;
  /** Patience left, 0–1, or `null` when nobody is waiting. */
  readonly wait: number | null;
}

const IDLE: PanelContent = {
  kicker: '',
  code: '',
  prose: true,
  hint: null,
  wait: null,
};

function pickupContent(state: State, customer: Customer): PanelContent {
  if (customer.kind !== 'pickup') {
    return IDLE;
  }
  const parcel = state.parcels[customer.parcelId];
  const level = hintLevelOf(state, customer);
  return {
    kicker: t('screen.pickup'),
    code: parcel?.code ?? '',
    prose: false,
    hint:
      level >= 1 && parcel !== undefined
        ? { colour: parcel.colour, text: hintLine(parcel.colour, parcel.sticker) }
        : null,
    wait: 1 - customer.waitedMs / state.profile.patienceMs,
  };
}

function senderContent(state: State, customer: Customer): PanelContent {
  if (customer.kind !== 'sender') {
    return IDLE;
  }
  return {
    kicker: t('screen.sender'),
    code: t('screen.senderNeeds', { size: t(`size.${customer.needsSize}`) }),
    prose: true,
    hint: null,
    wait: 1 - customer.waitedMs / state.profile.patienceMs,
  };
}

/** Everything the panel shows, derived from state alone. */
export function panelContent(state: State): PanelContent {
  if (state.phase === 'LOAD') {
    const parcel = currentParcel(state);
    if (parcel === null) {
      return { ...IDLE, kicker: t('hud.phase.load'), code: t('screen.loadPrompt') };
    }
    return {
      kicker: t('screen.thisParcel'),
      code: parcel.code,
      prose: false,
      hint: { colour: parcel.colour, text: hintLine(parcel.colour, parcel.sticker) },
      wait: null,
    };
  }

  if (state.phase === 'SERVE') {
    const customer = activeCustomer(state);
    if (customer === null) {
      return { ...IDLE, kicker: t('hud.phase.serve'), code: t('screen.idle') };
    }
    return customer.kind === 'pickup'
      ? pickupContent(state, customer)
      : senderContent(state, customer);
  }

  const marked = state.slots.filter((slot) => slot.state === 'marked').length;
  return {
    kicker: t('hud.phase.sweep'),
    code: t('screen.sweepPrompt'),
    prose: true,
    hint: { colour: null, text: t('screen.sweepRemaining', { count: marked }) },
    wait: null,
  };
}

export function renderPanel(nodes: PanelNodes, state: State): void {
  const content = panelContent(state);
  setText(nodes.kicker, content.kicker);
  setText(nodes.code, content.code);
  setAttr(nodes.code, 'data-empty', content.prose ? 'true' : 'false');

  setHidden(nodes.hint, content.hint === null);
  if (content.hint !== null) {
    setText(nodes.hintText, content.hint.text);
    setHidden(nodes.swatch, content.hint.colour === null);
    setAttr(nodes.swatch, 'data-colour', content.hint.colour);
  }

  setHidden(nodes.wait, content.wait === null);
  setVar(nodes.wait, '--fill', percent(content.wait ?? 0));
}
