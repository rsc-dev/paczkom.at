import { expect, test } from '@playwright/test';

/**
 * One end-to-end pass over the shipped build: open the title, start the Daily,
 * put a parcel away, let the day run out, and land on a result you can share.
 * The clock is faked so the ninety-second day takes no wall time.
 */
test('title to shareable result', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-screen', 'title');
  await expect(page.locator('#btn-play')).toBeVisible();

  await page.locator('#btn-play').click();
  await expect(app).toHaveAttribute('data-screen', 'game');
  await expect(page.locator('#hud-phase')).not.toBeEmpty();

  // LOAD: put the current parcel into the first door that will take it.
  const doors = page.locator('.door');
  await expect(doors).toHaveCount(21);
  await page.clock.runFor(100);

  const filled = page.locator('.door[data-state="full"]');
  await expect(filled).toHaveCount(0);
  // The bottom door of the first column is size C, so it takes any parcel.
  await page.locator('.door[data-slot="c0r6"]').click();
  await expect(filled).toHaveCount(1);

  // Idle through the rest of the day, sweeping whatever is left to sweep.
  await page.clock.runFor(95_000);
  for (let i = 0; i < 30; i += 1) {
    const marked = page.locator('.door[data-state="marked"]');
    if ((await marked.count()) === 0) {
      break;
    }
    await marked.first().click();
  }
  await page.clock.runFor(500);

  await expect(app).toHaveAttribute('data-screen', 'result');
  await expect(page.locator('#btn-share')).toBeVisible();
  await expect(page.locator('#result-grid')).toContainText('⬜');
  await expect(page.locator('#result-score')).not.toBeEmpty();
});
