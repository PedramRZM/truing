// Inspector extras (TRU-2.3), through Truing itself on the fixture app's
// /inspect route: the pick's keys, sizes in the labels, the spacing overlays,
// the context menu and copies, the layers filter, the ? sheet and Fill. Also
// the hit test that couldn't pick what lay under a picture, or a disabled
// button (a real app's chat page).
import type { Page } from '@playwright/test';

import { formatPx } from '../../src/modules/selection/measure';
import type { Truing } from '../../src/truing';

import { chooseViewport, frameStatus } from './fixtures';
import {
  design,
  expect,
  frame,
  layers,
  modeButton,
  pickedText,
  test,
} from './inspect-fixture';

/** The overlay's shadow root in the Desktop frame: labels, bands, measurements. */
const overlay = (shell: Page) =>
  frame(shell, 'Desktop').locator('truing-overlay');

/** The `<tag>` the inspector's title shows for the pick. */
// Visible only: while a new pick loads, React keeps the last one in the DOM, hidden.
const pickedTag = (shell: Page) =>
  design(shell).locator('.inspect-title code').filter({ visible: true });

async function allowClipboard(shell: Page, truing: Truing) {
  await truing.context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: truing.session.shellOrigin,
  });
  return () => shell.evaluate(() => navigator.clipboard.readText());
}

test('a picture laid over text, and a disabled button that takes no pointer events, are picked as they are seen', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  // The browser hands both clicks to something else: the picture, and the row
  // around the button.
  await app.getByText('Under the background').click({ force: true });
  await expect(pickedTag(shell)).toHaveText('<p>');

  await app.getByRole('button', { name: 'Send' }).click({ force: true });
  await expect(pickedTag(shell)).toHaveText('<button>');
  // Enter goes in to its icon.
  await shell.keyboard.press('Enter');
  await expect(pickedTag(shell)).toHaveText('<svg>');

  // A small picture over a sibling's gradient isn't a veil: it is picked.
  await app.getByRole('img', { name: 'Badge logo' }).click();
  await expect(pickedTag(shell)).toHaveText('<img>');
});

test('the hover and pick labels show the size, and a path inside an <svg> resolves to the <svg>', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app.getByRole('button', { name: 'Pressed 0 times' }).hover();
  await expect(
    overlay(shell).getByText(/^button · Button · \d+×\d+$/),
  ).toBeVisible();

  await app.getByRole('img', { name: 'Fixture icon' }).click();
  await expect(pickedTag(shell)).toHaveText('<svg>');
  await expect(
    overlay(shell).getByText(/^svg( · \w+)? · 24×24$/),
  ).toBeVisible();
});

test('Enter, Shift+Enter, Tab and Shift+Tab move the pick, and the tree and the inspector follow', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  const tree = layers(shell);
  await app.getByText('Beta').click();
  await expect.poll(() => pickedText(shell)).toBe('Beta');

  await shell.keyboard.press('Tab');
  await expect.poll(() => pickedText(shell)).toBe('Gamma');
  await expect(tree.locator('[aria-current="true"]')).toHaveText('Gamma');

  await shell.keyboard.press('Shift+Tab');
  await shell.keyboard.press('Shift+Tab');
  await expect.poll(() => pickedText(shell)).toBe('Alpha');

  await shell.keyboard.press('Shift+Enter');
  await expect(pickedTag(shell)).toHaveText('<ul>');
  await expect(tree.locator('[aria-current="true"]')).toHaveText('<ul>');

  await shell.keyboard.press('Enter');
  await expect(pickedTag(shell)).toHaveText('<li>');
  await expect.poll(() => pickedText(shell)).toBe('Alpha');
});

