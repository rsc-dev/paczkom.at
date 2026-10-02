import type { Page } from '@playwright/test';

/** Half an hour after the recorded fixtures: fresh, so no staleness warning. */
export const FIXTURE_TIME = '2026-10-01T17:12:00Z';
export const FRESH = new Date(Date.parse(FIXTURE_TIME) + 30 * 60_000);
export const STALE = new Date(Date.parse(FIXTURE_TIME) + 4 * 3_600_000);

export async function open(page: Page, path = '/', now: Date = FRESH): Promise<void> {
  await page.clock.install({ time: now });
  await page.goto(path);
}
