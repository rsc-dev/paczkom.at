import { describe, expect, it } from 'vitest';
import { CARD } from '../../src/core/testing.js';
import { townPage } from './pages.js';

const SHELL = `<head>
    <title>paczkom.at</title>
    <meta property="og:title" content="paczkom.at" />
    <meta property="og:description" content="Jakość powietrza." />
    <meta property="og:url" content="https://paczkom.at/" />
    <meta property="og:image" content="https://paczkom.at/og.png" />
    <meta property="og:image:alt" content="paczkom.at" />
</head>`;

describe('townPage', () => {
  const html = townPage(SHELL, CARD, '1 paź, 17:00');

  it('points every preview tag at the town', () => {
    expect(html).toContain('<title>Kraków · paczkom.at</title>');
    expect(html).toContain('<meta property="og:title" content="Kraków: Dostateczny (4/6)" />');
    expect(html).toContain('<meta property="og:description" content="PM2,5: 48 µg/m³ · 1 paź, 17:00" />');
    // Pages 301s a town path to its trailing slash; og:url names that address.
    expect(html).toContain('<meta property="og:url" content="https://paczkom.at/krakow/" />');
    expect(html).toContain('<meta property="og:image" content="https://paczkom.at/krakow/og.png" />');
    expect(html).toContain('<meta property="og:image:alt" content="Kraków: Dostateczny (4/6)" />');
  });

  it('escapes names and describes a town without data', () => {
    const page = townPage(SHELL, { ...CARD, name: 'A&B "x"', level: null, pm25: null }, 'teraz');
    expect(page).toContain('content="A&amp;B &quot;x&quot;: Brak danych"');
    expect(page).toContain('content="teraz"');
    // The alt text carries the same no-data wording as the title/og:title.
    expect(page.match(/content="A&amp;B &quot;x&quot;: Brak danych"/g)).toHaveLength(2);
  });

  it('throws if the shell is missing a tag it must replace', () => {
    expect(() => townPage('<head></head>', CARD, 'x')).toThrow(/og:title/);
  });

  it('keeps $-patterns in the name literal (not interpreted as a replace() pattern)', () => {
    const page = townPage(SHELL, { ...CARD, name: 'Foo $& $1 Bar' }, '1 paź, 17:00');
    expect(page).toContain('<title>Foo $&amp; $1 Bar · paczkom.at</title>');
    expect(page).toContain('<meta property="og:title" content="Foo $&amp; $1 Bar: Dostateczny (4/6)" />');
  });
});