test('Esc closes one layer a press: the menu, then the pick; no single key fires in a field', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app.getByText('Beta').click({ button: 'right' });
  const menu = shell.getByRole('menu', { name: 'Element' });
  await expect(menu).toBeVisible();

  await shell.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(pickedTag(shell)).toHaveText('<li>');

  await shell.keyboard.press('Escape');
  await expect(design(shell)).toContainText('Press V, then pick an element');

  // Typing V and I into the layers filter types them; the mode stays.
  const filter = shell.getByRole('searchbox', { name: 'Filter layers' });
  await filter.fill('');
  await filter.pressSequentially('vi');
  await expect(filter).toHaveValue('vi');
  await expect(modeButton(shell, 'Select')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('with Spacing on, the pick shows its padding and margin, auto where the margin is auto, and Alt measures to another element', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await shell.keyboard.press('s');
  // In the box's padding, so the click lands on the box and not a child.
  await app.getByLabel('Spaced box').click({ position: { x: 4, y: 4 } });
  await expect(pickedTag(shell)).toHaveText('<div>');

  const bands = overlay(shell).locator('[data-layer="spacing"]');
  await expect(
    bands.locator('[data-band^="margin"], [data-band^="padding"]'),
  ).toHaveCount(8);
  // Its two children are a space apart: since TRU-2.5 that gap is drawn too.
  const gap = bands.locator('[data-band="gap-horizontal"]');
  await expect(gap).toHaveCount(1);
  const widthOfGap = (): Promise<number> =>
    gap.evaluate((band) => band.getBoundingClientRect().width);
  // It exists a moment before it has its width.
  await expect.poll(widthOfGap).toBeGreaterThan(0);
  const gapWidth = await widthOfGap();
  const labels = await bands.locator('div:not([data-band])').allTextContents();
  expect(labels.toSorted()).toEqual(
    [
      '12',
      '12',
      '16',
      '16',
      '8',
      '8',
      'auto',
      'auto',
      formatPx(gapWidth),
    ].toSorted(),
  );

  await shell.keyboard.press('s');

  // The list contains a row: four insets, the ul's 40 px indent among them.
  await app.getByText('Beta').click();
  await shell.keyboard.down('Alt');
  await app
    .getByRole('list', { name: 'Items' })
    .hover({ position: { x: 4, y: 4 } });
  const measures = overlay(shell).locator('[data-layer="measure"]');
  await expect(measures.locator('[data-measure]')).not.toHaveCount(0);
  await expect(measures).toContainText('40');
  await shell.keyboard.up('Alt');
  await app
    .getByRole('list', { name: 'Items' })
    .hover({ position: { x: 6, y: 6 } });
  await expect(measures.locator('[data-measure]')).toHaveCount(0);
});

test('the context menu, in a frame or on a tree row, copies the pick and says so; a style row copies its token', async ({
  shell,
  truing,
}) => {
  const clipboard = await allowClipboard(shell, truing);
  const app = frame(shell, 'Desktop');
  const status = shell.getByRole('status').filter({ hasText: /^Copied/ });

  await app.getByText('Beta').click({ button: 'right' });
  const menu = shell.getByRole('menu', { name: 'Element' });
  await expect(
    menu.getByRole('menuitem', { name: 'Open call site O', exact: true }),
  ).toBeEnabled();
  await expect(
    menu.getByRole('menuitem', { name: 'Open call site O', exact: true }),
  ).toContainText('O');
  await expect(menu.getByRole('menuitem', { name: 'Copy path' })).toContainText(
    'C',
  );
  await menu.getByRole('menuitem', { name: 'Copy selector' }).click();
  await expect(status).toHaveText('Copied the selector');
  const selector = await clipboard();
  expect(
    await app
      .locator('body')
      .evaluate(
        (_, wanted) => document.querySelector(wanted)?.textContent,
        selector,
      ),
  ).toBe('Beta');

  // The same menu from the tree's row.
  await layers(shell)
    .getByRole('button', { name: 'Gamma', exact: true })
    .click({
      button: 'right',
    });
  await menu.getByRole('menuitem', { name: 'Copy classes' }).click();
  await expect(status).toHaveText('Copied the classes');
  expect(await clipboard()).toBe('px-100');
  await expect.poll(() => pickedText(shell)).toBe('Gamma');

  // A picked element without classes can't copy them.
  await app
    .getByRole('heading', { name: 'Inspect fixture' })
    .click({ button: 'right' });
  await expect(
    menu.getByRole('menuitem', { name: 'Copy classes' }),
  ).toBeDisabled();
  await shell.keyboard.press('Escape');

  await app.getByRole('button', { name: 'Pressed 0 times' }).click();
  await design(shell).getByRole('button', { name: 'Copy spacing-400' }).click();
  await expect(status).toHaveText('Copied spacing-400');
  expect(await clipboard()).toBe('spacing-400');
});

test('the layers filter keeps the matches with their ancestors, moves with ↑ and ↓, picks with Enter and clears with Esc', async ({
  shell,
}) => {
  const tree = layers(shell);
  const filter = shell.getByRole('searchbox', { name: 'Filter layers' });

  await filter.fill('beta');
  await expect(
    tree.getByRole('button', { name: 'Beta', exact: true }),
  ).toBeVisible();
  await expect(
    tree.getByRole('button', { name: 'Alpha', exact: true }),
  ).toHaveCount(0);
  // Its ancestors stay, so the match sits where it is on the page.
  await expect(
    tree.getByRole('button', { name: 'ClientPanel', exact: true }),
  ).toBeVisible();
  await expect(tree.getByRole('status')).toHaveText('Match 1 of 1');
  await filter.press('Enter');
  await expect.poll(() => pickedText(shell)).toBe('Beta');

  await filter.fill('li');
  await expect(tree.getByRole('status')).toHaveText(/^Match 1 of \d+$/);
  await filter.press('ArrowDown');
  await expect(tree.getByRole('status')).toHaveText(/^Match 2 of \d+$/);

  await filter.fill('zzz');
  await expect(tree).toContainText('No layers match “zzz”.');

  await filter.press('Escape');
  await expect(filter).toHaveValue('');
  await expect(
    tree.getByRole('button', { name: 'Alpha', exact: true }),
  ).toBeVisible();
  // Rows show what they are: text rows by their text, components by name.
  await expect(
    tree.getByRole('button', { name: 'Beta', exact: true }),
  ).toHaveAttribute('data-icon', 'text');
  await expect(
    tree.getByRole('button', { name: 'ClientPanel', exact: true }),
  ).toHaveAttribute('data-icon', 'component');
});

test('? opens a sheet of every shortcut, from the list the tooltips and the keys read', async ({
  shell,
}) => {
  await shell.keyboard.press('?');
  const sheet = shell.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Select the first childEnter');
  await expect(sheet).toContainText('Select the parentShift+Enter');
  await expect(sheet).toContainText('Open call siteO');
  await expect(sheet).toContainText('Zoom to fitShift+1');
  await expect(sheet).toContainText('Open or close the left panelCtrl+\\');
  await shell.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // The controls' tooltips come from the same entries (this is Linux, not a Mac).
  await expect(
    shell.getByRole('button', { name: 'Zoom to fit' }),
  ).toHaveAttribute('title', 'Zoom to fit (Shift+1)');
  await expect(modeButton(shell, 'Select')).toHaveAttribute(
    'title',
    "Select (V). Pick elements. Clicks don't reach the page.",
  );
  await shell.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
});

test('Fill shows one frame at the canvas’s own size, follows the window, and a device brings the canvas back', async ({
  shell,
}) => {
  const canvas = shell.getByRole('main', { name: 'Canvas' });
  const iframe = shell.getByTitle(/view of the app$/);
  const size = (locator: typeof canvas) =>
    locator.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });

  await chooseViewport(shell, /^Fill/);
  await expect(frameStatus(shell, 'Fill', '/inspect')).toBeAttached();
  await expect.poll(() => size(iframe)).toEqual(await size(canvas));
  // No device chrome: no grips, and the label is for screen readers only.
  await expect(shell.locator('.frame-handle')).toHaveCount(0);

  const before = shell.viewportSize();
  await shell.setViewportSize({ width: 1100, height: 700 });
  try {
    // 1100 px keeps the left panel and rail, not the right panel, and the bar takes 41 px.
    await expect.poll(() => size(iframe)).toEqual({ width: 818, height: 659 });
    await chooseViewport(shell, /^Desktop/);
    await expect(frameStatus(shell, 'Desktop', '/inspect')).toBeVisible();
    await expect
      .poll(async () => (await size(iframe)).width)
      .toBeLessThan(1100);
  } finally {
    if (before) await shell.setViewportSize(before);
  }
});
