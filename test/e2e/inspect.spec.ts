// Select and inspect (TRU-2.1), through Truing itself on the fixture app's
// /inspect route: a Server Component, a client component, a cva primitive,
// an asChild Button, a mapped list and a Radix Dialog.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { fixtureAppDir, frameStatus } from './fixtures';
import {
  at,
  design,
  editorLog,
  expect,
  frame,
  layers,
  modeButton,
  packageRoot,
  pickedText,
  test,
} from './inspect-fixture';

const BUTTON = 'components/ui/button.tsx';
const CLIENT_PANEL = 'app/inspect/client-panel.tsx';
const SERVER_CARD = 'app/inspect/server-card.tsx';
const PAGE = 'app/inspect/page.tsx';

test('hovering outlines an element with its tag and component, and the outline is never picked', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app.getByRole('button', { name: 'Pressed 0 times' }).hover();

  const overlay = app.locator('truing-overlay');
  await expect(overlay.getByText('button · Button')).toBeVisible();

  // The label sits over the page, but a click there reaches the app's element.
  const hit = await overlay.getByText('button · Button').evaluate((label) => {
    const box = label.getBoundingClientRect();
    const under = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return under?.closest('truing-overlay') ? 'overlay' : 'app';
  });
  expect(hit).toBe('app');

  // An asChild Button's label names the Button, as the inspector does, not
  // Radix's Slot between them.
  await app.getByRole('link', { name: 'Read the details' }).hover();
  await expect(overlay.getByText('a · Button')).toBeVisible();
});

test('a cva primitive shows its variant, its call site, its definition and its classes as tokens', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app.getByRole('button', { name: 'Pressed 0 times' }).click();

  const inspector = design(shell);
  await expect(inspector).toContainText('<button>');
  await expect(inspector).toContainText(
    'Button · variant tonal · size default not set',
  );
  await expect(inspector).toContainText(
    `Call site${at(CLIENT_PANEL, '<Button variant="tonal" onClick')}`,
  );
  await expect(inspector).toContainText(`Definition${at(BUTTON, '<Comp')}`);
  await expect(inspector).toContainText(
    'bg-brand-1-500 → color-brand-1-500 · #3d82f2',
  );
  await expect(inspector).toContainText(
    'padding-inlinepx-400 → spacing-400 · 12px',
  );
  // A colour shows as a square of itself; a length doesn't. The square is
  // decorative (the hex beside it is read), so it has no role to find it by.
  const styleRow = (className: string) =>
    inspector.getByRole('listitem').filter({ hasText: `${className} →` });
  const swatch = styleRow('bg-brand-1-500').locator('.inspect-swatch');
  await expect(swatch).toHaveCount(1);
  await expect(swatch).toHaveCSS(
    'background-image',
    /^linear-gradient\(rgb\(61, 130, 242\), rgb\(61, 130, 242\)\)/,
  );
  await expect(styleRow('px-400').locator('.inspect-swatch')).toHaveCount(0);
  // The pick never reached the app.
  await expect(
    app.getByRole('button', { name: 'Pressed 0 times' }),
  ).toBeVisible();

  // The owners above the call site start collapsed.
  const owners = inspector.getByText('Owners · 1');
  await expect(owners).toBeVisible();
  const owner = inspector.getByText('ClientPanel', { exact: true });
  await expect(owner).toBeHidden();
  await owners.click();
  await expect(owner).toBeVisible();
});

test('JSX written in a route file says why it has no call site', async ({
  shell,
}) => {
  await frame(shell, 'Desktop')
    .getByRole('heading', { name: 'Inspect fixture' })
    .click();

  const inspector = design(shell);
  await expect(inspector).toContainText('<h1>');
  await expect(inspector).toContainText(
    'Call siteWritten in a route file. Next renders it, so it has no call site.',
  );
  await expect(inspector).toContainText(`Definition${at(PAGE, '<h1>')}`);
});

test('an asChild Button resolves to the Button that wraps the link', async ({
  shell,
}) => {
  await frame(shell, 'Desktop')
    .getByRole('link', { name: 'Read the details' })
    .click();

  const inspector = design(shell);
  await expect(inspector).toContainText('<a>');
  await expect(inspector).toContainText('Button · variant default not set');
  await expect(inspector).toContainText(
    `Call site${at(CLIENT_PANEL, '<Button asChild>')}`,
  );
  await expect(inspector).toContainText(`Definition${at(BUTTON, '<Comp')}`);
  await expect(inspector).toContainText(
    'bg-primary → color-primary → primary → color-brand-1-600 · #1c68d4',
  );
});

