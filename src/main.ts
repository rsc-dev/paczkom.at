/**
 * Boot and wiring. Everything that decides something lives in a tested module
 * (route, card, ranking, picker); this file owns the browser: fetch, storage,
 * geolocation, the share sheet and events.
 */
import './theme/fonts.css';
import './theme/tokens.css';
import './theme/app.css';

import { isNationalSummary, isTownCard, isTownIndex } from './core/publish.js';
import type { NationalSummary, TownCard, TownIndexEntry } from './core/publish.js';
import { fetchJson } from './data.js';
import { detectLang, getLang, otherLang, setLang, t } from './i18n/index.js';
import { parseRoute, resolveInitialTown } from './route.js';
import { STORAGE_KEYS, storage } from './storage.js';
import { cardModel, cardNodes, isStale, renderCard, shareTextFor } from './ui/card.js';
import type { CardNodes } from './ui/card.js';
import { need, setHidden, setText } from './ui/dom.js';
import { formatWhen } from './ui/format.js';
import { pickerNodes, renderSuggestions, townFromPosition } from './ui/picker.js';
import { rankingNodes, renderRanking } from './ui/ranking.js';
import { createRequestToken } from './ui/request-token.js';
import { applyStaticText, showScreen } from './ui/screens.js';
import type { ScreenName } from './ui/screens.js';
import { shareText, targetsFrom } from './ui/share.js';

const app = need<HTMLElement>(document, '#app');
const picker = pickerNodes(document);
const card: CardNodes = cardNodes(document);
const ranking = rankingNodes(document);
const langButton = need<HTMLButtonElement>(document, '#btn-lang');
const staleNotice = need<HTMLElement>(document, '#notice-stale');
const route = parseRoute(location.pathname, location.search);
const requests = createRequestToken();

type PickerStatusKey = 'picker.locating' | 'picker.locateFailed' | null;

let towns: TownIndexEntry[] = [];
let current: { slug: string; shared: boolean } | null = null;
/** The card last painted, so a language toggle can re-render without re-fetching. */
let lastCard: TownCard | null = null;
/** The ranking last painted, for the same reason. */
let lastSummary: NationalSummary | null = null;
/** Which status message the picker is showing, so a language toggle can re-translate it. */
let pickerStatusKey: PickerStatusKey = null;

setLang(detectLang({ stored: storage.get(STORAGE_KEYS.lang), navigatorLanguage: navigator.language }));
setHidden(need(document, '#notice-retired'), !route.retired);

function paintStatic(): void {
  document.documentElement.lang = getLang();
  applyStaticText(document);
  setText(langButton, t('lang.toggle'));
}

function paintStaleNotice(updatedAt: string): void {
  const stale = isStale(updatedAt, Date.now());
  setText(staleNotice, stale ? t('stale.warning', { time: formatWhen(Date.parse(updatedAt), getLang()) }) : '');
  setHidden(staleNotice, !stale);
}

/**
 * The only place screens change. The stale notice is about the card
 * specifically, so it is hidden on every other screen and repainted (from
 * the last loaded card, if any) whenever the card is shown.
 */
function goTo(name: ScreenName): void {
  showScreen(app, name);
  if (name !== 'card') {
    setHidden(staleNotice, true);
  } else if (lastCard !== null) {
    paintStaleNotice(lastCard.updatedAt);
  }
}

function setPickerStatus(key: PickerStatusKey): void {
  pickerStatusKey = key;
  setText(picker.status, key === null ? '' : t(key));
}

async function openTown(slug: string, shared: boolean): Promise<void> {
  const token = requests.next();
  goTo('loading');
  const data = await fetchJson(`/data/towns/${slug}.json`, isTownCard);
  if (!requests.isCurrent(token)) {
    // A newer request has since taken over; this response is stale.
    return;
  }
  if (data === null) {
    goTo('error');
    return;
  }
  current = { slug, shared };
  lastCard = data;
  renderCard(card, cardModel(data, getLang()));
  setHidden(card.makeMine, !shared);
  setText(card.note, '');
  setHidden(card.fallback, true);
  card.share.onclick = () => void share(shareTextFor(data, getLang()));
  goTo('card');
}

