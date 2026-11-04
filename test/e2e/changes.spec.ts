// The Changes tray (TRU-4.1) through Truing itself on the fixture app: a
// change previews at once without touching the source, Undo and Discard
// drop it, and Apply writes it, the page hot-reloads and the same element
// is picked again.
import { readFileSync } from 'node:fs';
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
  restoreSource,
  startHeadless,
  waitForHydration,
} from './fixtures';
import { modeButton } from './inspect-fixture';

const PAGE = path.join(fixtureAppDir, 'app/changes/page.tsx');
const original = readFileSync(PAGE, 'utf8');

const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...fixtureConfig,
        app: { ...fixtureConfig.app, startRoute: '/changes' },
        server: { port: 4115 },
        modules: ['selection', 'changes'],
      });
      await provide(truing);
      await truing.close();
    },
    { scope: 'worker', timeout: 240_000 },
  ],
  shell: async ({ truing }, provide) => {
    await restoreSource(truing, PAGE, original, '/changes');
    const { shell } = truing;
    await shell.goto(`${truing.session.shellOrigin}/?route=/changes`);
    await expect(frameStatus(shell, 'Desktop', '/changes')).toBeVisible();
    await waitForHydration(shell, 'Desktop');
    await modeButton(shell, 'Select').click();
    await provide(shell);
    // Leave the tray empty and the fixture as it was for the next test.
    // Through the server: the tray's button can vanish between seeing it and
    // clicking it, and a teardown stuck there leaves the source edited.
    truing.modules.changes.discard();
    await restoreSource(truing, PAGE, original, '/changes');
  },
});

/** Picks an element and waits until the inspector has read where it is written. */
async function pick(
  shell: Page,
  target: ReturnType<ReturnType<typeof frame>['getByText']>,
  place: string,
) {
  await target.click();
  await expect(inspector(shell)).toContainText(place);
}

const tray = (shell: Page) => shell.getByRole('region', { name: 'Changes' });
const inspector = (shell: Page) =>
  shell.getByRole('region', { name: 'Selection' });

/** The CSS the preview put in the frame's adopted stylesheets. */
function previewCss(shell: Page): Promise<string> {
  return frame(shell, 'Desktop')
    .locator('body')
    .evaluate(() =>
      document.adoptedStyleSheets
        .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
        .join('\n'),
    );
}

test('a text edit previews at once, is staged Direct, and Undo puts it back; the source is untouched', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await pick(
    shell,
    app.getByText('Refine the real interface.'),
    'changes/page.tsx:9',
  );
  const text = inspector(shell).getByRole('textbox', { name: 'Text' });
  await text.fill('Refine the interface you ship.');
  await text.press('Enter');

  await expect(app.getByText('Refine the interface you ship.')).toBeVisible();
  const row = tray(shell).getByRole('listitem');
  await expect(row).toContainText(
    'Text: “Refine the real interfa…” → “Refine the interface yo…”',
  );
  await expect(row).toContainText('Direct');
  await expect(row).toContainText('Desktop · 1440 px');
  await expect(row).toContainText('test/fixture-app/app/changes/page.tsx');
  expect(readFileSync(PAGE, 'utf8')).toBe(original);

  await row.getByRole('button', { name: /^Undo Text/ }).click();
  await expect(app.getByText('Refine the real interface.')).toBeVisible();
  await expect(tray(shell)).toContainText('Changes you make show here.');
});

test('a variant switch previews through an override stylesheet, and Discard drops everything', async ({
  shell,
}) => {
  await pick(
    shell,
    frame(shell, 'Desktop').getByRole('button', { name: 'Send the design' }),
    'changes/page.tsx:10',
  );
  await inspector(shell)
    .getByRole('button', { name: /^variant / })
    .click();
  await shell.getByRole('menuitemradio', { name: 'default' }).click();

  await expect(tray(shell).getByRole('listitem')).toContainText(
    'Button variant: tonal → default',
  );
  // The button's new variant classes, aimed at the button, unlayered.
  await expect.poll(() => previewCss(shell)).toMatch(/:is\([^)]*button[^)]*\)/);
  await expect.poll(() => previewCss(shell)).toContain('background-color');
  expect(readFileSync(PAGE, 'utf8')).toBe(original);

  await tray(shell).getByRole('button', { name: 'Discard' }).click();
  await expect(tray(shell)).toContainText('Changes you make show here.');
  await expect.poll(() => previewCss(shell)).not.toContain(':is(');
});

