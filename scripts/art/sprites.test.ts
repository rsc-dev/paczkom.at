import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPRITES } from './sprites.js';

describe('sprites', () => {
  it('has unique names and boxes inside the board', () => {
    expect(new Set(SPRITES.map((s) => s.name)).size).toBe(SPRITES.length);
    for (const { name, box } of SPRITES) {
      const [w, h, x, y] = box;
      expect(x + w, name).toBeLessThanOrEqual(1536);
      expect(y + h, name).toBeLessThanOrEqual(1024);
    }
  });

  it('has every sprite built into public/sprites', () => {
    for (const { name } of SPRITES) {
      expect(existsSync(`public/sprites/${name}.png`), name).toBe(true);
    }
  });
});
