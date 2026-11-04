// Spacing at a glance (TRU-2.5), through Truing itself on the fixture app's
// /inspect route: the pick's gaps while Spacing is on, the Spacing toggle, a token's name on a label, pinned
// measurements, the parent's outline, and labels at screen size
// whatever the zoom.
import type { Locator, Page } from '@playwright/test';

import { formatPx } from '../../src/modules/selection/measure';

import { expect, frame, test } from './inspect-fixture';

const overlay = (shell: Page) =>
  frame(shell, 'Desktop').locator('truing-overlay');

/** The labels in one layer of the overlay, sorted. */
async function labelsIn(shell: Page, layer: string): Promise<string[]> {
  const texts = await overlay(shell)
    .locator(`[data-layer="${layer}"] div:not([data-band])`)
    .allTextContents();
  return texts.filter(Boolean).toSorted();
}

const spacingButton = (shell: Page) =>
  shell
    .getByRole('toolbar', { name: 'Truing' })
    .getByRole('button', { name: 'Spacing', exact: true });

test('only while Spacing is on does the pick show its bands and tokens', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  const bands = overlay(shell).locator('[data-layer="spacing"] [data-band]');
  await app.getByLabel('Token box').click({ position: { x: 4, y: 4 } });
  await expect(overlay(shell).locator('[data-label="pick"]')).toBeVisible();
  await expect(bands).toHaveCount(0);
  expect(await labelsIn(shell, 'spacing')).toEqual([]);

  await shell.keyboard.press('s');
  await expect(bands).not.toHaveCount(0);

  await shell.keyboard.press('s');
  await expect(bands).toHaveCount(0);
  await expect(overlay(shell).locator('[data-label="pick"]')).toBeVisible();

  // Alt shows them for a moment too.
  await shell.keyboard.down('Alt');
  await app.getByLabel('Token box').hover({ position: { x: 6, y: 6 } });
  await expect(bands).not.toHaveCount(0);
  await shell.keyboard.up('Alt');
  await app.getByLabel('Token box').hover({ position: { x: 4, y: 4 } });
  await expect(bands).toHaveCount(0);
});

test('with Spacing on, the pick shows the gaps between its children, measured from their boxes, and outlines its parent', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await shell.keyboard.press('s');
  // In the row's padding, so the click lands on the row and not a child.
  await app.getByLabel('Spaced row').click({ position: { x: 2, y: 2 } });

  const gaps = overlay(shell).locator(
    '[data-layer="spacing"] [data-band="gap-horizontal"]',
  );
  await expect(gaps).toHaveCount(2);
  // space-between leaves the same room between each pair: none of it was written as `gap`.
  // In the frame's own pixels, as the labels count them.
  const widths = await gaps.evaluateAll((bands) =>
    bands.map((band) => band.getBoundingClientRect().width),
  );
  const [first = 0, second = 0] = widths;
  expect(first).toBeGreaterThan(40);
  expect(Math.abs(first - second)).toBeLessThanOrEqual(1);
  expect(await labelsIn(shell, 'spacing')).toEqual(
    [formatPx(first), formatPx(second), '12', '12', '12', '12'].toSorted(),
  );

  // A margin between two blocks is a gap too.
  await app.getByLabel('Stacked').click({ position: { x: 2, y: 2 } });
  await expect(
    overlay(shell).locator('[data-layer="spacing"] [data-band="gap-vertical"]'),
  ).toHaveCount(1);
  expect(await labelsIn(shell, 'spacing')).toEqual(
    ['12', '12', '12', '12', '8'].toSorted(),
  );

  // The parent is outlined, dotted: the section, past a wrapper with no box.
  const parent = overlay(shell).locator('[data-outline="parent"]');
  await expect(parent).toBeVisible();
  const section = await app.getByLabel('Spacing fixture').boundingBox();
  const outline = await parent.boundingBox();
  expect(outline?.width).toBeCloseTo(section?.width ?? 0, 0);
  await shell.keyboard.press('s');
});

test('an <svg> is one picture: no gaps between its paths', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await shell.keyboard.press('s');
  await app.getByRole('img', { name: 'Fixture icon' }).click();
  await expect(
    shell.locator('.inspect-title code').filter({ visible: true }),
  ).toHaveText('<svg>');
  await expect(overlay(shell).locator('[data-label="pick"]')).toBeVisible();
  await expect(
    overlay(shell).locator('[data-layer="spacing"] [data-band^="gap"]'),
  ).toHaveCount(0);
  await shell.keyboard.press('s');
});