test('Apply writes the change, the page reloads with it, and the same element is picked again', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await pick(
    shell,
    app.getByRole('button', { name: 'Send the design' }),
    'changes/page.tsx:10',
  );
  await inspector(shell)
    .getByRole('button', { name: /^variant / })
    .click();
  await shell.getByRole('menuitemradio', { name: 'default' }).click();
  await pick(
    shell,
    app.getByText('Refine the real interface.'),
    'changes/page.tsx:9',
  );
  const text = inspector(shell).getByRole('textbox', { name: 'Text' });
  await text.fill('Refine it.');
  await text.press('Enter');
  await expect(tray(shell).getByRole('listitem')).toHaveCount(2);

  await tray(shell).getByRole('button', { name: 'Apply' }).click();
  await expect(shell.getByText('Applied 2 changes.')).toBeVisible();
  await expect(tray(shell)).toContainText('Changes you make show here.');

  const written = readFileSync(PAGE, 'utf8');
  expect(written).toBe(
    original
      .replace('Refine the real interface.', 'Refine it.')
      .replace('<Button variant="tonal">', '<Button variant="default">'),
  );

  // Next hot-reloads the page; the paragraph comes back picked.
  await expect(app.getByText('Refine it.')).toBeVisible();
  await expect(
    inspector(shell).getByRole('textbox', { name: 'Text' }),
  ).toHaveValue('Refine it.');
  await expect(inspector(shell)).toContainText('<p>');
  await expect(inspector(shell)).toContainText('changes/page.tsx:9');
  // The Button renders its new variant from the source now, not the preview.
  await expect(
    app.getByRole('button', { name: 'Send the design' }),
  ).toHaveClass(/bg-primary text-background/);
  await expect.poll(() => previewCss(shell)).not.toContain(':is(');
});

test('a double-click edits text in place; Enter stages it, and the page keeps React its own text node', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  const paragraph = app.getByText('Refine the real interface.');
  await pick(shell, paragraph, 'changes/page.tsx:9');
  await paragraph.dblclick();
  await expect(app.locator('[contenteditable]')).toHaveText(
    'Refine the real interface.',
  );
  // Everything is selected: typing replaces it.
  await shell.keyboard.type('Ship what you see.');
  await shell.keyboard.press('Enter');

  await expect(tray(shell).getByRole('listitem')).toContainText(
    'Text: “Refine the real interfa…” → “Ship what you see.”',
  );
  await expect(tray(shell).getByRole('listitem')).toContainText('Direct');
  await expect(app.locator('[contenteditable]')).toHaveCount(0);
  await expect(app.getByText('Ship what you see.')).toBeVisible();
  expect(readFileSync(PAGE, 'utf8')).toBe(original);

  // Edited again in place, it still writes over the code's own text.
  await app.getByText('Ship what you see.').dblclick();
  await shell.keyboard.type('Ship it.');
  await shell.keyboard.press('Enter');
  await expect(tray(shell).getByRole('listitem')).toHaveCount(1);
  await expect(tray(shell).getByRole('listitem')).toContainText(
    'Text: “Refine the real interfa…” → “Ship it.”',
  );
  await tray(shell).getByRole('button', { name: 'Apply' }).click();
  await expect(tray(shell)).toContainText('Changes you make show here.');
  // The hot reload updated React's own node: the pick reads the new text back,
  // and the old text never returns once the preview is gone.
  await expect(
    inspector(shell).getByRole('textbox', { name: 'Text' }),
  ).toHaveValue('Ship it.');
  await expect(app.getByText('Ship it.')).toBeVisible();
  await expect(app.getByText('Refine the real interface.')).toHaveCount(0);
  expect(readFileSync(PAGE, 'utf8')).toBe(
    original.replace('Refine the real interface.', 'Ship it.'),
  );
});

test('Esc while editing in place drops the typed text and stages nothing', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  const paragraph = app.getByText('Refine the real interface.');
  await pick(shell, paragraph, 'changes/page.tsx:9');
  await paragraph.dblclick();
  await shell.keyboard.type('Something else');
  await shell.keyboard.press('Escape');

  await expect(app.getByText('Refine the real interface.')).toBeVisible();
  await expect(app.locator('[contenteditable]')).toHaveCount(0);
  await expect(tray(shell)).toContainText('Changes you make show here.');
  // Esc went to the edit, not to the pick.
  await expect(inspector(shell)).toContainText('<p>');
});
