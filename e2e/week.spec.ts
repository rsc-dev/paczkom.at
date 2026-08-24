import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openGame, playDayWell } from './fixtures.js';

/**
 * The Week run end to end: starting one puts its seed in the address bar, a day
 * ends on the day-summary screen, and a shared link opens straight into that
 * same week.
 */

const SHOTS = fileURLToPath(new URL('../test-results/screens/', import.meta.url));

/** A week seed with a wall we can name doors on: Monday is always 2 columns. */
const SEED = 'k3j9x';

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

/** Plays the current day to its end screen by idling and sweeping. */
async function idleThroughDay(page: Page): Promise<void> {
  await page.clock.runFor(120_000);
  for (let i = 0; i < 40; i += 1) {
    const marked = page.locator('.door[data-state="marked"]');
    if ((await marked.count()) === 0) {
      break;
    }
    await marked.first().click();
  }
  await page.clock.runFor(500);
}

test('starting a week writes its seed into the URL', async ({ page }) => {
  await openGame(page);
  await page.locator('#btn-week').click();

  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');
  await expect(page).toHaveURL(/\?week=[0-9a-z]+/);

  // Monday: two columns, fourteen doors, eight parcels.
  await expect(page.locator('.door')).toHaveCount(14);
  await expect(page.locator('#hud-stars')).toBeVisible();
  await expect(page.locator('#hud-stars .stars__star[data-filled="true"]')).toHaveCount(3);
});

test('a shared link opens that exact week', async ({ page }) => {
  await page.clock.install({ time: '2026-09-14T12:00:00Z' });
  await page.goto(`/?week=${SEED}`);

  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');
  await expect(page).toHaveURL(new RegExp(`\\?week=${SEED}`));
  await expect(page.locator('.door')).toHaveCount(14);

  const codes = await page.locator('#panel-code').textContent();

  // The same link, again: the same wall and the same first parcel.
  await page.goto(`/?week=${SEED}`);
  await expect(page.locator('#panel-code')).toHaveText(codes ?? '');
});

test('a day played well ends on the day summary, and Tuesday follows', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: '2026-09-14T12:00:00Z' });
  await page.goto(`/?week=${SEED}`);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');

  await playDayWell(page);

  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'day');
  await expect(page.locator('#day-score')).not.toBeEmpty();
  await expect(page.locator('#day-stars .stars__star')).toHaveCount(3);
  // Monday served cleanly costs nothing.
  await expect(page.locator('#day-stars .stars__star[data-filled="true"]')).toHaveCount(3);
  await page.screenshot({ path: `${SHOTS}week-day-390x844.png` });

  await page.locator('#btn-next-day').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');
  // Tuesday is still two columns, but it brings senders along.
  await expect(page.locator('.door')).toHaveCount(14);
  await expect(page.locator('#hud-stars .stars__star[data-filled="true"]')).toHaveCount(3);
});

test('a week played through reaches Saturday and the week summary', async ({ page }) => {
  // Six days, frame by frame, under a fake clock.
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: '2026-09-14T12:00:00Z' });
  await page.goto(`/?week=${SEED}`);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');

  const wallSizes: number[] = [];
  for (let day = 0; day < 6; day += 1) {
    wallSizes.push(await page.locator('.door').count());

    // Saturday: five columns, thirty-five doors, on a phone and on a desktop.
    if (day === 5) {
      await expect(page.locator('.door')).toHaveCount(35);
      for (const size of [
        { name: '360x640', width: 360, height: 640 },
        { name: '1280x800', width: 1280, height: 800 },
      ]) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.clock.runFor(50);
        await expectWallFits(page, size.width, size.height);
        await page.screenshot({ path: `${SHOTS}week-saturday-${size.name}.png` });
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }

    await playDayWell(page);

    if (day < 5) {
      await expect(page.locator('#app')).toHaveAttribute('data-screen', 'day');
      await page.locator('#btn-next-day').click();
      await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');
    }
  }

  // The wall grows through the week: 2, 2, 3, 3, 4, 5 columns.
  expect(wallSizes).toEqual([14, 14, 21, 21, 28, 35]);

  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'week');
  await expect(page.locator('#week-rows tr')).toHaveCount(6);
  await expect(page.locator('#week-total')).not.toBeEmpty();
  await expect(page.locator('#week-best')).not.toBeEmpty();
  await page.screenshot({ path: `${SHOTS}week-summary-390x844.png` });

  // Sharing a finished week offers the link that replays it.
  await page.locator('#btn-week-share').click();
  await expect(page.locator('#week-share-note')).not.toBeEmpty();
});

/** No scrolling, every door inside the viewport, every hit area at least 40 px. */
async function expectWallFits(page: Page, width: number, height: number): Promise<void> {
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(overflow.x).toBeLessThanOrEqual(0);
  expect(overflow.y).toBeLessThanOrEqual(0);

  const boxes = await page.locator('.door').evaluateAll((nodes) =>
    nodes.map((node) => {
      const face = node.querySelector('.door__face')?.getBoundingClientRect();
      const hit = node.querySelector('.door__hit')?.getBoundingClientRect();
      return {
        top: face?.top ?? 0,
        bottom: face?.bottom ?? 0,
        left: face?.left ?? 0,
        right: face?.right ?? 0,
        faceHeight: face?.height ?? 0,
        hitHeight: hit?.height ?? 0,
        hitWidth: hit?.width ?? 0,
      };
    }),
  );

  for (const box of boxes) {
    expect(box.top).toBeGreaterThanOrEqual(-0.5);
    expect(box.left).toBeGreaterThanOrEqual(-0.5);
    expect(box.bottom).toBeLessThanOrEqual(height + 0.5);
    expect(box.right).toBeLessThanOrEqual(width + 0.5);
    // A doors never shrink below the 24 px floor the wall spec sets...
    expect(box.faceHeight).toBeGreaterThanOrEqual(23.5);
    // ... and the hit area never below 40 px, however small the door looks.
    expect(box.hitHeight).toBeGreaterThanOrEqual(39.5);
    expect(box.hitWidth).toBeGreaterThanOrEqual(39.5);
  }
}

test('running out of stars ends the week on the reklamacja screen', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: '2026-09-14T12:00:00Z' });
  await page.goto(`/?week=${SEED}`);

  await idleThroughDay(page);
  // Monday alone loses more than three customers, so the stars are gone.
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'fail');
  await expect(page.locator('#fail-headline')).not.toBeEmpty();
  await expect(page.locator('#fail-incidents li').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}week-fail-390x844.png` });

  await expect(page.locator('#btn-fail-retry')).toBeVisible();
  await expect(page.locator('#btn-fail-new')).toBeVisible();
});
