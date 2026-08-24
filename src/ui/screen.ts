/**
 * The locker's own screen: the code in large tabular figures and, once the hint
 * ladder has moved, the parcel's colour and sticker underneath it in small
 * type. Whatever the panel says, the answer is still on the wall.
 */
import { activeCustomer, currentParcel, displayCode, hintLevelOf } from '../core/game.js';
import type { Customer, State } from '../core/game.js';
import type { Colour, Sticker } from '../core/parcel.js';
import type { Size } from '../core/wall.js';
import { hintLine, stickerName, t } from '../i18n/index.js';
import { percent, setAttr, setHidden, setText, setVar } from './dom.js';

export interface PanelNodes {
  readonly root: HTMLElement;
  readonly kicker: HTMLElement;
  readonly code: HTMLElement;
  readonly hint: HTMLElement;
  readonly swatch: HTMLElement;
  readonly sticker: HTMLElement;
  readonly stickerName: HTMLElement;
  readonly hintText: HTMLElement;
  readonly wait: HTMLElement;
}

interface PanelHint {
  readonly colour: Colour | null;
  /** The theme draws the glyph from `data-sticker`; the name is read out. */
  readonly sticker: Sticker;
  readonly text: string;
}

interface PanelContent {
  readonly kicker: string;
  readonly code: string;
  /** True when `code` is prose rather than a four-digit code. */
  readonly prose: boolean;
  readonly hint: PanelHint | null;
  /** Patience left, 0–1, or `null` when nobody is waiting. */
  readonly wait: number | null;
  /**
   * The size of the parcel in hand, or the box a sender needs. The courier has
   * to pick a door that takes it, so it cannot be left to guesswork.
   */
  readonly size: Size | null;
}

const IDLE: PanelContent = {
  kicker: '',
  code: '',
  prose: true,
  hint: null,
  wait: null,
  size: null,
};

function pickupContent(state: State, customer: Customer): PanelContent {
  if (customer.kind !== 'pickup') {
    return IDLE;
  }
  const parcel = state.parcels[customer.parcelId];
  const level = hintLevelOf(state, customer);
  const look =
    parcel === undefined
      ? null
      : {
          colour: parcel.colour,
          sticker: parcel.sticker,
          text: hintLine(parcel.colour, parcel.sticker),
        };

  // Someone who has lost their code can only describe the parcel — so the
  // description takes the place of the digits, and it is always on show.
  if (customer.forgotten) {
    return {
      kicker: t('screen.pickup'),
      code: t('screen.forgottenCode'),
      prose: true,
      hint:
        look === null || parcel === undefined
          ? null
          : {
              ...look,
              text: t('screen.describes', {
                size: t(`size.${parcel.size}`),
                look: look.text,
              }),
            },
      wait: 1 - customer.waitedMs / state.profile.patienceMs,
      size: parcel?.size ?? null,
    };
  }

  return {
    kicker: t('screen.pickup'),
    code: displayCode(state, parcel?.code ?? ''),
    prose: false,
    hint: level >= 1 ? look : null,
    wait: 1 - customer.waitedMs / state.profile.patienceMs,
    size: parcel?.size ?? null,
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
    size: customer.needsSize,
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
      code: displayCode(state, parcel.code),
      prose: false,
      hint: {
        colour: parcel.colour,
        sticker: parcel.sticker,
        // The size belongs here: the courier has to choose a door that takes it.
        text: t('screen.describes', {
          size: t(`size.${parcel.size}`),
          look: hintLine(parcel.colour, parcel.sticker),
        }),
      },
      wait: null,
      size: parcel.size,
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
    hint: { colour: null, sticker: 'none', text: t('screen.sweepRemaining', { count: marked }) },
    wait: null,
    size: null,
  };
}

export function renderPanel(nodes: PanelNodes, state: State): void {
  const content = panelContent(state);
  setText(nodes.kicker, content.kicker);
  setText(nodes.code, content.code);
  setAttr(nodes.code, 'data-empty', content.prose ? 'true' : 'false');

  // Cleared rather than merely hidden: a hidden element that still holds the
  // last customer's description is a description of the wrong parcel, and
  // assistive tech does not always agree with us about what "hidden" means.
  setHidden(nodes.hint, content.hint === null);
  setText(nodes.hintText, content.hint?.text ?? '');
  setHidden(nodes.swatch, content.hint?.colour == null);
  setAttr(nodes.swatch, 'data-colour', content.hint?.colour ?? null);
  // The theme draws the sticker glyph from `data-sticker`; screen readers get
  // the name, since CSS-generated content is not reliably announced.
  setAttr(nodes.sticker, 'data-sticker', content.hint?.sticker ?? 'none');
  setText(
    nodes.stickerName,
    content.hint === null || content.hint.sticker === 'none'
      ? ''
      : stickerName(content.hint.sticker),
  );

  setHidden(nodes.wait, content.wait === null);
  setVar(nodes.wait, '--fill', percent(content.wait ?? 0));

  // The theme can tint by size; the player reads it off the description line.
  setAttr(nodes.root, 'data-size', content.size);
}
