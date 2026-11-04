// The layout controls (TRU-4.2) through Truing itself on the fixture app, with
// the design-system fixture's tokens.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { type Locator, type Page, test as base } from '@playwright/test';

import type { Truing } from '../../src/truing';

import {
  chooseViewport,
  expect,
  fixtureAppDir,
  fixtureConfig,
  frame,
  frameStatus,
  packageRoot,
  restoreSource,
  startHeadless,
  waitForHydration,
} from './fixtures';
import { modeButton } from './inspect-fixture';

const PAGE = path.join(fixtureAppDir, 'app/layout-panel/page.tsx');
const original = readFileSync(PAGE, 'utf8');

const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...fixtureConfig,
        app: { ...fixtureConfig.app, startRoute: '/layout-panel' },
        server: { port: 4116 },
        tokens: 'test/fixtures/design-system/src/app/globals.css',
        modules: ['selection', 'changes'],
      });
      await provide(truing);
      await truing.close();
    },
    { scope: 'worker', timeout: 240_000 },
  ],
  shell: async ({ truing }, provide) => {
    await restoreSource(truing, PAGE, original, '/layout-panel');
    const { shell } = truing;
    await shell.goto(`${truing.session.shellOrigin}/?route=/layout-panel`);
    await expect(frameStatus(shell, 'Desktop', '/layout-panel')).toBeVisible();
    await waitForHydration(shell, 'Desktop');
    await modeButton(shell, 'Select').click();
    await provide(shell);
    // Through the server: the tray's button can vanish between seeing it and
    // clicking it, and a teardown stuck there leaves the source edited.
    truing.modules.changes.discard();
    await restoreSource(truing, PAGE, original, '/layout-panel');
  },
});

const tray = (shell: Page): Locator =>
  shell.getByRole('region', { name: 'Changes' });
const panel = (shell: Page): Locator =>
  shell.getByRole('region', { name: 'Selection' });
const field = (shell: Page, name: string): Locator =>
  panel(shell).getByRole('spinbutton', { name, exact: true });

async function pick(shell: Page, label: string, on = 'Desktop'): Promise<void> {
  await frame(shell, on)
    .getByLabel(label)
    .click({ position: { x: 3, y: 3 } });
  await expect(
    panel(shell).getByRole('group', { name: 'Layout', exact: true }),
  ).toBeVisible();
}

const css = (
  shell: Page,
  label: string,
  property: string,
  on = 'Desktop',
): Promise<string> =>
  frame(shell, on)
    .getByLabel(label)
    .evaluate(
      (element, name) => getComputedStyle(element).getPropertyValue(name),
      property,
    );

test('changing padding replaces its class in the source', async ({ shell }) => {
  await pick(shell, 'A block');
  const across = field(shell, 'Padding across');
  await expect(across).toHaveValue('12');
  await across.press('ArrowUp');
  await across.press('Enter');
  await expect(tray(shell).getByRole('listitem')).toContainText('Direct');
  expect(readFileSync(PAGE, 'utf8')).toBe(original);

  await tray(shell).getByRole('button', { name: 'Apply' }).click();
  await expect
    .poll(() => readFileSync(PAGE, 'utf8'))
    .toBe(
      original.replace(
        '<div aria-label="A block" className="px-400">',
        '<div aria-label="A block" className="px-500">',
      ),
    );
});

test('stacking a row on Phone alone goes to Claude, with what is wanted', async ({
  shell,
  truing,
}) => {
  await chooseViewport(shell, /^Phone/);
  await expect(frameStatus(shell, 'Phone', '/layout-panel')).toBeVisible();
  await pick(shell, 'A row', 'Phone');
  await panel(shell).getByRole('radio', { name: 'This size only' }).click();
  await panel(shell).getByRole('radio', { name: 'Down' }).click();

  await expect(tray(shell).getByRole('listitem')).toContainText(
    'layout change at Phone size needs restructuring',
  );
  await expect
    .poll(() => css(shell, 'A row', 'flex-direction', 'Phone'))
    .toBe('column');
  const [change] = truing.modules.changes.list();
  expect(change?.route).toMatchObject({ by: 'claude' });
  expect(change?.scope).toEqual({ only: 'Phone' });
  expect(change?.intent).toContain('Stack the children in a column');
  expect(change?.intent).toContain('at Phone size only');
  await panel(shell).getByRole('radio', { name: 'All sizes' }).click();
});

test('from this size up writes the breakpoint, and the field says where a value comes from', async ({
  shell,
  truing,
}) => {
  await chooseViewport(shell, /^Tablet/);
  await expect(frameStatus(shell, 'Tablet', '/layout-panel')).toBeVisible();
  await pick(shell, 'Wider from Tablet', 'Tablet');
  const across = field(shell, 'Padding across');
  await expect(across).toHaveAttribute('aria-valuetext', /From Tablet up/);
  await panel(shell).getByRole('radio', { name: 'From this size up' }).click();
  await across.press('ArrowUp');
  await across.press('Enter');
  await expect(tray(shell).getByRole('listitem')).toContainText('Direct');
  const [change] = truing.modules.changes.list();
  expect(change?.write).toMatchObject({
    edit: { add: ['md:px-600'], remove: ['md:px-500'] },
  });
  await panel(shell).getByRole('radio', { name: 'All sizes' }).click();
});

