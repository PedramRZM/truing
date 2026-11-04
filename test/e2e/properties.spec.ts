// The properties panel (TRU-3.8): sections that follow the selection, on the
// fixture's /properties. Throwaway scripts checked the same.
import { type Locator, type Page, test as base } from '@playwright/test';

import type { Truing } from '../../src/truing';

import {
  expect,
  fixtureConfig,
  frame,
  frameStatus,
  packageRoot,
  startHeadless,
} from './fixtures';

const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...fixtureConfig,
        app: { ...fixtureConfig.app, startRoute: '/properties' },
        server: { port: 4115 },
        modules: ['selection', './test/modules/property-section'],
      });
      await provide(truing);
      await truing.close();
    },
    { scope: 'worker', timeout: 240_000 },
  ],
  shell: async ({ truing }, provide) => {
    const { shell } = truing;
    await shell.goto(`${truing.session.shellOrigin}/?route=/properties`);
    await shell.evaluate(() => localStorage.clear());
    await shell.reload();
    await expect(frameStatus(shell, 'Desktop', '/properties')).toBeVisible();
    await provide(shell);
    // A pick comes back after a reload, by design, so the next test would inherit it.
    await shell.keyboard.press('Escape');
    await expect(panel(shell)).toContainText('Press V, then pick an element');
  },
});

const panel = (shell: Page): Locator =>
  shell.getByRole('region', { name: 'Selection' });
const section = (shell: Page, name: string): Locator =>
  panel(shell).getByRole('group', { name, exact: true });

async function pick(shell: Page, target: Locator): Promise<void> {
  await shell
    .getByRole('toolbar', { name: 'Truing' })
    .getByRole('button', { name: 'Select', exact: true })
    .click();
  // A corner: the middle of a card is what's inside it.
  await target.click({ position: { x: 6, y: 6 } });
  await expect(section(shell, 'Layout')).toBeVisible();
}

const titles = (shell: Page): Promise<string[]> =>
  panel(shell).locator('.design-section-title').allTextContents();

test('nothing picked shows the page', async ({ shell }) => {
  const page = section(shell, 'Page');
  await expect(page).toContainText('Route/properties');
  await expect(page).toContainText('Viewport');
  await expect(panel(shell)).toContainText('Press V, then pick an element');
});

test('a filled frame opens its sections, in order, with real values', async ({
  shell,
}) => {
  await pick(
    shell,
    frame(shell, 'Desktop').getByRole('region', { name: 'Filled card' }),
  );

  await expect
    .poll(() => titles(shell))
    .toEqual([
      'Selection',
      'Layout',
      'Flex',
      'Spacing',
      'Radius',
      'Blending',
      'Fill',
      'Border',
      'Outline',
      'Shadow',
      'Inner shadow',
      'Filters',
      'Interaction',
      'Selection colours',
      'Code',
    ]);
  // Fields since TRU-4.2, which hold their values rather than show them as text.
  const field = (name: string): Locator =>
    panel(shell).getByRole('spinbutton', { name, exact: true });
  await expect(field('Width')).toHaveValue('320');
  await expect(
    section(shell, 'Layout')
      .getByRole('radiogroup', { name: 'Width sizing' })
      .getByRole('radio', { name: 'Fixed' }),
  ).toBeChecked();
  await expect(
    section(shell, 'Flex').getByRole('radio', { name: 'Down' }),
  ).toBeChecked();
  await expect(field('Gap')).toHaveValue('8');
  await expect(field('Padding across')).toHaveValue('16');
  await expect(field('Padding up and down')).toHaveValue('12');
  await expect(field('Radius')).toHaveValue('8');
  await expect(field('Opacity')).toHaveValue('50');
  await expect(section(shell, 'Fill')).toContainText('#3d82f2');
  await expect(field('Border width')).toHaveValue('2');
  // Added by another module, in its place, with no change to the shell.
  await expect(section(shell, 'Selection colours')).toContainText('Picked');
});

test('text shows its own sections', async ({ shell }) => {
  await pick(
    shell,
    frame(shell, 'Desktop').getByRole('heading', { name: 'A heading' }),
  );

  await expect
    .poll(() => titles(shell))
    .toEqual([
      'Selection',
      'Layout',
      'Spacing',
      'Blending',
      'Fill',
      'Text',
      'Underline',
      'Stroke',
      'Shadow',
      'Filters',
      'Interaction',
      'Code',
    ]);
  const field = (name: string): Locator =>
    panel(shell).getByRole('spinbutton', { name, exact: true });
  await expect(field('Size')).toHaveValue('24');
  await expect(field('Letter spacing')).toHaveValue('0');
  await expect(
    section(shell, 'Underline').getByRole('button', {
      name: /^Underline colour/,
    }),
  ).toBeVisible();
});

test('an empty section is one greyed line with a + that adds it', async ({
  shell,
}) => {
  await pick(
    shell,
    frame(shell, 'Desktop').getByRole('heading', { name: 'A heading' }),
  );

  const stroke = section(shell, 'Stroke');
  await expect(
    stroke.getByRole('button', { name: 'Add stroke' }),
  ).toBeEnabled();
  const box = await stroke.boundingBox();
  expect(box?.height).toBe(33);
});

test('X and Y show only for what is placed absolutely', async ({ shell }) => {
  const app = frame(shell, 'Desktop');
  const place = (name: string): Locator =>
    section(shell, 'Layout').getByRole('spinbutton', { name, exact: true });
  await pick(shell, app.getByLabel('Bare frame'));
  await expect(place('X')).toHaveCount(0);

  await app.getByLabel('Placed box').click();
  await expect(place('X')).toHaveValue('40');
  await expect(place('Y')).toHaveValue('500');
});

test('Code starts closed and remembers being opened', async ({ shell }) => {
  const app = frame(shell, 'Desktop');
  await pick(shell, app.getByRole('heading', { name: 'A heading' }));

  const code = panel(shell).getByText('Code', { exact: true });
  const definition = panel(shell).getByText('Definition', { exact: true });
  await expect(definition).toBeHidden();
  await code.click();
  await expect(definition).toBeVisible();

  await app.getByLabel('Bare frame').click();
  await expect(section(shell, 'Layout')).toBeVisible();
  await expect(definition).toBeVisible();
});

test('a value is read again once the pointer has left, so it reads at rest', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await pick(shell, app.getByRole('button', { name: 'Fades on hover' }));
  const opacity = panel(shell).getByRole('spinbutton', {
    name: 'Opacity',
    exact: true,
  });
  await expect(opacity).toHaveValue('50');

  await app.getByRole('heading', { name: 'A heading' }).hover();
  await expect(opacity).toHaveValue('100');
});

test('a section that throws stops alone', async ({ shell }) => {
  await expect(panel(shell)).toContainText('The fixture stopped.');
  await expect(panel(shell)).toContainText('The fixture stopped deciding.');
  await expect(section(shell, 'Page')).toContainText('Route/properties');
});
