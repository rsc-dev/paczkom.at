import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openGame } from './fixtures.js';

/**
 * The wall has to fit, whole, on the smallest phone we care about and still
 * look deliberate on a desktop. This suite proves it at three sizes and leaves
 * a screenshot of each behind for a human to look at.
 */

const SHOTS = fileURLToPath(new URL('../test-results/screens/', import.meta.url));

const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x800', width: 1280, height: 800 },
];

async function startDay(page: Page): Promise<void> {
  await openGame(page);
  await page.locator('#btn-play').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');
  // Put a few parcels away so the wall is not uniformly empty in the shot.
  for (const slot of ['c0r6', 'c1r4', 'c2r0', 'c0r0', 'c1r0']) {
    await page.locator(`.door[data-slot="${slot}"]`).click();
  }
  await page.clock.runFor(200);
}

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

for (const viewport of VIEWPORTS) {
  test(`wall fits at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startDay(page);

    // Nothing scrolls, in either direction.
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(overflow.x).toBeLessThanOrEqual(0);
    expect(overflow.y).toBeLessThanOrEqual(0);

    // Every door is inside the viewport.
    const doors = page.locator('.door');
    await expect(doors).toHaveCount(21);
    const boxes = await doors.evaluateAll((nodes) =>
      nodes.map((node) => {
        const face = node.querySelector('.door__face');
        const hit = node.querySelector('.door__hit');
        const faceBox = face?.getBoundingClientRect();
        const hitBox = hit?.getBoundingClientRect();
        return {
          face: { top: faceBox?.top ?? 0, bottom: faceBox?.bottom ?? 0, left: faceBox?.left ?? 0, right: faceBox?.right ?? 0, height: faceBox?.height ?? 0 },
          hit: { height: hitBox?.height ?? 0, width: hitBox?.width ?? 0 },
        };
      }),
    );

    for (const box of boxes) {
      expect(box.face.top).toBeGreaterThanOrEqual(-0.5);
      expect(box.face.left).toBeGreaterThanOrEqual(-0.5);
      expect(box.face.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
      expect(box.face.right).toBeLessThanOrEqual(viewport.width + 0.5);
      // A unit is between 24 and 40 px, per the wall spec.
      expect(box.face.height).toBeGreaterThanOrEqual(23.5);
      // ... but the hit area is never smaller than 40 px.
      expect(box.hit.height).toBeGreaterThanOrEqual(39.5);
      expect(box.hit.width).toBeGreaterThanOrEqual(39.5);
    }

    await page.screenshot({ path: `${SHOTS}game-${viewport.name}.png` });
  });
}

test('the screen panel moves out of the wall on small viewports', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startDay(page);
  const panel = await page.locator('#panel').boundingBox();
  const topDoor = await page.locator('.door[data-slot="c0r0"]').boundingBox();
  expect(panel?.y ?? 0).toBeLessThan(topDoor?.y ?? 0);
});

test('the screen panel sits between the wall columns on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startDay(page);
  const panel = await page.locator('#panel').boundingBox();
  const first = await page.locator('.door[data-slot="c0r0"]').boundingBox();
  const last = await page.locator('.door[data-slot="c2r0"]').boundingBox();
  expect(panel?.x ?? 0).toBeGreaterThan(first?.x ?? 0);
  expect(panel?.x ?? 0).toBeLessThan(last?.x ?? 0);
  // ... and it is a full-height column, not a strip above the doors.
  expect(panel?.height ?? 0).toBeGreaterThan((first?.height ?? 0) * 4);
});

// The gap between doors is 3 px on a phone and 8 px on a desktop, so the hit
// extenders have to follow it; both widths get probed.
for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
  test(`every point on the wall belongs to a door at ${viewport?.name ?? ''}`, async ({ page }) => {
  await page.setViewportSize({ width: viewport?.width ?? 360, height: viewport?.height ?? 640 });
  await openGame(page);
  await page.locator('#btn-play').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');

  const probe = await page.evaluate(() => {
    const slotAt = (x: number, y: number): string | null =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>('.door')?.dataset['slot'] ?? null;

    const faces = [...document.querySelectorAll<HTMLElement>('.door')].map((door) => {
      const box = door.querySelector('.door__face')?.getBoundingClientRect();
      return { slot: door.dataset['slot'] ?? '', box };
    });

    // The centre of every visible face must resolve to its own door...
    const centres = faces.map(({ slot, box }) => ({
      slot,
      hit: box === undefined ? null : slotAt(box.left + box.width / 2, box.top + box.height / 2),
    }));

    // ... and the dead space between stacked doors must still hit one of them.
    const gaps: (string | null)[] = [];
    for (let i = 0; i + 1 < faces.length; i += 1) {
      const above = faces[i]?.box;
      const below = faces[i + 1]?.box;
      if (above === undefined || below === undefined || below.top < above.bottom) {
        continue;
      }
      gaps.push(slotAt(above.left + above.width / 2, (above.bottom + below.top) / 2));
    }

    return { centres, gaps };
  });

  for (const centre of probe.centres) {
    expect(centre.hit, `centre of ${centre.slot}`).toBe(centre.slot);
  }
  expect(probe.gaps.length).toBeGreaterThan(10);
  expect(probe.gaps.filter((slot) => slot === null)).toEqual([]);
  });
}

test('serving, with the hint ladder showing', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openGame(page);
  await page.locator('#btn-play').click();

  // Load largest-door-first until a parcel will not fit, then let LOAD expire.
  const full = page.locator('.door[data-state="full"]');
  for (let i = 0; i < 30; i += 1) {
    const empties = page.locator('.door[data-state="empty"]');
    const free = await empties.count();
    const before = await full.count();
    if (free === 0 || before >= 12) {
      break;
    }
    await empties.nth(free - 1).click();
    if ((await full.count()) === before) {
      break;
    }
  }
  expect(await full.count()).toBeGreaterThan(3);

  await page.clock.runFor(26_000);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');

  // Idling past the second hint delay puts the active pickup at level 2, which
  // is what marks their column. Senders never get hints, so pick a pickup.
  const hinted = page.locator('.door[data-hint="column"]');
  for (let i = 0; i < 40 && (await hinted.count()) === 0; i += 1) {
    const pickup = page.locator('.card[data-kind="pickup"]').first();
    if ((await pickup.count()) > 0) {
      await pickup.click();
    }
    await page.clock.runFor(2_000);
  }

  // The whole column lights up, not just the door with the parcel in it.
  await expect(hinted).toHaveCount(7);
  const columns = await hinted.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset['slot']?.slice(0, 2)),
  );
  expect(new Set(columns).size).toBe(1);

  await page.screenshot({ path: `${SHOTS}serve-360x640.png` });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.clock.runFor(100);
  await page.screenshot({ path: `${SHOTS}serve-1280x800.png` });
});

test('title and result screens render', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGame(page);
  await expect(page.locator('#btn-play')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}title-390x844.png` });

  await page.locator('#btn-howto').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'howto');
  await page.screenshot({ path: `${SHOTS}howto-390x844.png` });

  await page.locator('#btn-howto-play').click();
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
  await page.screenshot({ path: `${SHOTS}result-390x844.png` });
});
