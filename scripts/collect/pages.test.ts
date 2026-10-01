import { describe, expect, it } from 'vitest';
import { CARD } from '../../src/core/testing.js';
import { townPage } from './pages.js';

const SHELL = `<head>
    <title>paczkom.at</title>
    <meta property="og:title" content="paczkom.at" />
    <meta property="og:description" content="Jakość powietrza." />
    <meta property="og:url" content="https://paczkom.at/" />
    <meta property="og:image" content="https://paczkom.at/og.png" />
</head>`;

describe('townPage', () => {
  const html = townPage(SHELL, CARD, '1 paź, 17:00');

  it('points every preview tag at the town', () => {
    expect(html).toContain('<title>Kraków · paczkom.at</title>');
    expect(html).toContain('<meta property="og:title" content="Kraków: Dostateczny (4/6)" />');
    expect(html).toContain('<meta property="og:description" content="PM2,5: 48 µg/m³ · 1 paź, 17:00" />');
    expect(html).toContain('<meta property="og:url" content="https://paczkom.at/krakow" />');
    expect(html).toContain('<meta property="og:image" content="https://paczkom.at/krakow/og.png" />');
  });

  it('escapes names and describes a town without data', () => {
    const page = townPage(SHELL, { ...CARD, name: 'A&B "x"', level: null, pm25: null }, 'teraz');
    expect(page).toContain('content="A&amp;B &quot;x&quot;: Brak danych"');
    expect(page).toContain('content="teraz"');
  });

  it('throws if the shell is missing a tag it must replace', () => {
    expect(() => townPage('<head></head>', CARD, 'x')).toThrow(/og:title/);
  });
});
