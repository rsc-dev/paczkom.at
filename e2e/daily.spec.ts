import { expect, test } from '@playwright/test';
import { CLOCK_DATE, idleToResult, openGame, storedDaily } from './fixtures.js';

/**
 * First attempt counts (daily-mode spec). Playing the same date twice must
 * leave the stored result exactly as the first run left it, label the second
 * run as practice, and say which score still stands.
 */
test('the second run of a date is practice and does not overwrite the result', async ({ page }) => {
  // Two full days at ninety fake seconds each, frame by frame.
  test.setTimeout(90_000);
  await openGame(page);

  await page.locator('#btn-play').click();
  await idleToResult(page);

  const firstHeadline = await page.locator('#result-headline').textContent();
  const firstScore = await page.locator('#result-score').textContent();
  expect(await page.locator('#result-note').textContent()).toBe('');

  const afterFirst = await storedDaily(page);
  expect(afterFirst?.practices).toBe(0);
  expect(afterFirst?.result?.score).toBe(Number(firstScore));

  // Same date, same seed: play it again.
  await page.locator('#btn-again').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');
  await idleToResult(page);

  const secondHeadline = await page.locator('#result-headline').textContent();
  expect(secondHeadline).not.toBe(firstHeadline);
  // The note names the score that still stands for the day.
  expect(await page.locator('#result-note').textContent()).toContain(String(afterFirst?.result?.score));

  const afterSecond = await storedDaily(page);
  expect(afterSecond?.practices).toBe(1);
  expect(afterSecond?.result).toEqual(afterFirst?.result);
});

test('the daily is filed under the UTC date the run began', async ({ page }) => {
  await openGame(page);
  await page.locator('#btn-play').click();
  await idleToResult(page);

  await expect(page.locator('#result-kicker')).toContainText(CLOCK_DATE);
  expect(await storedDaily(page, CLOCK_DATE)).not.toBeNull();

  const dates = await page.evaluate(() =>
    Object.keys(JSON.parse(localStorage.getItem('pk:v1:daily') ?? '{}') as Record<string, unknown>),
  );
  expect(dates).toEqual([CLOCK_DATE]);
});

test('the streak shows up on the title screen after a day', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('#title-stats')).not.toBeEmpty();
  const before = await page.locator('#title-stats').textContent();

  await page.locator('#btn-play').click();
  await idleToResult(page);
  await page.locator('#btn-home').click();

  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'title');
  await expect(page.locator('#title-stats')).not.toHaveText(before ?? '');
  await expect(page.locator('#title-stats')).toContainText('1');
});
