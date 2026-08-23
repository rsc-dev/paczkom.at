import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * A fixed instant for every spec. The Daily is seeded from the UTC date, so
 * without this the wall would be a different wall depending on the day the
 * suite happens to run.
 */
export const CLOCK = '2026-09-14T12:00:00Z';

export const CLOCK_DATE = '2026-09-14';

/** Loads the site with the clock pinned, before any script has run. */
export async function openGame(page: Page): Promise<void> {
  await page.clock.install({ time: CLOCK });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'title');
}

/** Idles a started day through to the result screen, sweeping what is left. */
export async function idleToResult(page: Page): Promise<void> {
  await page.clock.runFor(95_000);
  for (let i = 0; i < 30; i += 1) {
    const marked = page.locator('.door[data-state="marked"]');
    if ((await marked.count()) === 0) {
      break;
    }
    await marked.first().click();
  }
  await page.clock.runFor(500);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'result');
}

export interface StoredDaily {
  readonly result?: { readonly score: number; readonly timeMs: number };
  readonly practices: number;
}

/** What the game actually wrote under `pk:v1:daily` for a date. */
export async function storedDaily(page: Page, date = CLOCK_DATE): Promise<StoredDaily | null> {
  return page.evaluate((key: string) => {
    const raw = localStorage.getItem('pk:v1:daily');
    if (raw === null) {
      return null;
    }
    const records = JSON.parse(raw) as Record<string, StoredDaily>;
    return records[key] ?? null;
  }, date);
}
