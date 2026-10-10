import type { Page } from '@playwright/test';

export const CLOCK = '2026-10-10T08:05:00Z';

export async function open(page: Page): Promise<void> {
  await page.clock.install({ time: CLOCK });
  await page.goto('/');
}

export const display = (page: Page) => page.locator('svg#lcd-svg');

/** Level-1 tick. */
export const TICK = 700;

/** The numpad key that puts the courier under the parcel coming down next, or null. */
export async function landingKey(page: Page): Promise<string | null> {
  for (let spot = 0; spot < 4; spot += 1) {
    const due = [3, 4].map((s) => `[data-seg="p-${String(spot)}-${String(s)}"][data-on]`)
      .concat([1, 2].map((s) => `[data-seg="q-${String(spot)}-${String(s)}"][data-on]`));
    if ((await page.locator(due.join(', ')).count()) > 0) {
      return `Numpad${String(spot + 1)}`;
    }
  }
  return null;
}

/** How many parcels are in the courier's crate. */
export const crateFill = (page: Page): Promise<number> => page.locator('[data-seg^="k-"][data-on]').count();
