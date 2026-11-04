// Instances (TRU-2.2) through Truing itself on the fixture app's /instances
// route: every instance of the pick's component on the page, with a count
// and outlines, the variant filter, a list as one call site drawn N times,
// memo and forwardRef as the component they wrap, the uses in the code, and
// the choice between this use and the component reaching the Changes tray.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { test as base, type Page } from '@playwright/test';

import type { Truing } from '../../src/truing';

import {
  expect,
  fixtureAppDir,
  fixtureConfig,
  frame,
  frameStatus,
  packageRoot,
  startHeadless,
} from './fixtures';
import { at, modeButton } from './inspect-fixture';

const PANEL = 'app/instances/instances-panel.tsx';
const BADGE = path.join(fixtureAppDir, 'app/instances/badge.tsx');
const badgeSource = readFileSync(BADGE, 'utf8');

const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...fixtureConfig,
        app: { ...fixtureConfig.app, startRoute: '/instances' },
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
    await shell.goto(`${truing.session.shellOrigin}/?route=/instances`);
    await expect(frameStatus(shell, 'Desktop', '/instances')).toBeVisible();
    await modeButton(shell, 'Select').click();
    await provide(shell);
    const discard = shell
      .getByRole('region', { name: 'Changes' })
      .getByRole('button', { name: 'Discard' });
    if (await discard.isVisible()) await discard.click();
    // Only when an Apply changed it: an identical write still hot-reloads.
    if (readFileSync(BADGE, 'utf8') !== badgeSource) {
      writeFileSync(BADGE, badgeSource);
    }
  },
});

const inspector = (shell: Page) =>
  shell.getByRole('region', { name: 'Selection' });
const instances = (shell: Page) =>
  inspector(shell).getByRole('region', { name: 'Instances' });

/** How many instance outlines the overlay draws in the Desktop frame. */
function outlines(shell: Page): Promise<number> {
  return frame(shell, 'Desktop')
    .locator('truing-overlay')
    .evaluate(
      (host) =>
        host.shadowRoot?.querySelectorAll('[data-instance]').length ?? 0,
    );
}

/** Picks an element and waits until the inspector has read where it is written. */
async function pick(
  shell: Page,
  target: ReturnType<ReturnType<typeof frame>['getByText']>,
  place: string,
) {
  await target.click();
  await expect(inspector(shell)).toContainText(place);
}

async function pickTonal(shell: Page) {
  await frame(shell, 'Desktop')
    .getByRole('button', { name: 'Tonal', exact: true })
    .click();
  await expect(instances(shell)).toContainText('7 on this page');
}

test('outlines every instance of the picked component, with a count, and narrows to its variant', async ({
  shell,
}) => {
  await pickTonal(shell);
  const section = instances(shell);
  await section.getByRole('button', { name: 'Outline' }).click();
  await expect.poll(() => outlines(shell)).toBe(7);

  const filter = section.getByRole('group', { name: 'Which instances' });
  await filter
    .getByRole('button', { name: 'Button · tonal · default' })
    .click();
  await expect(section).toContainText('5 on this page');
  await expect.poll(() => outlines(shell)).toBe(5);

  await filter.getByRole('button', { name: 'All variants' }).click();
  await expect.poll(() => outlines(shell)).toBe(7);
  await section.getByRole('button', { name: 'Outline' }).click();
  await expect.poll(() => outlines(shell)).toBe(0);
});

test('a mapped list is one call site drawn three times, and hovering it outlines those three', async ({
  shell,
}) => {
  await pickTonal(shell);
  await instances(shell).getByText('On this page · 5 uses').click();
  const sites = instances(shell).getByRole('list', {
    name: 'Uses on this page',
  });
  await expect(sites.getByRole('listitem')).toHaveCount(5);
  const list = at(PANEL, '<Button variant="tonal">{step}');
  const row = sites.getByRole('listitem').filter({ hasText: list });
  await expect(row).toContainText('×3');
  await expect(
    sites
      .getByRole('listitem')
      .filter({ hasText: at(PANEL, '<Button variant="tonal">Tonal') }),
  ).toContainText('this use');

  await row.getByRole('button').hover();
  await expect.poll(() => outlines(shell)).toBe(3);
  // A click picks the first of them.
  await row.getByRole('button').click();
  await expect(inspector(shell)).toContainText('First');
});

