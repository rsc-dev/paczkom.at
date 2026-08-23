/**
 * The view. It owns a stable DOM tree built once at boot and, on every
 * dispatch, writes only the `data-*` attributes and text that changed. It never
 * decides what anything looks like — the theme reads the attributes.
 */
import { activeCustomer, hintColumn, upcomingParcels } from '../core/game.js';
import type { SlotRuntime, State } from '../core/game.js';
import type { Parcel } from '../core/parcel.js';
import { stickerName, t } from '../i18n/index.js';
import { need, percent, setAttr, setHidden, setText, setVar } from './dom.js';
import type { HudNodes } from './hud.js';
import { renderHud } from './hud.js';
import type { PanelNodes } from './screen.js';
import { renderPanel } from './screen.js';
import { buildWallDom } from './wall.js';
import type { WallNodes } from './wall.js';

export interface CardNodes {
  readonly root: HTMLButtonElement;
  readonly badge: HTMLElement;
  readonly swatch: HTMLElement;
  readonly sticker: HTMLElement;
  readonly stickerName: HTMLElement;
  readonly kind: HTMLElement;
  readonly code: HTMLElement;
  readonly wait: HTMLElement;
}

/** How many parcels are visible behind the one in hand (design D5). */
export const UPCOMING_SHOWN = 2;

export interface GameView {
  readonly stage: HTMLElement;
  readonly tray: HTMLElement;
  readonly trayEmpty: HTMLElement;
  readonly doors: WallNodes;
  readonly cards: readonly CardNodes[];
  readonly hud: HudNodes;
  readonly panel: PanelNodes;
}

function createCard(): CardNodes {
  const root = document.createElement('button');
  root.type = 'button';
  root.className = 'card';
  root.hidden = true;

  const top = document.createElement('span');
  top.className = 'card__top';
  const badge = document.createElement('span');
  badge.className = 'size-badge';
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.hidden = true;
  const sticker = document.createElement('span');
  sticker.className = 'sticker';
  sticker.dataset['sticker'] = 'none';
  const stickerName = document.createElement('span');
  stickerName.className = 'visually-hidden';
  sticker.append(stickerName);
  const kind = document.createElement('span');
  kind.className = 'card__kind';
  top.append(badge, swatch, sticker, kind);

  const code = document.createElement('span');
  code.className = 'card__code';
  const wait = document.createElement('span');
  wait.className = 'card__wait';

  root.append(top, code, wait);
  return { root, badge, swatch, sticker, stickerName, kind, code, wait };
}

/** Builds the game view: doors from the wall geometry, plus a pool of cards. */
export function createGameView(root: ParentNode, state: State): GameView {
  const stage = need<HTMLElement>(root, '#stage');
  const tray = need<HTMLElement>(root, '#tray');

  stage.setAttribute('aria-label', t('a11y.wall'));

  const doors = buildWallDom(stage, state.slots, state.profile.columns);

  const cardCount = Math.max(state.profile.visibleCustomers, 2);
  const cards = Array.from({ length: cardCount }, () => createCard());
  const trayEmpty = document.createElement('span');
  trayEmpty.className = 'tray__empty';
  trayEmpty.hidden = true;

  tray.append(...cards.map((card) => card.root), trayEmpty);

  return {
    stage,
    tray,
    trayEmpty,
    doors,
    cards,
    hud: {
      phase: need<HTMLElement>(root, '#hud-phase'),
      clock: need<HTMLElement>(root, '#hud-clock'),
      meter: need<HTMLElement>(root, '#hud-meter'),
      count: need<HTMLElement>(root, '#hud-count'),
      score: need<HTMLElement>(root, '#hud-score'),
    },
    panel: {
      root: need<HTMLElement>(root, '#panel'),
      kicker: need<HTMLElement>(root, '#panel-kicker'),
      code: need<HTMLElement>(root, '#panel-code'),
      hint: need<HTMLElement>(root, '#panel-hint'),
      swatch: need<HTMLElement>(root, '#panel-swatch'),
      sticker: need<HTMLElement>(root, '#panel-sticker'),
      stickerName: need<HTMLElement>(root, '#panel-sticker-name'),
      hintText: need<HTMLElement>(root, '#panel-hint-text'),
      wait: need<HTMLElement>(root, '#panel-wait'),
    },
  };
}

