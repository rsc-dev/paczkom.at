/**
 * Boot and wiring. Everything that decides something lives in a tested module
 * (route, card, ranking, picker); this file owns the browser: fetch, storage,
 * geolocation, the share sheet and events.
 */
import './theme/fonts.css';
import './theme/tokens.css';
import './theme/app.css';

import { isNationalSummary, isTownCard, isTownIndex } from './core/publish.js';
import type { TownIndexEntry } from './core/publish.js';
import { fetchJson } from './data.js';
import { detectLang, getLang, otherLang, setLang, t } from './i18n/index.js';
import { parseRoute, resolveInitialTown } from './route.js';
import { STORAGE_KEYS, storage } from './storage.js';
import { cardModel, cardNodes, isStale, renderCard, shareTextFor } from './ui/card.js';
import type { CardNodes } from './ui/card.js';
import { need, setHidden, setText } from './ui/dom.js';
import { formatTime } from './ui/format.js';
import { pickerNodes, renderSuggestions, townFromPosition } from './ui/picker.js';
import { rankingNodes, renderRanking } from './ui/ranking.js';
import { applyStaticText, showScreen } from './ui/screens.js';
import { shareText, targetsFrom } from './ui/share.js';

const app = need<HTMLElement>(document, '#app');
const picker = pickerNodes(document);
const card: CardNodes = cardNodes(document);
const ranking = rankingNodes(document);
const langButton = need<HTMLButtonElement>(document, '#btn-lang');
const staleNotice = need<HTMLElement>(document, '#notice-stale');
const route = parseRoute(location.pathname, location.search);

let towns: TownIndexEntry[] = [];
let current: { slug: string; shared: boolean } | null = null;

setLang(detectLang({ stored: storage.get(STORAGE_KEYS.lang), navigatorLanguage: navigator.language }));
setHidden(need(document, '#notice-retired'), !route.retired);

function paintStatic(): void {
  document.documentElement.lang = getLang();
  applyStaticText(document);
  setText(langButton, t('lang.toggle'));
}

async function openTown(slug: string, shared: boolean): Promise<void> {
  current = { slug, shared };
  showScreen(app, 'loading');
  const data = await fetchJson(`/data/towns/${slug}.json`, isTownCard);
  if (data === null) {
    showScreen(app, 'error');
    return;
  }
  renderCard(card, cardModel(data, getLang()));
  setHidden(card.makeMine, !shared);
  setText(card.note, '');
  setHidden(card.fallback, true);
  const stale = isStale(data.updatedAt, Date.now());
  setText(staleNotice, stale ? t('stale.warning', { time: formatTime(Date.parse(data.updatedAt), getLang()) }) : '');
  setHidden(staleNotice, !stale);
  card.share.onclick = () => void share(shareTextFor(data, getLang()));
  showScreen(app, 'card');
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
  void openTown(slug, false);
}

function showPicker(): void {
  picker.input.value = '';
  renderSuggestions(picker, towns, '');
  setText(picker.status, '');
  setHidden(staleNotice, true);
  showScreen(app, 'picker');
  picker.input.focus();
}

async function boot(): Promise<void> {
  paintStatic();
  showScreen(app, 'loading');
  const index = await fetchJson('/data/index.json', isTownIndex);
  if (index === null) {
    showScreen(app, 'error');
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
  setText(picker.status, t('picker.locating'));
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const town = townFromPosition(position.coords.latitude, position.coords.longitude, towns);
      if (town === null) {
        setText(picker.status, t('picker.locateFailed'));
      } else {
        choose(town.slug);
      }
    },
    () => {
      setText(picker.status, t('picker.locateFailed'));
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
    showScreen(app, 'loading');
    const summary = await fetchJson('/data/national.json', isNationalSummary);
    if (summary === null) {
      showScreen(app, 'error');
      return;
    }
    renderRanking(ranking, summary, getLang());
    showScreen(app, 'ranking');
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
  if (current !== null && app.dataset['screen'] === 'card') {
    void openTown(current.slug, current.shared);
  }
});

void boot();
