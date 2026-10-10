// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SEGMENT_IDS, lcdMarkup } from './lcd-art.js';

describe('lcdMarkup', () => {
  document.body.innerHTML = lcdMarkup();
  const ids = [...document.querySelectorAll('[data-seg]')].map((e) => e.getAttribute('data-seg'));

  it('draws every segment exactly once', () => {
    expect([...ids].sort()).toEqual([...SEGMENT_IDS].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the flights, courier positions, crate fill and hearts the game needs', () => {
    expect(SEGMENT_IDS.filter((id) => id.startsWith('p-'))).toHaveLength(20);
    expect(SEGMENT_IDS.filter((id) => id.startsWith('q-'))).toHaveLength(12);
    expect(SEGMENT_IDS.filter((id) => /^c-[1-5]$/.test(id))).toHaveLength(5);
    expect(SEGMENT_IDS.filter((id) => id.startsWith('k-'))).toHaveLength(15);
    for (const id of ['t-0', 't-1', 'h-0', 'h-2', 'drone-3', 'bird-0', 'b-2', 'lv-5', 'colon', 'lbl-B']) {
      expect(SEGMENT_IDS, id).toContain(id);
    }
  });

  it('uses only the board sprites for images', () => {
    const hrefs = [...document.querySelectorAll('image')].map((i) => i.getAttribute('href') ?? '');
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/sprites\/[a-z-]+\.png$/);
    }
  });
});
