/**
 * A copy of the built index.html per town with its own preview tags. Crawlers
 * do not run JavaScript, so this is the only way a shared /krakow link can
 * preview as Kraków. The app itself reads the town from the path.
 */
import { SHARE_URL } from '../../src/core/share.js';
import type { TownCard } from '../../src/core/publish.js';
import { levelName } from '../../src/i18n/index.js';

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function replaceMeta(html: string, property: string, content: string): string {
  const pattern = new RegExp(`<meta property="${property}" content="[^"]*" />`);
  if (!pattern.test(html)) {
    throw new Error(`index.html has no ${property} tag to replace`);
  }
  return html.replace(pattern, () => `<meta property="${property}" content="${escape(content)}" />`);
}

export function townPage(shell: string, card: TownCard, when: string): string {
  const url = `${SHARE_URL}/${card.slug}`;
  const title =
    card.level === null ? `${card.name}: Brak danych` : `${card.name}: ${levelName(card.level, 'pl')} (${String(card.level)}/6)`;
  const description = card.pm25 === null ? when : `PM2,5: ${String(card.pm25).replace('.', ',')} µg/m³ · ${when}`;
  let html = shell.replace(/<title>[^<]*<\/title>/, () => `<title>${escape(card.name)} · paczkom.at</title>`);
  html = replaceMeta(html, 'og:title', title);
  html = replaceMeta(html, 'og:description', description);
  // Pages 301s a town path to its trailing slash; og:url names that final
  // address, while og:image sits alongside it under the slug without one.
  html = replaceMeta(html, 'og:url', `${url}/`);
  html = replaceMeta(html, 'og:image', `${url}/og.png`);
  html = replaceMeta(html, 'og:image:alt', title);
  return html;
}