test('a Server Component shows its component, both locations and a read-only snapshot of its props', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app.getByRole('button', { name: 'Server button' }).click();

  const inspector = design(shell);
  await expect(inspector).toContainText(
    'Button · variant default not set · size sm',
  );
  await expect(inspector).toContainText('Server Component');
  await expect(inspector).toContainText(
    `Call site${at(SERVER_CARD, '<Button size="sm">')}`,
  );
  await expect(inspector).toContainText(`Definition${at(BUTTON, '<Comp')}`);
  await expect(inspector).toContainText('Props as the server sent them.');
  await expect(inspector).toContainText('px-100 → spacing-100 · 4px');

  // Server HTML that isn't a primitive: the component is the Server Component.
  await app.getByRole('heading', { name: 'Server heading' }).click();
  await expect(inspector).toContainText('<h2>');
  await expect(inspector).toContainText(`Call site${at(PAGE, '<ServerCard')}`);
  await expect(inspector).toContainText(`Definition${at(SERVER_CARD, '<h2')}`);
  await expect(inspector).toContainText('text-title-m → text-title-m · 16px');
});

test('a row of a mapped list shows the JSX that maps it and the component around it', async ({
  shell,
}) => {
  await frame(shell, 'Desktop').getByText('Beta').click();

  const inspector = design(shell);
  await expect(inspector).toContainText('<li>');
  await expect(inspector).toContainText('ClientPanel');
  await expect(inspector).toContainText(`Call site${at(PAGE, '<ClientPanel')}`);
  await expect(inspector).toContainText(
    `Definition${at(CLIENT_PANEL, '<li key')}`,
  );
  await expect(inspector).toContainText('px-100 → spacing-100 · 4px');
});

test('a pick in the frame shows in the layers tree, and a row of the tree picks in the frame', async ({
  shell,
}) => {
  await frame(shell, 'Desktop').getByText('Beta').click();
  const tree = layers(shell);
  // The tree opens down to the pick and marks its row, named by its text (TRU-2.3).
  await expect(tree.locator('[aria-current="true"]')).toHaveText('Beta');

  await tree
    .getByRole('button', { name: 'ServerCard Server', exact: true })
    .click();
  const inspector = design(shell);
  await expect(inspector).toContainText('<section>');
  await expect(inspector).toContainText(
    `Definition${at(SERVER_CARD, '<section')}`,
  );
  await expect(tree.locator('[aria-current="true"]')).toHaveText('<section>');
});

test('the call site opens in the editor or copies as path:line, and Esc clears the pick', async ({
  shell,
  truing,
}) => {
  await truing.context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: truing.session.shellOrigin,
  });
  await frame(shell, 'Desktop').getByText('Beta').click();
  const where = at(PAGE, '<ClientPanel');
  const inspector = design(shell);

  await inspector.getByRole('button', { name: `Copy ${where}` }).click();
  await expect(
    inspector.getByRole('status').filter({ hasText: 'Copied' }),
  ).toBeVisible();
  expect(await shell.evaluate(() => navigator.clipboard.readText())).toBe(
    where,
  );

  await inspector
    .getByRole('button', { name: `Open ${where} in your editor` })
    .click();
  await expect
    .poll(() => {
      try {
        return readFileSync(editorLog, 'utf8');
      } catch {
        return '';
      }
    })
    .toContain(path.join(packageRoot, 'test/fixture-app', PAGE));

  await shell.keyboard.press('Escape');
  await expect(inspector).toContainText(
    'Press V, then pick an element in a frame to see its design.',
  );
});

test('picking inside an open Dialog reads it without the app seeing the click, and Esc leaves it open', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await modeButton(shell, 'Interact').click();
  await app.getByRole('button', { name: 'Open the dialog' }).click();
  await expect(
    app.getByRole('dialog', { name: 'Fixture dialog' }),
  ).toBeVisible();

  await modeButton(shell, 'Select').click();
  await app.getByRole('button', { name: 'Inside the dialog' }).click();
  const inspector = design(shell);
  await expect(inspector).toContainText('Button · variant tonal · size sm');
  await expect(inspector).toContainText(
    `Call site${at(CLIENT_PANEL, '<Button variant="tonal" size="sm"')}`,
  );

  await shell.keyboard.press('Escape');
  await expect(inspector).toContainText('Press V, then pick an element');
  // Neither the pick nor Esc reached the app: the dialog is still open, and
  // the press wasn't counted (the counter is behind the modal, so by text).
  await expect(
    app.getByRole('dialog', { name: 'Fixture dialog' }),
  ).toBeVisible();
  await expect(app.getByText('Pressed 0 times')).toHaveCount(1);
});