test('a label names the token whose class set the value', async ({ shell }) => {
  const app = frame(shell, 'Desktop');
  await shell.keyboard.press('s');
  await app.getByLabel('Token box').click({ position: { x: 4, y: 4 } });
  await expect
    .poll(() => labelsIn(shell, 'spacing'))
    .toEqual(['px-400 · 12', 'px-400 · 12']);

  // A hovered element's labels name theirs too.
  await app.getByLabel('Spaced row').click({ position: { x: 2, y: 2 } });
  await app.getByLabel('Token box').hover({ position: { x: 4, y: 4 } });
  await expect
    .poll(() => labelsIn(shell, 'hover-spacing'))
    .toEqual(['px-400 · 12', 'px-400 · 12']);
  await shell.keyboard.press('s');
});

test('Spacing, by key or by button, shows a hovered element’s box model and the distance to the pick without Alt', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  const button = spacingButton(shell);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toHaveAttribute('title', /Spacing \(S\)/);

  await app.getByLabel('Token box').click({ position: { x: 4, y: 4 } });
  const hoverBands = overlay(shell).locator(
    '[data-layer="hover-spacing"] [data-band]',
  );
  const measures = overlay(shell).locator(
    '[data-layer="measure"] [data-measure]',
  );

  // Off: hovering only outlines.
  await app.getByLabel('Spaced row').hover({ position: { x: 2, y: 2 } });
  await expect(hoverBands).toHaveCount(0);
  await expect(measures).toHaveCount(0);

  // S turns it on: the row's padding and gaps, and the distance to the pick.
  await shell.keyboard.press('s');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await app.getByLabel('Spaced row').hover({ position: { x: 3, y: 3 } });
  await expect(
    overlay(shell).locator(
      '[data-layer="hover-spacing"] [data-band="gap-horizontal"]',
    ),
  ).toHaveCount(2);
  await expect(
    overlay(shell).locator(
      '[data-layer="hover-spacing"] [data-band="padding-top"]',
    ),
  ).toHaveCount(1);
  await expect(measures).not.toHaveCount(0);

  // The button turns it off again.
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await app.getByLabel('Spaced row').hover({ position: { x: 2, y: 2 } });
  await expect(hoverBands).toHaveCount(0);
  await expect(measures).toHaveCount(0);

  // Alt still does it for a moment.
  await shell.keyboard.down('Alt');
  await app.getByLabel('Spaced row').hover({ position: { x: 3, y: 3 } });
  await expect(measures).not.toHaveCount(0);
  await expect(hoverBands).not.toHaveCount(0);
  await shell.keyboard.up('Alt');
});

test('Shift+click while measuring pins the measurement, several at once; Esc clears them before the pick', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app.getByLabel('Token box').click({ position: { x: 4, y: 4 } });
  await shell.keyboard.press('s');
  await expect(spacingButton(shell)).toHaveAttribute('aria-pressed', 'true');

  const pins = overlay(shell).locator('[data-layer="pins"] [data-pin]');
  await app
    .getByLabel('Spaced row')
    .click({ position: { x: 2, y: 2 }, modifiers: ['Shift'] });
  await expect(pins).toHaveCount(1);
  await app
    .getByLabel('Stacked')
    .click({ position: { x: 2, y: 2 }, modifiers: ['Shift'] });
  await expect(pins).toHaveCount(2);
  // A pin doesn't move the pick, and stays while the pointer moves on.
  await expect(
    shell.locator('.inspect-title code').filter({ visible: true }),
  ).toHaveText('<div>');
  await app.getByRole('heading', { name: 'Inspect fixture' }).hover();
  await expect(pins).toHaveCount(2);
  await expect(pins.first().locator('[data-measure]')).not.toHaveCount(0);

  await shell.keyboard.press('Escape');
  await expect(pins).toHaveCount(0);
  await expect(overlay(shell).locator('[data-label="pick"]')).toBeVisible();
  await shell.keyboard.press('Escape');
  await expect(overlay(shell).locator('[data-label="pick"]')).toBeHidden();

  await shell.keyboard.press('s');
});