test('memo and forwardRef uses count as the component they wrap, on the page and in the code', async ({
  shell,
}) => {
  await frame(shell, 'Desktop').getByText('New').first().click();
  const section = instances(shell);
  await expect(section).toContainText('4 on this page');
  await section.getByText('On this page · 4 uses').click();
  await expect(
    section
      .getByRole('list', { name: 'Uses on this page' })
      .getByRole('listitem'),
  ).toHaveCount(4);
  await expect(section).toContainText('In the code · 4 uses');
});

test('lists the uses in the code with file and line, a list marked as one', async ({
  shell,
}) => {
  await pickTonal(shell);
  await instances(shell)
    .getByText(/^In the code · \d+ uses$/)
    .click();
  const uses = instances(shell)
    .getByRole('list', { name: 'Uses in the code' })
    .getByRole('listitem');
  // The fixture app's Buttons, in the inspector's page and in this one.
  await expect(
    uses.filter({ hasText: 'test/fixture-app/app/inspect/client-panel.tsx' }),
  ).not.toHaveCount(0);
  await expect(
    uses.filter({ hasText: at(PANEL, '<Button variant="tonal">{step}') }),
  ).toContainText('in a list');
  await expect(
    uses.filter({ hasText: at(PANEL, '<Button>Plain') }),
  ).not.toContainText('in a list');
  // The count is the list's own length.
  const total = await uses.count();
  await expect(instances(shell)).toContainText(`In the code · ${total} uses`);
});

test('"Every Badge" writes its text as a shared change; "This use" sends it to Claude', async ({
  shell,
}) => {
  await pick(
    shell,
    frame(shell, 'Desktop').getByText('New').first(),
    'app/instances/badge.tsx:5',
  );
  const reach = inspector(shell).getByRole('group', {
    name: 'Which uses to edit',
  });
  await reach.getByRole('button', { name: 'Every Badge · 4 uses' }).click();
  await expect(
    reach.getByRole('button', { name: 'Every Badge · 4 uses' }),
  ).toHaveAttribute('aria-pressed', 'true');

  const text = inspector(shell).getByRole('textbox', { name: 'Text' });
  await text.fill('Fresh');
  await text.blur();
  const tray = shell.getByRole('region', { name: 'Changes' });
  const row = tray.getByRole('listitem').filter({ hasText: 'Text: “New”' });
  await expect(row).toContainText('Direct');
  await expect(row).toContainText('Changes every Badge: 4 uses in the code');

  await reach.getByRole('button', { name: 'This use' }).click();
  await text.fill('Newer');
  await text.blur();
  const claude = tray.getByRole('listitem').filter({ hasText: '“Newer”' });
  await expect(claude).toContainText(
    "it is written inside Badge, so one use can't change alone",
  );
  await expect(claude).not.toContainText('Changes every Badge');
});

test("a Server Component's Button is an instance of the client's Button, and the reverse", async ({
  shell,
}) => {
  await frame(shell, 'Desktop')
    .getByRole('button', { name: 'Server tonal' })
    .click();
  const section = instances(shell);
  await expect(section).toContainText('7 on this page');
  await section.getByText('On this page · 5 uses').click();
  await expect(
    section
      .getByRole('list', { name: 'Uses on this page' })
      .getByRole('listitem')
      .filter({
        hasText: 'test/fixture-app/app/instances/server-buttons.tsx',
      }),
  ).toContainText('this use');
});

test('text from a prop is set at each use, not inside the component', async ({
  shell,
}) => {
  await pick(
    shell,
    frame(shell, 'Desktop').getByRole('heading', { name: 'Alpha' }),
    'app/instances/heading.tsx:3',
  );
  const text = inspector(shell).getByRole('textbox', { name: 'Text' });
  await text.fill('Alpha one');
  await text.blur();
  const tray = shell.getByRole('region', { name: 'Changes' });
  const row = tray.getByRole('listitem').filter({ hasText: '“Alpha one”' });
  // This use: the engine's own reason, not "written inside Heading".
  await expect(row).toContainText('text is built at runtime');
  await expect(row).not.toContainText('written inside');

  await inspector(shell)
    .getByRole('group', { name: 'Which uses to edit' })
    .getByRole('button', { name: 'Every Heading · 2 uses' })
    .click();
  await text.fill('Alpha two');
  await text.blur();
  const shared = tray.getByRole('listitem').filter({ hasText: '“Alpha two”' });
  await expect(shared).toContainText('it is set where each Heading is used');
  await expect(shared).toContainText(
    'Changes every Heading: 2 uses in the code',
  );
});
