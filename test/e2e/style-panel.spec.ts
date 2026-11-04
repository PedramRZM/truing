// The style controls (TRU-4.3) through Truing itself on the fixture app, with
// the design-system fixture's tokens.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { type Locator, type Page, test as base } from '@playwright/test';

import type { Truing } from '../../src/truing';

import {
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

const PAGE = path.join(fixtureAppDir, 'app/style-panel/page.tsx');
const original = readFileSync(PAGE, 'utf8');

const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...fixtureConfig,
        app: { ...fixtureConfig.app, startRoute: '/style-panel' },
        server: { port: 4117 },
        tokens: 'test/fixtures/design-system/src/app/globals.css',
        modules: ['selection', 'changes'],
      });
      await provide(truing);
      await truing.close();
    },
    { scope: 'worker', timeout: 240_000 },
  ],
  shell: async ({ truing }, provide) => {
    await restoreSource(truing, PAGE, original, '/style-panel');
    const { shell } = truing;
    await shell.goto(`${truing.session.shellOrigin}/?route=/style-panel`);
    await expect(frameStatus(shell, 'Desktop', '/style-panel')).toBeVisible();
    await waitForHydration(shell, 'Desktop');
    await modeButton(shell, 'Select').click();
    await provide(shell);
    // Through the server: the tray's button can vanish between seeing it and
    // clicking it, and a teardown stuck there leaves the source edited.
    truing.modules.changes.discard();
    await restoreSource(truing, PAGE, original, '/style-panel');
  },
});

const tray = (shell: Page): Locator =>
  shell.getByRole('region', { name: 'Changes' });
const panel = (shell: Page): Locator =>
  shell.getByRole('region', { name: 'Selection' });
const section = (shell: Page, name: string): Locator =>
  panel(shell).getByRole('group', { name, exact: true });
const field = (shell: Page, name: string): Locator =>
  panel(shell).getByRole('spinbutton', { name, exact: true });

async function pick(shell: Page, label: string): Promise<void> {
  // Its edge: a chip's corner is rounded away, and its middle is its words.
  const target = frame(shell, 'Desktop').getByLabel(label);
  const box = await target.boundingBox();
  await target.click({
    position: { x: 4, y: Math.min(12, (box?.height ?? 8) / 2) },
  });
  await expect(section(shell, 'Layout')).toBeVisible();
}

/** The one change staged, once the tray shows it: staging is asynchronous. */
async function theChange(shell: Page, truing: Truing) {
  await expect(tray(shell).getByRole('listitem')).toHaveCount(1);
  return truing.modules.changes.list()[0];
}

/** Opens a token field and chooses a row. */
async function choose(
  shell: Page,
  field: RegExp,
  token: string,
): Promise<void> {
  await panel(shell).getByRole('button', { name: field }).first().click();
  await shell
    .getByRole('option', { name: new RegExp(`^${token}\\b`) })
    .first()
    .click();
}