export function doorLabel(slot: SlotRuntime): string {
  return t('door.label', {
    id: slot.id,
    size: t(`size.${slot.size}`),
    state: t(`door.state.${slot.state}`),
  });
}

function renderDoors(view: GameView, state: State): void {
  const hinted = hintColumn(state);
  for (const slot of state.slots) {
    const door = view.doors.get(slot.id);
    if (door === undefined) {
      continue;
    }
    setAttr(door.root, 'data-state', slot.state);
    setAttr(door.root, 'data-hint', hinted !== null && slot.col === hinted ? 'column' : null);
    setAttr(door.root, 'aria-label', doorLabel(slot));
  }
}

function renderUpcomingCard(card: CardNodes, parcel: Parcel): void {
  setHidden(card.root, false);
  setAttr(card.root, 'data-upcoming', 'true');
  setAttr(card.root, 'data-active', 'false');
  setAttr(card.root, 'data-customer', null);
  setAttr(card.root, 'data-kind', 'parcel');
  card.root.disabled = true;
  setText(card.badge, parcel.size);
  setHidden(card.swatch, false);
  setAttr(card.swatch, 'data-colour', parcel.colour);
  setAttr(card.sticker, 'data-sticker', parcel.sticker);
  setText(card.stickerName, parcel.sticker === 'none' ? '' : stickerName(parcel.sticker));
  setText(card.kind, t('screen.nextUp'));
  setText(card.code, parcel.code);
  setHidden(card.wait, true);
}

function renderTray(view: GameView, state: State): void {
  const cards = view.cards;

  if (state.phase === 'LOAD') {
    // The current parcel is on the screen panel; the tray shows the next two.
    const upcoming = upcomingParcels(state, UPCOMING_SHOWN);
    cards.forEach((card, index) => {
      const parcel = upcoming[index];
      if (parcel === undefined) {
        setHidden(card.root, true);
        return;
      }
      renderUpcomingCard(card, parcel);
    });
    setHidden(view.trayEmpty, upcoming.length > 0);
    setText(view.trayEmpty, t('screen.loadPrompt'));
    return;
  }

  if (state.phase === 'SERVE') {
    const visible = state.customers.filter((customer) => customer.visible);
    const active = activeCustomer(state);
    cards.forEach((card, index) => {
      const customer = visible[index];
      if (customer === undefined) {
        setHidden(card.root, true);
        return;
      }
      const parcel =
        customer.kind === 'pickup' ? state.parcels[customer.parcelId] : undefined;
      setHidden(card.root, false);
      card.root.disabled = false;
      setAttr(card.root, 'data-upcoming', 'false');
      setAttr(card.root, 'data-customer', customer.id);
      setAttr(card.root, 'data-kind', customer.kind);
      setAttr(card.root, 'data-active', customer.id === active?.id ? 'true' : 'false');
      // A customer's card never gives away what is behind the door.
      setHidden(card.swatch, true);
      setAttr(card.sticker, 'data-sticker', 'none');
      setText(card.stickerName, '');
      setText(
        card.badge,
        customer.kind === 'pickup' ? (parcel?.size ?? '') : customer.needsSize,
      );
      setText(card.kind, t(customer.kind === 'pickup' ? 'screen.pickup' : 'screen.sender'));
      setText(
        card.code,
        customer.kind === 'pickup' ? (parcel?.code ?? '') : t(`size.${customer.needsSize}`),
      );
      setHidden(card.wait, false);
      setVar(card.wait, '--fill', percent(1 - customer.waitedMs / state.profile.patienceMs));
    });
    setHidden(view.trayEmpty, visible.length > 0);
    setText(view.trayEmpty, t('screen.idle'));
    return;
  }

  for (const card of cards) {
    setHidden(card.root, true);
  }
  setHidden(view.trayEmpty, false);
  setText(view.trayEmpty, t('screen.sweepPrompt'));
}

/** Writes the whole state to the DOM, touching only what changed. */
export function renderGame(view: GameView, state: State): void {
  renderHud(view.hud, state);
  renderPanel(view.panel, state);
  renderDoors(view, state);
  renderTray(view, state);
}