async function share(text: string | null): Promise<void> {
  if (text === null) {
    return;
  }
  const outcome = await shareText(text, targetsFrom(navigator));
  const notes = { shared: 'card.shared', copied: 'card.copied', manual: 'card.manual', dismissed: null } as const;
  const key = notes[outcome];
  setText(card.note, key === null ? '' : t(key));
  if (outcome === 'manual') {
    card.fallback.value = text;
    setHidden(card.fallback, false);
    card.fallback.select();
  }
}

function choose(slug: string): void {
  storage.set(STORAGE_KEYS.town, slug);
  // A shared link (/krakow/) must not win over this choice on a later retry or reload.
  history.replaceState(null, '', '/');
  void openTown(slug, false);
}

function showPicker(): void {
  picker.input.value = '';
  renderSuggestions(picker, towns, '');
  setPickerStatus(null);
  goTo('picker');
  picker.input.focus();
}

async function boot(): Promise<void> {
  paintStatic();
  goTo('loading');
  const index = await fetchJson('/data/index.json', isTownIndex);
  if (index === null) {
    goTo('error');
    return;
  }
  towns = index;
  const initial = resolveInitialTown(route.slug, storage.get(STORAGE_KEYS.town), new Set(towns.map((x) => x.slug)));
  if (initial === null) {
    showPicker();
  } else {
    await openTown(initial.slug, initial.shared);
  }
}

picker.input.addEventListener('input', () => {
  renderSuggestions(picker, towns, picker.input.value);
});
picker.results.addEventListener('click', (event) => {
  const slug = (event.target as HTMLElement).closest<HTMLElement>('[data-slug]')?.dataset['slug'];
  if (slug !== undefined) {
    choose(slug);
  }
});
picker.locate.addEventListener('click', () => {
  if (navigator.geolocation === undefined) {
    setPickerStatus('picker.locateFailed');
    return;
  }
  setPickerStatus('picker.locating');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (app.dataset['screen'] !== 'picker') {
        // Left the picker while locating; a late result must not jump the reader back to it.
        return;
      }
      const town = townFromPosition(position.coords.latitude, position.coords.longitude, towns);
      if (town === null) {
        setPickerStatus('picker.locateFailed');
      } else {
        choose(town.slug);
      }
    },
    () => {
      if (app.dataset['screen'] !== 'picker') {
        return;
      }
      setPickerStatus('picker.locateFailed');
    },
    { maximumAge: 600_000, timeout: 15_000 },
  );
});
need(document, '#btn-change').addEventListener('click', showPicker);
card.makeMine.addEventListener('click', () => {
  if (current !== null) {
    choose(current.slug);
  }
});
need(document, '#btn-ranking').addEventListener('click', () => {
  void (async () => {
    goTo('loading');
    const summary = await fetchJson('/data/national.json', isNationalSummary);
    if (summary === null) {
      goTo('error');
      return;
    }
    lastSummary = summary;
    renderRanking(ranking, summary, getLang());
    goTo('ranking');
  })();
});
need(document, '#btn-ranking-back').addEventListener('click', () => {
  if (current === null) {
    showPicker();
  } else {
    void openTown(current.slug, current.shared);
  }
});
need(document, '#btn-retry').addEventListener('click', () => void boot());
langButton.addEventListener('click', () => {
  setLang(otherLang());
  storage.set(STORAGE_KEYS.lang, getLang());
  paintStatic();
  setPickerStatus(pickerStatusKey);
  const screen = app.dataset['screen'];
  if (screen === 'card' && lastCard !== null) {
    renderCard(card, cardModel(lastCard, getLang()));
    paintStaleNotice(lastCard.updatedAt);
  } else if (screen === 'ranking' && lastSummary !== null) {
    renderRanking(ranking, lastSummary, getLang());
  }
});

void boot();
