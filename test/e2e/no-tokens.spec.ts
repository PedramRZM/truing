// A project with no token stylesheet and no primitives folder is a normal
// project: it opens, and picking an element works.
import { type Page, test as base } from '@playwright/test';

import type { Truing } from '../../src/truing';

import {
  expect,
  fixtureConfig,
  frame,
  frameStatus,
  packageRoot,
  startHeadless,
} from './fixtures';

const { tokens: _tokens, primitives: _primitives, ...bare } = fixtureConfig;

const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...bare,
        server: { port: 4117 },
        modules: ['selection', 'changes'],
      });
      await provide(truing);
      await truing.close();
    },
    { scope: 'worker', timeout: 240_000 },
  ],
  shell: async ({ truing }, provide) => {
    const shell = truing.shell;
    await shell.goto(`${truing.session.shellOrigin}/?route=/`);
    await expect(frameStatus(shell, 'Desktop')).toBeVisible();
    await provide(shell);
  },
});

test('picking an element shows what it is, with no tokens to read', async ({
  shell,
}) => {
  await shell.getByRole('button', { name: 'Select', exact: true }).click();
  await frame(shell, 'Desktop')
    .getByRole('heading', { name: 'Fixture home' })
    .click();

  const inspector = shell.getByRole('region', { name: 'Selection' });
  await expect(inspector).toContainText('Fixture home');
  await expect(inspector).toContainText('Layout');
  await expect(inspector).not.toContainText("Didn't");
});

test('every panel opens, and none of them fails', async ({ shell }) => {
  await shell.getByRole('tab', { name: 'Theme' }).click();
  await expect(shell.getByRole('tabpanel')).toContainText(
    'No tokens found in this project.',
  );
  await expect(shell.getByText("Didn't start")).toHaveCount(0);
  await expect(shell.getByRole('alert')).toHaveCount(0);
  await shell.getByRole('tab', { name: 'Design' }).click();
  await expect(shell.getByText("Didn't start")).toHaveCount(0);
});
