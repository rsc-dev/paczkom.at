import { expect, test } from '@playwright/test';
import { STALE, open } from './fixtures.js';

const app = (page: import('@playwright/test').Page) => page.locator('#app');

test('first visit: search without diacritics, pick, and the town is remembered', async ({ page }) => {
  await open(page);
  await expect(app(page)).toHaveAttribute('data-screen', 'picker');
  await page.locator('#picker-input').fill('lodz');
  await page.locator('[data-slug="lodz"]').click();
  await expect(app(page)).toHaveAttribute('data-screen', 'card');
  await expect(page.locator('#card-town')).toHaveText('Łódź');
  await expect(page.locator('#card-level-of')).toHaveText(/^[1-6]\/6$/);
  await expect(page.locator('#notice-stale')).toBeHidden();

  await page.reload();
  await expect(page.locator('#card-town')).toHaveText('Łódź');
});

test('search with diacritics finds the same town', async ({ page }) => {
  await open(page);
  await page.locator('#picker-input').fill('Łódź');
  await expect(page.locator('[data-slug="lodz"]')).toBeVisible();
});

test('a shared town opens without replacing your own, until you say so', async ({ page }) => {
  await open(page);
  await page.locator('#picker-input').fill('krak');
  await page.locator('[data-slug="krakow"]').click();
  await expect(page.locator('#card-town')).toHaveText('Kraków');

  await page.goto('/gdansk');
  await expect(page.locator('#card-town')).toHaveText('Gdańsk');
  await expect(page.locator('#btn-make-mine')).toBeVisible();

  await page.goto('/');
  await expect(page.locator('#card-town')).toHaveText('Kraków');

  await page.goto('/gdansk');
  await page.locator('#btn-make-mine').click();
  await page.goto('/');
  await expect(page.locator('#card-town')).toHaveText('Gdańsk');
});

test('a town page carries its own link preview', async ({ request }) => {
  const html = await (await request.get('/krakow/')).text();
  // Pages 301s /krakow to /krakow/; og:url names that final address.
  expect(html).toContain('<meta property="og:url" content="https://paczkom.at/krakow/" />');
  expect(html).toContain('<meta property="og:image" content="https://paczkom.at/krakow/og.png" />');
  expect(html).toMatch(/<meta property="og:image:alt" content="Kraków: [^"]+" \/>/);
  expect((await request.get('/krakow/og.png')).headers()['content-type']).toContain('image/png');
});

test('old data shows the staleness warning', async ({ page }) => {
  await open(page, '/krakow', STALE);
  await expect(page.locator('#notice-stale')).toBeVisible();
  await expect(page.locator('#notice-stale')).toContainText('odświeżanie się opóźnia');
});

test('a missing data file shows the no-data screen, and retry recovers', async ({ page }) => {
  await page.route('**/data/index.json', (route) => route.fulfill({ status: 503 }));
  await open(page);
  await expect(app(page)).toHaveAttribute('data-screen', 'error');
  await page.unroute('**/data/index.json');
  await page.locator('#btn-retry').click();
  await expect(app(page)).toHaveAttribute('data-screen', 'picker');
});

test('the ranking lists towns and links back to their cards', async ({ page }) => {
  await open(page, '/krakow');
  await page.locator('#btn-ranking').click();
  await expect(app(page)).toHaveAttribute('data-screen', 'ranking');
  await expect(page.locator('#ranking-best li')).toHaveCount(5);
  await expect(page.locator('#ranking-counts li')).toHaveCount(6);
  await page.locator('#btn-ranking-back').click();
  await expect(page.locator('#card-town')).toHaveText('Kraków');
});

test('the English toggle relabels the card and is remembered', async ({ page }) => {
  await open(page, '/krakow');
  await page.locator('#btn-lang').click();
  await expect(page.locator('#btn-change')).toHaveText('Change town');
  await page.reload();
  await expect(page.locator('#btn-change')).toHaveText('Change town');
});

test('an old game link says the game is gone and still works', async ({ page }) => {
  await open(page, '/?week=k3j9x');
  await expect(page.locator('#notice-retired')).toBeVisible();
  await expect(app(page)).toHaveAttribute('data-screen', 'picker');
});

test('choosing a new town after a shared link survives a failed retry', async ({ page }) => {
  await open(page, '/gdansk');
  await expect(page.locator('#card-town')).toHaveText('Gdańsk');

  await page.locator('#btn-change').click();
  await page.locator('#picker-input').fill('krak');
  await page.route('**/data/towns/krakow.json', (route) => route.fulfill({ status: 503 }));
  await page.locator('[data-slug="krakow"]').click();
  await expect(app(page)).toHaveAttribute('data-screen', 'error');

  // The retry must re-open the town just chosen, not fall back to the
  // earlier shared link, whose slug the boot-time route object still held.
  await page.unroute('**/data/towns/krakow.json');
  await page.locator('#btn-retry').click();
  await expect(page.locator('#card-town')).toHaveText('Kraków');
});

test('sharing falls back to copyable text without share or clipboard', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: undefined });
  });
  await open(page, '/krakow');
  await page.locator('#btn-share').click();
  await expect(page.locator('#share-fallback')).toBeVisible();
  await expect(page.locator('#share-fallback')).toHaveValue(/https:\/\/paczkom\.at\/krakow$/);
});