test('picking inside an open Popover and Select reads them without choosing anything', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  const inspector = design(shell);
  const select = modeButton(shell, 'Select');
  const interact = modeButton(shell, 'Interact');

  await interact.click();
  await app.getByRole('button', { name: 'Open the popover' }).click();
  const popover = app.getByRole('dialog', { name: 'Fixture popover' });
  await expect(popover).toBeVisible();
  await select.click();
  await app.getByRole('button', { name: 'Inside the popover' }).click();
  await expect(inspector).toContainText(
    `Call site${at(CLIENT_PANEL, '<Button size="sm" onClick={press}>')}`,
  );
  await expect(popover).toBeVisible();
  await expect(app.getByText('Pressed 0 times')).toHaveCount(1);

  // Back in Interact, the app gets Escape again and closes its popover.
  await interact.click();
  await app.getByRole('button', { name: 'Inside the popover' }).press('Escape');
  await expect(popover).toBeHidden();
  await app.getByRole('combobox', { name: 'Fixture select' }).click();
  await expect(app.getByRole('option', { name: 'Two' })).toBeVisible();
  // V from inside the frame: a click on Truing's bar would take focus
  // away, and Radix closes a Select when its window loses focus.
  await app.getByRole('option', { name: 'One' }).press('v');
  await expect(select).toHaveAttribute('aria-pressed', 'true');
  await app.getByRole('option', { name: 'Two' }).click();

  // A Radix part written in our JSX (the option's text): the call site is
  // ours, and its own element is drawn inside the package.
  await expect(inspector).toContainText('Select.ItemText');
  await expect(inspector).toContainText(
    `Call site${at(CLIENT_PANEL, '<Select.ItemText>Two')}`,
  );
  await expect(inspector).toContainText(
    "DefinitionDrawn inside a package, so its code isn't in this project.",
  );
  // Nothing was chosen, and the list is still open.
  await expect(app.getByRole('option', { name: 'Two' })).toBeVisible();
  // Radix marks the chosen option with data-state (aria-selected follows focus).
  await expect(app.getByRole('option', { name: 'One' })).toHaveAttribute(
    'data-state',
    'checked',
  );
  await expect(app.getByRole('option', { name: 'Two' })).toHaveAttribute(
    'data-state',
    'unchecked',
  );
});

test('the pick stays on the same row after a hot reload remounts it and moves its line, and after the frame reloads', async ({
  shell,
}) => {
  const file = path.join(fixtureAppDir, CLIENT_PANEL);
  const original = readFileSync(file, 'utf8');
  await frame(shell, 'Desktop').getByText('Beta').click();
  const inspector = design(shell);
  await expect(inspector).toContainText('<li>');
  await expect.poll(() => pickedText(shell)).toBe('Beta');

  try {
    // Two lines above the list move the row's JSX down, and a new key makes
    // React replace every row's node.
    writeFileSync(
      file,
      original
        .replace(
          '<ul aria-label="Items">',
          '{/* moved */}\n      {/* down */}\n      <ul aria-label="Items">',
        )
        .replace('<li key={item}', '<li key={`${item}-edited`}')
        .replace('className="px-100"', 'className="px-100 rounded-xl"'),
    );
    await expect(inspector).toContainText('rounded-xl → radius-xl · 12px');
    await expect(inspector).toContainText(
      `Definition${at(CLIENT_PANEL, '<li key')}`,
    );
    await expect.poll(() => pickedText(shell)).toBe('Beta');
  } finally {
    writeFileSync(file, original);
  }
  await expect(inspector).not.toContainText('rounded-xl');
  await expect(inspector).toContainText(
    `Definition${at(CLIENT_PANEL, '<li key')}`,
  );

  await shell.getByRole('button', { name: 'Reload' }).click();
  await expect(frameStatus(shell, 'Desktop', '/inspect')).toBeVisible();
  await expect(inspector).toContainText('<li>');
  await expect.poll(() => pickedText(shell)).toBe('Beta');
});

test('switching to Interact clears the pick and the hover in the frame', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  const inspector = design(shell);
  await app.getByRole('button', { name: 'Pressed 0 times' }).click();
  await expect(inspector).toContainText('<button>');
  await app.getByRole('heading', { name: 'Inspect fixture' }).hover();

  await modeButton(shell, 'Interact').click();

  // The overlay's first two boxes are the hover and the pick (overlay.ts).
  const shown = () =>
    app
      .locator('truing-overlay')
      .evaluate(
        (host) =>
          [...(host.shadowRoot?.children ?? [])]
            .slice(0, 2)
            .filter(
              (box) =>
                box instanceof HTMLElement && box.style.display !== 'none',
            ).length,
      );
  await expect.poll(shown).toBe(0);
  await expect(inspector).toContainText('Press V, then pick an element');
});
