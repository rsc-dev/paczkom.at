import { describe, expect, it } from 'vitest';
import { shareText, slipText } from './slip.js';

describe('slipText', () => {
  it('reads like the end of a shift, in both languages', () => {
    expect(slipText(142, 210, 'pl')).toBe('Koniec zmiany: 142 pkt · rekord: 210');
    expect(slipText(1, 1, 'en')).toBe('End of shift: 1 pt · record: 1');
  });
});

describe('shareText', () => {
  it('carries the game, the real total and a record line only when new', () => {
    expect(shareText('A', 1005, true, 'pl')).toBe(
      ['paczkom.at · Gra A', '📦 1005 pkt', 'Nowy rekord!', 'https://paczkom.at'].join('\n'),
    );
    expect(shareText('B', 22, false, 'en')).toBe(['paczkom.at · Game B', '📦 22 pts', 'https://paczkom.at'].join('\n'));
  });
});
