import { expect, test } from '@playwright/test';
import { TICK, crateFill, display, landingKey, open } from './fixtures.js';

test('shows the time when nobody plays', async ({ page }) => {
  await open(page);
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'clock');
  // No shift has ended yet, so the slip stays out of sight.
  await expect(page.locator('#slip')).toBeHidden();
  // 08:05 UTC is 10:05 in Warsaw; the test browser runs in the runner's zone,
  // so only check that four digits show and the colon blinks.
  await expect(display(page)).toHaveAttribute('data-display', /^[ \d]\d\d\d$/);
});

test('Game A starts, shows the record, then a perfect courier catches and delivers', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Space');
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'record');
  await page.clock.runFor(1600);
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'playing');
  let delivered = 0;
  for (let i = 0; i < 150 && delivered === 0; i += 1) {
    const fill = await crateFill(page);
    if (fill === 3) {
      await page.keyboard.press('Numpad5');
      delivered = fill;
    } else {
      const key = await landingKey(page);
      if (key !== null) {
        await page.keyboard.press(key);
      }
    }
    await page.clock.runFor(TICK);
  }
  expect(delivered).toBe(3);
  await expect(display(page)).toHaveAttribute('data-display', /^ +[1-9]\d*$/);
  await expect(page.locator('[data-seg="h-2"][data-on]')).toHaveCount(1);
});

test('dropped parcels cost hearts and end the shift with a shareable slip', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: undefined });
  });
  await open(page);
  await page.keyboard.press('Space');
  await page.clock.runFor(1600);
  await page.keyboard.press('Numpad5');
  for (let i = 0; i < 300 && (await page.locator('#app').getAttribute('data-state')) !== 'over'; i += 1) {
    await page.clock.runFor(TICK);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'over');
  await expect(page.locator('[data-seg^="h-"][data-on]')).toHaveCount(0);
  await expect(page.locator('#slip')).toBeVisible();
  await expect(page.locator('#slip-text')).toContainText('Koniec zmiany: 0 pkt');
  await page.locator('#btn-share').click();
  await expect(page.locator('#share-fallback')).toHaveValue(/https:\/\/paczkom\.at$/);
});

test('a record survives a reload and shows before the next game', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Space');
  await page.clock.runFor(1600);
  let delivered = false;
  for (let i = 0; i < 400 && (await page.locator('#app').getAttribute('data-state')) !== 'over'; i += 1) {
    if (!delivered) {
      if ((await crateFill(page)) > 0) {
        await page.keyboard.press('Numpad5');
        delivered = true;
      } else {
        const key = await landingKey(page);
        if (key !== null) {
          await page.keyboard.press(key);
        }
      }
    }
    await page.clock.runFor(TICK);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'over');
  const slip = (await page.locator('#slip-text').textContent()) ?? '';
  const score = Number(/(\d+)\s+pkt/.exec(slip)?.[1]);
  expect(score).toBeGreaterThan(0);
  await page.reload();
  await page.keyboard.press('Space');
  await expect(display(page)).toHaveAttribute('data-display', String(score).padStart(4, ' '));
});

test('a hidden tab freezes the shift', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Space');
  await page.clock.runFor(1600);
  const hide = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { value: h, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await hide(true);
  await page.clock.runFor(60_000);
  await expect(page.locator('[data-seg^="h-"][data-on]')).toHaveCount(3);
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'playing');
  await hide(false);
});

test('the language toggle relabels the case and is remembered', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-start="A"]')).toHaveText('GRA A');
  await page.locator('#btn-lang').click();
  await expect(page.locator('[data-start="A"]')).toHaveText('GAME A');
  await page.reload();
  await expect(page.locator('[data-start="A"]')).toHaveText('GAME A');
});

test('A/D and the arrows move the courier one place at a time', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Space');
  await page.clock.runFor(1600);
  const place = async (): Promise<string | null> =>
    page.locator('[data-seg^="c-"][data-on]').first().getAttribute('data-seg');
  // A game starts with the courier in the middle.
  await expect.poll(place).toBe('c-3');
  await page.keyboard.press('KeyA');
  await expect.poll(place).toBe('c-2');
  await page.keyboard.press('ArrowRight');
  await expect.poll(place).toBe('c-3');
  await page.keyboard.press('KeyD');
  await expect.poll(place).toBe('c-4');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(place).toBe('c-3');
  await page.keyboard.press('ArrowUp');
  await expect.poll(place).toBe('c-3');
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBe(0);
});