test('a pick before the page hydrates waits for React, and the change is still direct', async ({
  shell,
  truing,
}) => {
  // Connected only means Truing's probe has loaded. Holding the app's scripts
  // back leaves the page drawn, with React yet to reach it.
  await shell.context().route('**/_next/static/chunks/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await shell.goto(`${truing.session.shellOrigin}/?route=/style-panel`);
  await expect(frameStatus(shell, 'Desktop', '/style-panel')).toBeVisible();
  await modeButton(shell, 'Select').click();

  await pick(shell, 'Bold style');
  await choose(shell, /^Text style/, 'label-md');
  const change = await theChange(shell, truing);
  await shell.context().unroute('**/_next/static/chunks/**');
  expect(change?.write).toMatchObject({
    edit: { add: ['text-label-md'] },
  });
});

test("changing a card's text style, background and radius rewrites its classes", async ({
  shell,
}) => {
  await pick(shell, 'A card');
  await choose(shell, /^Text style/, 'label-md');
  await choose(shell, /^Fill/, 'primary');
  await field(shell, 'Radius').press('ArrowUp');
  await field(shell, 'Radius').press('Enter');
  await expect(tray(shell).getByRole('listitem')).toHaveCount(3);
  expect(readFileSync(PAGE, 'utf8')).toBe(original);

  await tray(shell).getByRole('button', { name: 'Apply' }).click();
  await expect
    .poll(() => readFileSync(PAGE, 'utf8'))
    .toContain(
      '<div aria-label="A card" className="text-label-md bg-primary rounded-2xl">',
    );
});

test('a text style takes conflicting weight and line height with it', async ({
  shell,
  truing,
}) => {
  await pick(shell, 'Bold style');
  await choose(shell, /^Text style/, 'label-md');
  const change = await theChange(shell, truing);
  expect(change?.write).toMatchObject({
    edit: {
      add: ['text-label-md'],
      remove: ['text-title-m', 'font-bold'],
    },
  });
});

test('changing one value flags the style, and choosing a style clears it', async ({
  shell,
}) => {
  await pick(shell, 'Styled text');
  const style = panel(shell).getByRole('button', { name: /^Text style/ });
  await expect(style).toHaveAccessibleName('Text style title-m');
  await field(shell, 'Weight').press('ArrowDown');
  await field(shell, 'Weight').press('Enter');
  await expect(style).toHaveAccessibleName('Text style title-m, off the scale');
  await choose(shell, /^Text style/, 'label-md');
  await expect(style).toHaveAccessibleName('Text style label-md');
});

test('choosing the style it already names clears what fights it', async ({
  shell,
  truing,
}) => {
  await pick(shell, 'Bold style');
  await choose(shell, /^Text style/, 'title-m');
  const change = await theChange(shell, truing);
  expect(change?.write).toMatchObject({ edit: { remove: ['font-bold'] } });
  await expect(
    panel(shell).getByRole('button', { name: /^Text style/ }),
  ).toHaveAccessibleName('Text style title-m');
});

test('a second size step still keeps the weight', async ({ shell, truing }) => {
  await pick(shell, 'Styled text');
  await field(shell, 'Size').fill('18');
  await field(shell, 'Size').press('Enter');
  await theChange(shell, truing);
  await field(shell, 'Size').fill('20');
  await field(shell, 'Size').press('Enter');
  await expect(tray(shell).getByRole('listitem')).toContainText('→ 20');
  const change = await theChange(shell, truing);
  expect(change?.write).toMatchObject({
    edit: { add: ['text-xl', 'font-bold'] },
  });
});

test('a token with the same value as a class by hand still replaces it', async ({
  shell,
  truing,
}) => {
  await pick(shell, 'Fill by hand');
  await choose(shell, /^Fill/, 'primary');
  const change = await theChange(shell, truing);
  expect(change?.write).toMatchObject({
    edit: { add: ['bg-primary'], remove: ['bg-[#1c68d4]'] },
  });
});

test('removing a border takes its staged colour with it, and Apply writes', async ({
  shell,
}) => {
  await pick(shell, 'Bordered');
  await choose(shell, /^Border colour/, 'primary');
  await panel(shell).getByRole('button', { name: 'Remove border' }).click();
  await expect(tray(shell).getByRole('listitem')).toHaveCount(1);
  await tray(shell).getByRole('button', { name: 'Apply' }).click();
  await expect
    .poll(() => readFileSync(PAGE, 'utf8'))
    .toContain('<div aria-label="Bordered">');
});

test('a size alone keeps the weight of the style it leaves', async ({
  shell,
  truing,
}) => {
  await pick(shell, 'Styled text');
  await field(shell, 'Size').fill('18');
  await field(shell, 'Size').press('Enter');
  const change = await theChange(shell, truing);
  expect(change?.write).toMatchObject({
    edit: { add: ['text-lg', 'font-bold'] },
  });
});

test('colours list semantic tokens first, then families, with swatches', async ({
  shell,
}) => {
  await pick(shell, 'A card');
  await panel(shell).getByRole('button', { name: /^Fill/ }).first().click();
  const groups = shell.getByRole('listbox').getByRole('group');
  await expect(groups.first()).toHaveAccessibleName('Semantic');
  await expect(
    shell
      .getByRole('option', { name: /^primary #/ })
      .locator('.inspect-swatch'),
  ).toBeVisible();
  await expect(shell.getByRole('group', { name: 'Grey' })).toBeVisible();
  await shell.keyboard.press('Escape');
});

test('text that fails contrast on its background says so', async ({
  shell,
}) => {
  await pick(shell, 'Faint text');
  await expect(panel(shell).getByRole('status')).toContainText(
    /^Contrast is [\d.]+:1\. This text needs 4\.5:1\.$/,
  );
  await choose(shell, /^Colour/, 'foreground');
  await expect(panel(shell).getByRole('status')).toHaveCount(0);
});

test("an empty section's + adds one, and the section opens", async ({
  shell,
}) => {
  await pick(shell, 'A bare box');
  await panel(shell).getByRole('button', { name: 'Add fill' }).click();
  await shell.getByRole('option', { name: /^primary #/ }).click();
  await expect(
    section(shell, 'Fill').getByRole('button', { name: /^Fill primary/ }),
  ).toBeVisible();

  await panel(shell).getByRole('button', { name: 'Add border' }).click();
  await expect(field(shell, 'Border width')).toHaveValue('1');

  await panel(shell).getByRole('button', { name: 'Add shadow' }).click();
  await shell.getByRole('option', { name: /^floating-card/ }).click();
  await expect(
    section(shell, 'Shadow').getByRole('button', {
      name: /^Shadow floating-card/,
    }),
  ).toBeVisible();
});

test('a shadow shows its token, not its layers', async ({ shell }) => {
  await pick(shell, 'A bare box');
  await panel(shell).getByRole('button', { name: 'Add shadow' }).click();
  await expect(shell.getByRole('option', { name: /rgb/ })).toHaveCount(0);
  await shell.getByRole('option', { name: 'pane', exact: true }).click();
  await expect(
    section(shell, 'Shadow').getByRole('button', { name: /^Shadow pane/ }),
  ).toBeVisible();
  await expect(section(shell, 'Shadow')).not.toContainText('rgb');
  await expect(tray(shell).getByRole('listitem')).toContainText('pane');
});

test('radius steps through tokens, and opens to each corner', async ({
  shell,
  truing,
}) => {
  await pick(shell, 'A card');
  await panel(shell)
    .getByRole('button', { name: 'Radius on each corner' })
    .click();
  const corner = field(shell, 'Top left radius');
  await corner.press('ArrowUp');
  await corner.press('Enter');
  const change = await theChange(shell, truing);
  expect(change?.write).toMatchObject({
    edit: { add: ['rounded-tl-2xl'] },
  });
});

test('opacity moves in Tailwind steps', async ({ shell, truing }) => {
  await pick(shell, 'A card');
  const opacity = field(shell, 'Opacity');
  await expect(opacity).toHaveValue('100');
  await opacity.fill('52');
  await opacity.press('Enter');
  await expect(shell.getByText('Snapped to 50')).toBeVisible();
  const change = await theChange(shell, truing);
  expect(change?.write).toMatchObject({ edit: { add: ['opacity-50'] } });
});

test('underline adds and takes away its class', async ({ shell, truing }) => {
  await pick(shell, 'Underlined');
  await panel(shell).getByRole('button', { name: 'Remove underline' }).click();
  const change = await theChange(shell, truing);
  expect(change?.write).toMatchObject({
    edit: { add: [], remove: ['underline'] },
  });
});

test('a component with no className: every use is direct, this use goes to Claude', async ({
  shell,
  truing,
}) => {
  await pick(shell, 'First question');
  await expect(
    panel(shell).getByRole('spinbutton', { name: 'Radius', exact: true }),
  ).toHaveAttribute('aria-valuetext', /off the scale/);
  await field(shell, 'Radius').fill('16');
  await field(shell, 'Radius').press('Enter');
  const thisUse = await theChange(shell, truing);
  expect(thisUse?.route).toMatchObject({ by: 'claude' });
  await expect(tray(shell).getByRole('listitem')).toContainText('one use can');

  await panel(shell)
    .getByRole('button', { name: /^Every QuestionChip · 2 uses/ })
    .click();
  await field(shell, 'Radius').fill('24');
  await field(shell, 'Radius').press('Enter');
  await expect(tray(shell).getByRole('listitem')).toContainText(
    'Changes every QuestionChip: 2 uses',
  );
  await tray(shell).getByRole('button', { name: 'Apply' }).click();
  await expect.poll(() => readFileSync(PAGE, 'utf8')).toContain('rounded-3xl');
});

test('its off-token shadow is flagged, and offers the nearest token', async ({
  shell,
}) => {
  await pick(shell, 'First question');
  const shadow = section(shell, 'Shadow').getByRole('button', {
    name: /^Shadow/,
  });
  await expect(shadow).toHaveAccessibleName('Shadow Custom, off the scale');
  await shadow.click();
  const nearest = shell.getByRole('group', { name: 'Nearest' });
  await expect(nearest.getByRole('option').first()).toHaveAccessibleName(
    /^floating-card/,
  );
  await shell.keyboard.press('Escape');
});

test('a class picked from a condition goes to Claude, with why', async ({
  shell,
}) => {
  await pick(shell, 'A list');
  await field(shell, 'Radius').press('ArrowUp');
  await field(shell, 'Radius').press('Enter');
  await expect(tray(shell).getByRole('listitem')).toContainText(
    'class comes from a condition',
  );
});
