// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n/index.js';
import { pickerNodes, renderSuggestions, townFromPosition } from './picker.js';
import type { PickerNodes } from './picker.js';
import { mountApp } from './testing.js';

const towns = [
  { slug: 'lodz', name: 'Łódź', lat: 51.77, lon: 19.46, population: 670_000 },
  { slug: 'krakow', name: 'Kraków', lat: 50.06, lon: 19.94, population: 800_000 },
];

let nodes: PickerNodes;
beforeEach(() => {
  setLang('pl');
  mountApp();
  nodes = pickerNodes(document);
});

describe('renderSuggestions', () => {
  it('lists matching towns as buttons carrying their slug', () => {
    renderSuggestions(nodes, towns, 'lodz');
    const buttons = [...nodes.results.querySelectorAll('button')];
    expect(buttons.map((b) => [b.textContent, b.dataset['slug']])).toEqual([['Łódź', 'lodz']]);
    expect(nodes.empty.hidden).toBe(true);
  });

  it('says so when nothing matches, and stays quiet for an empty query', () => {
    renderSuggestions(nodes, towns, 'xyz');
    expect(nodes.results.children).toHaveLength(0);
    expect(nodes.empty.hidden).toBe(false);
    renderSuggestions(nodes, towns, '');
    expect(nodes.empty.hidden).toBe(true);
  });
});

describe('townFromPosition', () => {
  it('picks the closest town', () => {
    expect(townFromPosition(50.1, 19.9, towns)?.slug).toBe('krakow');
  });
});
