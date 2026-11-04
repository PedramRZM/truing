// Layer rows that behave like a design tool (TRU-3.7), on the fixture's /layers.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { fixtureAppDir, frame } from './fixtures';
import { expect, modeButton, test } from './inspect-fixture';

const tree = (shell: import('@playwright/test').Page) =>
  shell.getByRole('navigation', { name: 'Layers of the Desktop frame' });

async function openLayers(
  shell: import('@playwright/test').Page,
  shellOrigin: string,
) {
  await shell.goto(`${shellOrigin}/?route=/layers`);
  await tree(shell)
    .getByRole('button', { name: 'Design', exact: true })
    .click();
  await expect(tree(shell)).toContainText('Wrapped heading');
  await modeButton(shell, 'Select').click();
}

const current = (shell: import('@playwright/test').Page) =>
  tree(shell).locator('[aria-current="true"]');

test('a pick on the canvas opens the tree to its row and leaves focus alone', async ({
  shell,
  truing,
}) => {
  await openLayers(shell, truing.session.shellOrigin);
  await shell.keyboard.press('Alt+L');
  await expect(tree(shell)).not.toContainText('Wrapped heading');

  const filter = shell.getByRole('searchbox', { name: 'Filter layers' });
  await filter.focus();
  await frame(shell, 'Desktop')
    .getByRole('heading', { name: 'Wrapped heading' })
    .click();

  await expect(current(shell)).toContainText('Wrapped heading');
  await expect(current(shell)).toBeInViewport();
  await expect(filter).toBeFocused();
});

test('Alt+L collapses everything but the way to the selection', async ({
  shell,
  truing,
}) => {
  await openLayers(shell, truing.session.shellOrigin);
  await tree(shell)
    .getByRole('button', { name: 'Wrapped heading', exact: true })
    .click();
  await shell.keyboard.press('Alt+L');
  await expect(current(shell)).toContainText('Wrapped heading');
  await expect(tree(shell)).not.toContainText('Grid item');
});

test('the eye hides in the preview only: the source and the Changes tray stay as they are', async ({
  shell,
  truing,
}) => {
  await openLayers(shell, truing.session.shellOrigin);
  const page = path.join(fixtureAppDir, 'app/layers/page.tsx');
  const before = readFileSync(page, 'utf8');
  const heading = frame(shell, 'Desktop').getByText('Wrapped heading');
  await expect(heading).toBeVisible();

  const hide = tree(shell).getByRole('button', {
    name: 'Hide Wrapped heading',
  });
  await hide.hover();
  await hide.click();
  await expect(heading).toBeHidden();
  // The row stays, and so does its eye, once the pointer has left.
  await shell.mouse.move(0, 0);
  const show = tree(shell).getByRole('button', {
    name: 'Show Wrapped heading',
  });
  await expect(show).toHaveCSS('opacity', '1');

  expect(readFileSync(page, 'utf8')).toBe(before);

  await show.click();
  await expect(heading).toBeVisible();
});

test('a hide clears on navigation inside the app', async ({
  shell,
  truing,
}) => {
  await openLayers(shell, truing.session.shellOrigin);
  const app = frame(shell, 'Desktop');
  const heading = app.getByText('Wrapped heading');
  await tree(shell)
    .getByRole('button', { name: 'Hide Wrapped heading' })
    .click();
  await expect(heading).toBeHidden();

  // A query is enough: the same route, another page of it.
  await app
    .locator('body')
    .evaluate(() =>
      history.pushState(null, '', `${location.pathname}?tab=other`),
    );
  await app.locator('body').evaluate((body) => body.classList.add('moved'));
  await expect(heading).toBeVisible();
  await expect(
    tree(shell).getByRole('button', { name: 'Hide Wrapped heading' }),
  ).toBeAttached();
});

test('a pick falls through what is locked, the tree can still select it, and the lock survives a reload', async ({
  shell,
  truing,
}) => {
  await openLayers(shell, truing.session.shellOrigin);
  const heading = frame(shell, 'Desktop').getByRole('heading', {
    name: 'Wrapped heading',
  });

  await tree(shell)
    .getByRole('button', { name: 'Lock Wrapped heading' })
    .click();
  await heading.click();
  // The wrappers around it look the same, so the pick lands on <main>'s row.
  await expect(current(shell)).toContainText('Frame');

  await tree(shell)
    .getByRole('button', { name: 'Wrapped heading', exact: true })
    .click();
  await expect(current(shell)).toContainText('Wrapped heading');

  await shell.reload();
  const unlock = tree(shell).getByRole('button', {
    name: 'Unlock Wrapped heading',
  });
  await expect(unlock).toBeVisible();
  await modeButton(shell, 'Select').click();
  await heading.click();
  await expect(current(shell)).toContainText('Frame');
  await unlock.click();
});

test('Show and unlock all layers clears both', async ({ shell, truing }) => {
  await openLayers(shell, truing.session.shellOrigin);
  await tree(shell)
    .getByRole('button', { name: 'Hide Wrapped heading' })
    .click();
  await tree(shell).getByRole('button', { name: 'Lock Grid item' }).click();

  await tree(shell)
    .getByRole('button', { name: 'Read more', exact: true })
    .click({ button: 'right' });
  await shell
    .getByRole('menuitem', { name: 'Show and unlock all layers' })
    .click();

  await expect(
    frame(shell, 'Desktop').getByText('Wrapped heading'),
  ).toBeVisible();
  await expect(
    tree(shell).getByRole('button', { name: 'Lock Grid item', exact: true }),
  ).toBeAttached();
});
