import { LEVELS } from '../core/levels.js';
import type { NationalSummary, RankedTown } from '../core/publish.js';
import { levelName, translate } from '../i18n/index.js';
import type { Lang } from '../i18n/index.js';
import { need, setText } from './dom.js';

export interface RankingNodes {
  readonly median: HTMLElement;
  readonly best: HTMLOListElement;
  readonly worst: HTMLOListElement;
  readonly counts: HTMLUListElement;
}

export function rankingNodes(root: ParentNode): RankingNodes {
  return {
    median: need(root, '#ranking-median'),
    best: need(root, '#ranking-best'),
    worst: need(root, '#ranking-worst'),
    counts: need(root, '#ranking-counts'),
  };
}

function townItem(town: RankedTown, lang: Lang): HTMLLIElement {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = `/${town.slug}`;
  link.textContent = town.name;
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.dataset['level'] = String(town.level);
  badge.textContent = levelName(town.level, lang);
  item.append(link, ' ', badge);
  return item;
}

export function renderRanking(nodes: RankingNodes, summary: NationalSummary, lang: Lang): void {
  setText(
    nodes.median,
    summary.medianLevel === null ? '' : translate(lang, 'ranking.median', { level: levelName(summary.medianLevel, lang) }),
  );
  nodes.best.replaceChildren(...summary.best.map((t) => townItem(t, lang)));
  nodes.worst.replaceChildren(...summary.worst.map((t) => townItem(t, lang)));
  nodes.counts.replaceChildren(
    ...LEVELS.map((level) => {
      const item = document.createElement('li');
      item.dataset['level'] = String(level);
      item.textContent = translate(lang, 'ranking.count', { level: levelName(level, lang), count: summary.countByLevel[String(level) as '1'] });
      return item;
    }),
  );
}
