// The Changes summary at the right panel's foot (TRU-3.10). The Claude view of that
// panel comes with TRU-5.2, which adds "in both views" to this.
import { test as base, type Page } from '@playwright/test';

import type { Truing } from '../../src/truing';

import {
  expect,
  fixtureConfig,
  frame,
  frameStatus,
  packageRoot,
  startHeadless,
} from './fixtures';
import { modeButton } from './inspect-fixture';

const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...fixtureConfig,
        app: { ...fixtureConfig.app, startRoute: '/changes' },
        server: { port: 4116 },
        modules: ['selection', 'changes'],
      });
      await provide(truing);
      await truing.close();
    },
    { scope: 'worker', timeout: 240_000 },
  ],
  shell: async ({ truing }, provide) => {
    const { shell } = truing;
    await shell.goto(`${truing.session.shellOrigin}/?route=/changes`);
    await expect(frameStatus(shell, 'Desktop', '/changes')).toBeVisible();
    await modeButton(shell, 'Select').click();
    await provide(shell);
  },
});

const tray = (shell: Page) => shell.getByRole('region', { name: 'Changes' });

async function box(locator: ReturnType<Page['getByRole']>) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Not on screen.');
  return found;
}

test('the summary stays at the foot, and opens the list upward', async ({
  shell,
}) => {
  await expect(tray(shell)).toContainText('Changes you make show here.');

  await frame(shell, 'Desktop')
    .getByRole('button', { name: 'Send the design' })
    .click();
  await shell.getByRole('button', { name: /^variant / }).click();
  await shell.getByRole('menuitemradio', { name: 'default' }).click();

  const toggle = tray(shell).getByRole('button', { name: /^\d+ changes?$/ });
  const apply = tray(shell).getByRole('button', { name: 'Apply' });
  await expect(toggle).toBeVisible();
  await expect(apply).toBeVisible();

  const window = shell.viewportSize();
  const summary = await box(apply);
  expect((window?.height ?? 0) - (summary.y + summary.height)).toBeLessThan(16);

  // The specs' browser starts with it open (fixtures.ts).
  const rows = tray(shell).getByRole('list');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const list = await box(rows);
  expect(list.y + list.height).toBeLessThanOrEqual(summary.y);
  expect((await box(apply)).y).toBe(summary.y);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(rows).toHaveCount(0);
  expect((await box(apply)).y).toBe(summary.y);

  await tray(shell).getByRole('button', { name: 'Discard' }).click();
  await expect(tray(shell)).toContainText('Changes you make show here.');
});
