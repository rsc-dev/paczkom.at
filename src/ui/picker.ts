import { closestTown } from '../core/geo.js';
import type { TownIndexEntry } from '../core/publish.js';
import { searchTowns } from '../core/towns.js';
import { need, setHidden } from './dom.js';

export interface PickerNodes {
  readonly input: HTMLInputElement;
  readonly results: HTMLUListElement;
  readonly empty: HTMLElement;
  readonly locate: HTMLButtonElement;
  readonly status: HTMLElement;
}

export function pickerNodes(root: ParentNode): PickerNodes {
  return {
    input: need(root, '#picker-input'),
    results: need(root, '#picker-results'),
    empty: need(root, '#picker-empty'),
    locate: need(root, '#btn-locate'),
    status: need(root, '#picker-status'),
  };
}

export function renderSuggestions(nodes: PickerNodes, towns: readonly TownIndexEntry[], query: string): void {
  const matches = searchTowns(towns, query);
  nodes.results.replaceChildren(
    ...matches.map((town) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.className = 'picker__town';
      button.dataset['slug'] = town.slug;
      button.textContent = town.name;
      item.append(button);
      return item;
    }),
  );
  setHidden(nodes.empty, query.trim() === '' || matches.length > 0);
}

/** "Use my location" works out the town on the device; the position goes nowhere. */
export function townFromPosition(lat: number, lon: number, towns: readonly TownIndexEntry[]): TownIndexEntry | null {
  return closestTown(lat, lon, towns);
}