test('a typed number off the scale snaps, and says so', async ({ shell }) => {
  await pick(shell, 'A block');
  const across = field(shell, 'Padding across');
  await across.fill('17');
  await across.press('Enter');
  await expect(shell.getByText('Snapped to 16')).toBeVisible();
  await expect(tray(shell).getByRole('listitem')).toContainText('12 → 16');
});

test('the page changing during an edit doesn’t lose the edit', async ({
  shell,
}) => {
  await pick(shell, 'A row');
  const gap = field(shell, 'Gap');
  await gap.press('ArrowUp');
  await expect(gap).toHaveValue('12');
  // Anything that changes the page makes the panel read it again, and the preview
  // of this edit is on the page: that must not read as the value it started from.
  await frame(shell, 'Desktop')
    .locator('body')
    .evaluate((body) => {
      body.append(document.createElement('section'));
    });
  await expect(gap).toHaveValue('12');
  await shell.waitForTimeout(600);

  await gap.press('Enter');
  await expect(tray(shell).getByRole('listitem')).toContainText('Gap: 8 → 12');
});

test('a new pick commits an unfinished change', async ({ shell }) => {
  await pick(shell, 'A row');
  const gap = field(shell, 'Gap');
  await gap.press('ArrowUp');
  await expect(gap).toHaveValue('12');
  await frame(shell, 'Desktop')
    .getByLabel('A block')
    .click({ position: { x: 3, y: 3 } });
  await expect(tray(shell).getByRole('listitem')).toContainText('Gap: 8 → 12');
  await expect.poll(() => css(shell, 'A row', 'column-gap')).toBe('12px');
});

test('pointing at an option shows it on the page, stages nothing, and leaving puts it back', async ({
  shell,
}) => {
  await pick(shell, 'A row');
  await panel(shell).getByRole('radio', { name: 'Down' }).hover();
  await expect.poll(() => css(shell, 'A row', 'flex-direction')).toBe('column');
  await expect(tray(shell).getByRole('listitem')).toHaveCount(0);

  await panel(shell).getByRole('radio', { name: 'Bottom right' }).hover();
  await expect
    .poll(() => css(shell, 'A row', 'justify-content'))
    .toBe('flex-end');

  await panel(shell).locator('.design-section-title').first().hover();
  await expect.poll(() => css(shell, 'A row', 'flex-direction')).toBe('row');
  await expect(tray(shell).getByRole('listitem')).toHaveCount(0);
});

test('pointing at a token in a menu shows it; Esc puts it back', async ({
  shell,
}) => {
  await pick(shell, 'A block');
  await panel(shell)
    .getByRole('button', { name: 'Choose padding across token' })
    .click();
  await shell.getByRole('option', { name: /^600 / }).hover();
  await expect.poll(() => css(shell, 'A block', 'padding-left')).toBe('18px');
  await shell.keyboard.press('Escape');
  await expect.poll(() => css(shell, 'A block', 'padding-left')).toBe('12px');
  await expect(tray(shell).getByRole('listitem')).toHaveCount(0);
});

test("pointing at a component's variant shows it; choosing it stages it", async ({
  shell,
}) => {
  await frame(shell, 'Desktop')
    .getByRole('button', { name: 'A button' })
    .click();
  await panel(shell)
    .getByRole('button', { name: /^size / })
    .click();
  await shell.getByRole('menuitemradio', { name: 'sm' }).hover();
  await expect.poll(() => css(shell, 'A button', 'padding-left')).toBe('4px');
  await expect(tray(shell).getByRole('listitem')).toHaveCount(0);

  await shell.getByRole('menuitemradio', { name: 'sm' }).click();
  await expect(tray(shell).getByRole('listitem')).toContainText(
    'Button size: default → sm',
  );
});

test('X and Y write left and top, only on what is placed', async ({
  shell,
}) => {
  await pick(shell, 'A block');
  await expect(field(shell, 'X')).toHaveCount(0);
  await pick(shell, 'Placed');
  await expect(field(shell, 'X')).toHaveValue('12');
  await field(shell, 'X').press('ArrowUp');
  await field(shell, 'X').press('Enter');
  await expect.poll(() => css(shell, 'Placed', 'left')).toBe('16px');
});

test('a component with no className: every use is direct, this use goes to Claude, and a value by hand is flagged', async ({
  shell,
}) => {
  await frame(shell, 'Desktop').getByText('First question').click();
  await expect(field(shell, 'Min height')).toHaveAttribute(
    'aria-valuetext',
    /off the scale/,
  );
  const across = field(shell, 'Padding across');
  await across.press('ArrowUp');
  await across.press('Enter');
  await expect(tray(shell).getByRole('listitem')).toContainText(
    'written inside QuestionChip',
  );
  await tray(shell).getByRole('button', { name: 'Discard' }).click();

  await panel(shell)
    .getByRole('button', { name: /^Every QuestionChip · 2 uses/ })
    .click();
  await across.press('ArrowUp');
  await across.press('Enter');
  const row = tray(shell).getByRole('listitem');
  await expect(row).toContainText('Direct');
  await expect(row).toContainText('Changes every QuestionChip: 2 uses');
});

test('a class built at runtime goes to Claude, with the reason', async ({
  shell,
}) => {
  await pick(shell, 'Built at runtime');
  const across = field(shell, 'Padding across');
  await across.press('ArrowUp');
  await across.press('Enter');
  await expect(tray(shell).getByRole('listitem')).toContainText(
    'class is built at runtime',
  );
});
