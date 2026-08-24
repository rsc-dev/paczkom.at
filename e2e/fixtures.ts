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

/**
 * Plays the current day the way a very good player would: load every parcel
 * into the smallest door that takes it, remembering what went where, then serve
 * each customer from that memory. Everything it knows comes off the screen, so
 * it can only do what a player could.
 */
export async function playDayWell(page: Page): Promise<void> {
  await page.evaluate(() => {
    const RANK: Record<string, number> = { A: 0, B: 1, C: 2 };
    const doors = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.door')];
    const panel = (): HTMLElement | null => document.querySelector<HTMLElement>('#panel');
    const phase = (): string =>
      document.querySelector<HTMLElement>('#screen-game')?.dataset['phase'] ?? '';
    const text = (selector: string): string =>
      document.querySelector(selector)?.textContent?.trim() ?? '';

    // What went into which door, learned during LOAD exactly as a player learns it.
    const memory: { slot: string; code: string; look: string }[] = [];

    const smallestFitting = (size: string): HTMLElement | undefined =>
      doors()
        .filter(
          (door) =>
            door.dataset['state'] === 'empty' &&
            door.dataset['jammed'] !== 'true' &&
            (RANK[door.dataset['size'] ?? 'A'] ?? 0) >= (RANK[size] ?? 0),
        )
        .sort((a, b) => (RANK[a.dataset['size'] ?? 'A'] ?? 0) - (RANK[b.dataset['size'] ?? 'A'] ?? 0))[0];

    // --- LOAD ---
    for (let guard = 0; guard < 200; guard += 1) {
      if (phase() !== 'LOAD') {
        break;
      }
      const size = panel()?.dataset['size'];
      if (size === undefined || size === '') {
        break;
      }
      const door = smallestFitting(size);
      if (door === undefined) {
        break;
      }
      const code = text('#panel-code');
      const look = text('#panel-hint-text');
      door.click();
      memory.push({ slot: door.dataset['slot'] ?? '', code, look });
      if (doors().every((entry) => entry.dataset['state'] !== 'empty')) {
        break;
      }
    }

    // Hand the memory to the SERVE half through the window.
    (window as unknown as { __memory: typeof memory }).__memory = memory;
    return { loaded: memory.length, phase: phase() };
  });

  // If anything is still on the van, LOAD ends on its own timer — but only run
  // the clock while it is still LOAD, or the first customers walk unserved.
  for (let guard = 0; guard < 60; guard += 1) {
    const phase = await page.locator('#screen-game').getAttribute('data-phase');
    if (phase !== 'LOAD') {
      break;
    }
    await page.clock.runFor(1_000);
  }

  // --- SERVE ---
  for (let guard = 0; guard < 400; guard += 1) {
    const done = await page.evaluate(() => {
      const memory =
        (window as unknown as { __memory?: { slot: string; code: string; look: string }[] })
          .__memory ?? [];
      const app = document.querySelector<HTMLElement>('#app');
      if (app?.dataset['screen'] !== 'game') {
        return 'over';
      }
      const codeText = document.querySelector('#panel-code')?.textContent?.trim() ?? '';
      const lookText = document.querySelector('#panel-hint-text')?.textContent?.trim() ?? '';
      const panelSize = document.querySelector<HTMLElement>('#panel')?.dataset['size'] ?? '';

      // Nobody at the counter: wait for the next arrival.
      const activeCard = document.querySelector<HTMLElement>('.card[data-active="true"]');
      if (activeCard === null || activeCard.hidden) {
        return 'wait';
      }

      // A sender wants any free door big enough.
      const kind = activeCard.dataset['kind'];
      if (kind === 'sender') {
        const RANK: Record<string, number> = { A: 0, B: 1, C: 2 };
        const door = [...document.querySelectorAll<HTMLElement>('.door')]
          .filter(
            (entry) =>
              entry.dataset['state'] === 'empty' &&
              entry.dataset['jammed'] !== 'true' &&
              (RANK[entry.dataset['size'] ?? 'A'] ?? 0) >= (RANK[panelSize] ?? 0),
          )
          .sort(
            (a, b) => (RANK[a.dataset['size'] ?? 'A'] ?? 0) - (RANK[b.dataset['size'] ?? 'A'] ?? 0),
          )[0];
        if (door === undefined) {
          return 'wait';
        }
        door.click();
        return 'served';
      }

      // A pickup: by code when they have one, by description when they do not.
      const byCode = memory.filter((entry) => entry.code !== '' && entry.code === codeText);
      const byLook =
        lookText === ''
          ? []
          : memory.filter((entry) => entry.look !== '' && lookText.includes(entry.look));
      const candidates = byCode.length > 0 ? byCode : byLook;

      // Two parcels can look alike, so a description can match more than one
      // door. Remember what has already been tried for *this* customer and move
      // on to the next candidate rather than tapping the same wrong door for
      // ever.
      const key = `${activeCard.dataset['customer'] ?? ''}`;
      const tried = (window as unknown as { __tried?: { key: string; slots: string[] } }).__tried;
      const attempts = tried !== undefined && tried.key === key ? tried.slots : [];

      for (const candidate of candidates) {
        const door = document.querySelector<HTMLElement>(`.door[data-slot="${candidate.slot}"]`);
        const stuck = door?.dataset['jammed'] === 'true';
        if (door === null || door === undefined) {
          continue;
        }
        if (door.dataset['state'] !== 'full' && !stuck) {
          continue;
        }
        // A jammed door needs a second tap, so it is never "already tried".
        if (!stuck && attempts.includes(candidate.slot)) {
          continue;
        }
        door.click();
        (window as unknown as { __tried: { key: string; slots: string[] } }).__tried = {
          key,
          slots: stuck ? attempts : [...attempts, candidate.slot],
        };
        return 'served';
      }
      return 'wait';
    });

    if (done === 'over') {
      break;
    }
    if (done === 'wait') {
      await page.clock.runFor(500);
    }
  }

  // --- SWEEP ---
  await page.clock.runFor(1_000);
  for (let i = 0; i < 60; i += 1) {
    const marked = page.locator('.door[data-state="marked"]');
    if ((await marked.count()) === 0) {
      break;
    }
    await marked.first().click();
  }
  await page.clock.runFor(500);
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