test('the labels keep their size on screen at any zoom', async ({ shell }) => {
  const app = frame(shell, 'Desktop');
  // Playwright's box for an element in a frame leaves out the frame's own scale.
  const canvasScale = (): Promise<number> =>
    shell.getByTitle('Desktop view of the app').evaluate((element) => {
      const frameElement = element as HTMLElement;
      return (
        frameElement.getBoundingClientRect().width / frameElement.offsetWidth
      );
    });
  const heightOnScreen = async (target: Locator): Promise<number> =>
    ((await target.boundingBox())?.height ?? 0) * (await canvasScale());
  const zoom = shell.getByRole('button', { name: 'Zoom to 100%' });
  const percent = async () =>
    Number.parseInt((await zoom.textContent()) ?? '', 10);
  await shell.keyboard.press('s');
  await app.getByLabel('Token box').click({ position: { x: 4, y: 4 } });
  const pickLabel = overlay(shell).locator('[data-label="pick"]');
  const chip = overlay(shell)
    .locator('[data-layer="spacing"] div:not([data-band])')
    .first();
  await expect(pickLabel).toBeVisible();
  const atFit = {
    label: await heightOnScreen(pickLabel),
    chip: await heightOnScreen(chip),
  };

  // The label's own height, on screen, at the fitted zoom.
  expect(atFit.label).toBeCloseTo(20, 0);
  const fitted = await percent();

  // Down below TRU-2.3's unreadable 40%, from the keyboard.
  while ((await percent()) > 35) {
    const before = await percent();
    await shell.keyboard.press('ControlOrMeta+Minus');
    await expect.poll(percent).toBeLessThan(before);
  }
  expect(await percent()).toBeLessThan(fitted);
  await expect
    .poll(() => heightOnScreen(pickLabel))
    .toBeCloseTo(atFit.label, 0);
  expect(await heightOnScreen(chip)).toBeCloseTo(atFit.chip, 0);
  await shell.keyboard.press('s');
});

test('crowded chips keep their side and spread outward; the outline labels move off them', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  // The row sits right above the pick, where the pick's label is drawn, and
  // at the fitted zoom its top and bottom chips would meet in its middle.
  await app.getByLabel('Token box').click({ position: { x: 4, y: 4 } });
  await shell.keyboard.press('s');
  await app.getByLabel('Spaced row').hover({ position: { x: 2, y: 2 } });
  await expect(
    overlay(shell).locator('[data-layer="measure"] [data-chip]'),
  ).not.toHaveCount(0);

  const found = await overlay(shell).evaluate((host) => {
    const root = host.shadowRoot;
    if (!root) return { offSide: ['no overlay'], crowded: [], covered: [] };
    const edge = document.documentElement.clientWidth;
    const centre = (rect: DOMRect) => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    // Each band's chip is drawn right after it: on the band, or moved
    // straight out from its side.
    const offSide = [...root.querySelectorAll('[data-band]')].flatMap(
      (band) => {
        const chip = band.nextElementSibling;
        if (!(chip instanceof HTMLElement) || !('chip' in chip.dataset)) {
          return [];
        }
        const b = chip.getBoundingClientRect();
        // Kept inside the frame at its edge: that one moved on purpose.
        if (b.left <= 0.5 || b.right >= edge - 0.5) return [];
        const from = centre(band.getBoundingClientRect());
        const to = centre(b);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const side = chip.dataset.side;
        const ok =
          side === 'top'
            ? Math.abs(dx) <= 1 && dy <= 1
            : side === 'bottom'
              ? Math.abs(dx) <= 1 && dy >= -1
              : side === 'left'
                ? Math.abs(dy) <= 1 && dx <= 1
                : side === 'right'
                  ? Math.abs(dy) <= 1 && dx >= -1
                  : Math.hypot(dx, dy) <= 1;
        return ok ? [] : [`${chip.textContent} (${side ?? 'gap'})`];
      },
    );
    const hit = (a: DOMRect, b: DOMRect) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const chips = [...root.querySelectorAll<HTMLElement>('[data-chip]')];
    const crowded: string[] = [];
    for (const chip of chips.filter((c) => c.dataset.side)) {
      for (const other of chips) {
        if (other === chip) continue;
        if (hit(chip.getBoundingClientRect(), other.getBoundingClientRect())) {
          crowded.push(`${chip.textContent} / ${other.textContent}`);
        }
      }
    }
    const labels = [
      ...root.querySelectorAll<HTMLElement>('[data-label]'),
    ].filter((label) => label.style.display !== 'none');
    const covered: string[] = [];
    for (const label of labels) {
      for (const other of [...chips, ...labels]) {
        if (other === label) continue;
        if (hit(label.getBoundingClientRect(), other.getBoundingClientRect())) {
          covered.push(`${label.textContent} / ${other.textContent}`);
        }
      }
    }
    return { offSide, crowded, covered };
  });
  expect(found).toEqual({ offSide: [], crowded: [], covered: [] });
  await shell.keyboard.press('s');
});
