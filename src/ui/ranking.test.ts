// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n/index.js';
import { rankingNodes, renderRanking } from './ranking.js';
import { mountApp } from './testing.js';

beforeEach(() => {
  setLang('pl');
  mountApp();
});

describe('renderRanking', () => {
  it('lists best and worst towns as links with their level, and counts per level', () => {
    const nodes = rankingNodes(document);
    renderRanking(
      nodes,
      {
        updatedAt: '2026-10-01T15:25:00.000Z', medianLevel: 2,
        countByLevel: { 1: 10, 2: 20, 3: 5, 4: 1, 5: 0, 6: 0 },
        best: [{ slug: 'hel', name: 'Hel', level: 1, pm25: 3 }],
        worst: [{ slug: 'krakow', name: 'Kraków', level: 4, pm25: 60 }],
        withData: 36, total: 480,
      },
      'pl',
    );
    expect(nodes.median.textContent).toBe('Mediana: Dobry');
    expect(nodes.best.querySelector('a')?.getAttribute('href')).toBe('/hel');
    expect(nodes.best.textContent).toContain('Hel');
    expect(nodes.worst.querySelector('[data-level]')?.getAttribute('data-level')).toBe('4');
    expect([...nodes.counts.children].map((li) => li.textContent)).toEqual([
      'Bardzo dobry: 10', 'Dobry: 20', 'Umiarkowany: 5', 'Dostateczny: 1', 'Zły: 0', 'Bardzo zły: 0',
    ]);
  });
});
