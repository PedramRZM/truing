// The right-click panel (TRU-2.4), through Truing itself on the fixture app's
// /inspect route: the pick's header, the groups, Select the parent, the
// components from the pick up, and Select layer, which lists what is drawn
// under the pointer and can pick the fixture's covering picture.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { frameStatus } from './fixtures';
import {
  at,
  design,
  editorLog,
  expect,
  frame,
  modeButton,
  packageRoot,
  pickedText,
  test,
} from './inspect-fixture';

const PAGE = 'app/inspect/page.tsx';

const menu = (shell: Page) => shell.getByRole('menu', { name: 'Element' });
const list = (shell: Page, name: string) =>
  shell.getByRole('menu', { name, exact: true });
// Visible only: while a new pick loads, React keeps the last one in the DOM, hidden.
const pickedTag = (shell: Page) =>
  design(shell).locator('.inspect-title code').filter({ visible: true });

/** Where the overlay's hover outline is drawn in the frame, or null while it is hidden. */
function hoverBox(shell: Page) {
  return frame(shell, 'Desktop')
    .locator('truing-overlay')
    .evaluate((host) => {
      // The overlay's boxes, in order: hover, picked, then the rest (overlay.ts).
      const hover = host.shadowRoot?.children[0];
      if (!(hover instanceof HTMLElement) || hover.style.display === 'none') {
        return null;
      }
      const box = hover.getBoundingClientRect();
      return [box.left, box.top, box.width, box.height].map(Math.round);
    });
}

test('the header names the pick and its call site, which opens in the editor; the rows sit in groups with their keys', async ({
  shell,
}) => {
  await frame(shell, 'Desktop').getByText('Beta').click({ button: 'right' });
  const header = menu(shell).getByRole('group', {
    name: 'ClientPanel · <li>',
  });
  const where = at(PAGE, '<ClientPanel');
  await expect(header).toContainText(where);

  // Open, Copy, Select, then Layers: four groups, three lines between them and one under the header.
  await expect(menu(shell).getByRole('separator')).toHaveCount(4);
  await expect(menu(shell).getByRole('menuitem')).toHaveText([
    where,
    /^Open call site/,
    /^Open definition/,
    /^Copy path/,
    'Copy classes',
    'Copy selector',
    /^Select the parent/,
    'Select component',
    'Select layer',
    'Show and unlock all layersAlt+Shift+L',
  ]);
  await expect(
    menu(shell).getByRole('menuitem', { name: 'Open definition' }),
  ).toContainText('Shift+O');
  await expect(
    menu(shell).getByRole('menuitem', { name: 'Select the parent' }),
  ).toContainText('Shift+Enter');

  await header
    .getByRole('menuitem', { name: `Open call site ${where} in your editor` })
    .click();
  await expect(menu(shell)).toBeHidden();
  await expect
    .poll(() => {
      try {
        return readFileSync(editorLog, 'utf8');
      } catch {
        return '';
      }
    })
    .toContain(path.join(packageRoot, 'test/fixture-app', PAGE));
});

test('JSX written in a route file says in the header why it has no call site', async ({
  shell,
}) => {
  await frame(shell, 'Desktop')
    .getByRole('heading', { name: 'Inspect fixture' })
    .click({ button: 'right' });
  await expect(menu(shell).getByRole('group', { name: '<h1>' })).toContainText(
    'Written in a route file. Next renders it, so it has no call site.',
  );
});

test('Select the parent picks the parent', async ({ shell }) => {
  await frame(shell, 'Desktop').getByText('Beta').click({ button: 'right' });
  await menu(shell)
    .getByRole('menuitem', { name: 'Select the parent' })
    .click();
  await expect(menu(shell)).toBeHidden();
  await expect(pickedTag(shell)).toHaveText('<ul>');
});

test('Select component lists the components from the pick up; hovering one outlines it, choosing it picks it', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app
    .getByRole('button', { name: 'Pressed 0 times' })
    .click({ button: 'right' });
  await expect(
    menu(shell).getByRole('group', { name: 'Button · <button>' }),
  ).toBeVisible();
  await menu(shell).getByRole('menuitem', { name: 'Select component' }).hover();
  const components = list(shell, 'Select component');
  await expect(components.getByRole('menuitem')).toHaveText([
    'Button',
    'ClientPanel',
  ]);

  // In the frame's own pixels, as the overlay draws it.
  const box = await app
    .getByRole('region', { name: 'Client panel' })
    .evaluate((section) => {
      const rect = section.getBoundingClientRect();
      return [rect.left, rect.top, rect.width, rect.height].map(Math.round);
    });
  await components.getByRole('menuitem', { name: 'ClientPanel' }).hover();
  await expect.poll(() => hoverBox(shell)).toEqual(box);

  await components.getByRole('menuitem', { name: 'ClientPanel' }).click();
  await expect(menu(shell)).toBeHidden();
  await expect(pickedTag(shell)).toHaveText('<section>');
  await expect(design(shell)).toContainText('ClientPanel');
});

test('Select layer lists what is drawn under the pointer, top first with the pick marked, and picks the covering picture', async ({
  shell,
}) => {
  // The picture covers the text; the right-click picks the text, as it is seen.
  await frame(shell, 'Desktop')
    .getByText('Under the background')
    .click({ button: 'right', force: true });
  await expect(pickedTag(shell)).toHaveText('<p>');

  await menu(shell).getByRole('menuitem', { name: 'Select layer' }).click();
  const stack = list(shell, 'Select layer');
  const items = stack.getByRole('menuitemradio');
  await expect(items.first()).toHaveText('<img>Extras');
  await expect(items.first()).not.toBeChecked();
  await expect(items.nth(1)).toHaveText('Under the backgroundExtras');
  await expect(items.nth(1)).toBeChecked();
  await expect(items.last()).toHaveText('<body>');

  await items.first().click();
  await expect(menu(shell)).toBeHidden();
  await expect(pickedTag(shell)).toHaveText('<img>');
});

test('↑ and ↓ move through the rows, → opens a list, ← goes back to its row, Esc closes the menu', async ({
  shell,
}) => {
  await frame(shell, 'Desktop').getByText('Beta').click({ button: 'right' });
  const rows = menu(shell);
  // It opens with focus on itself; ↓ goes to the first row, the call site, and ↑ wraps to the last.
  await expect(rows).toBeFocused();
  await expect(
    rows.getByRole('group', { name: 'ClientPanel · <li>' }),
  ).toBeVisible();
  await shell.keyboard.press('ArrowDown');
  await expect(
    rows.getByRole('menuitem', { name: /^Open call site .+ in your editor$/ }),
  ).toBeFocused();
  await shell.keyboard.press('ArrowUp');
  const selectLayer = rows.getByRole('menuitem', { name: 'Select layer' });
  await expect(selectLayer).toBeFocused();
  await shell.keyboard.press('ArrowUp');
  await expect(
    rows.getByRole('menuitem', { name: 'Select component' }),
  ).toBeFocused();
  await shell.keyboard.press('ArrowDown');
  await expect(selectLayer).toBeFocused();

  await shell.keyboard.press('ArrowRight');
  const stack = list(shell, 'Select layer');
  // Focus goes to the checked item, the pick, at the top of what lies under the pointer.
  const beta = stack.getByRole('menuitemradio', { name: 'Beta' });
  await expect(beta).toBeFocused();
  await expect(beta).toBeChecked();
  await expect(selectLayer).toHaveAttribute('aria-expanded', 'true');
  await shell.keyboard.press('ArrowDown');
  await expect(
    stack.getByRole('menuitemradio', { name: '<ul>' }),
  ).toBeFocused();

  await shell.keyboard.press('ArrowLeft');
  await expect(stack).toBeHidden();
  await expect(selectLayer).toBeFocused();
  // Enter on a row isn't the shell's Enter (select the first child): it opens the list.
  await shell.keyboard.press('Enter');
  await expect(beta).toBeFocused();
  await expect.poll(() => pickedText(shell)).toBe('Beta');

  // Esc closes the list first, then the menu; the pick stays.
  await shell.keyboard.press('Escape');
  await expect(stack).toBeHidden();
  await expect(rows).toBeVisible();
  await shell.keyboard.press('Escape');
  await expect(rows).toBeHidden();
  await expect(pickedTag(shell)).toHaveText('<li>');
});

test('near the window’s lower right corner the menu opens to the left of and above the pointer', async ({
  shell,
}) => {
  // The docks closed and the frame zoomed in, so it reaches the window's corner.
  await shell.keyboard.press('Control+Backslash');
  await shell.keyboard.press('Control+Shift+Backslash');
  const view = shell.viewportSize();
  if (!view) throw new Error('The shell has no viewport size.');
  const x = view.width - 16;
  const y = view.height - 16;
  const underCorner = (): Promise<string | undefined> =>
    shell.evaluate(
      ([px, py]) => document.elementFromPoint(px ?? 0, py ?? 0)?.tagName,
      [x, y],
    );
  // In as far as it takes: how far that is depends on the window.
  for (let step = 0; step < 8; step++) {
    if ((await underCorner()) === 'IFRAME') break;
    await shell.keyboard.press('Control+Equal');
    await shell.waitForTimeout(100);
  }
  await expect.poll(underCorner).toBe('IFRAME');
  await shell.mouse.click(x, y, { button: 'right' });

  await expect(menu(shell)).toBeVisible();
  const box = await menu(shell).boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.x + box.width).toBeLessThanOrEqual(x + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(y + 1);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);

  // The panels' state outlives a reload, and the next test expects them open.
  await shell.keyboard.press('Escape');
  await shell.keyboard.press('Control+Backslash');
  await shell.keyboard.press('Control+Shift+Backslash');
});

test('a right-click on another element never shows the last pick in the header, even for a moment', async ({
  shell,
}) => {
  // A slow report: the button's pick reaches the shell well after its menu opens.
  await shell.routeWebSocket(/\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      const slow =
        typeof message === 'string' &&
        message.includes('"module-report"') &&
        message.includes('"name":"selected"') &&
        message.includes('"tag":"button"');
      if (slow) setTimeout(() => ws.send(message), 1500);
      else ws.send(message);
    });
  });
  await shell.reload();
  await expect(frameStatus(shell, 'Desktop', '/inspect')).toBeVisible();
  await modeButton(shell, 'Select').click();

  const app = frame(shell, 'Desktop');
  await app.getByText('Beta').click();
  await expect(pickedTag(shell)).toHaveText('<li>');
  // Every header the menu shows, as it shows them.
  await shell.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { headersSeen: string[] }).headersSeen = seen;
    new MutationObserver(() => {
      for (const group of document.querySelectorAll(
        '[role="menu"] [role="group"][aria-label]',
      )) {
        seen.push(group.getAttribute('aria-label') ?? '');
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });

  await app
    .getByRole('button', { name: 'Pressed 0 times' })
    .click({ button: 'right' });
  await expect(
    menu(shell).getByRole('group', { name: 'Button · <button>' }),
  ).toBeVisible();
  const seen = await shell.evaluate(
    () => (window as unknown as { headersSeen: string[] }).headersSeen,
  );
  expect(new Set(seen)).toEqual(new Set(['Button · <button>']));
});

test('Space presses the focused row, and the canvas doesn’t take it for panning', async ({
  shell,
}) => {
  await frame(shell, 'Desktop').getByText('Beta').click({ button: 'right' });
  const parent = menu(shell).getByRole('menuitem', {
    name: 'Select the parent',
  });
  await expect(parent).toBeEnabled();
  await parent.focus();
  await shell.keyboard.press('Space');
  await expect(menu(shell)).toBeHidden();
  await expect(pickedTag(shell)).toHaveText('<ul>');
});

test('on its way to an open list the pointer may cross another row; resting on that row opens its list instead', async ({
  shell,
}) => {
  await frame(shell, 'Desktop')
    .getByRole('button', { name: 'Pressed 0 times' })
    .click({ button: 'right' });
  await expect(
    menu(shell).getByRole('group', { name: 'Button · <button>' }),
  ).toBeVisible();
  const selectComponent = menu(shell).getByRole('menuitem', {
    name: 'Select component',
  });
  const selectLayer = menu(shell).getByRole('menuitem', {
    name: 'Select layer',
  });
  await selectComponent.hover();
  const components = list(shell, 'Select component');
  const second = components.getByRole('menuitem', { name: 'ClientPanel' });
  await expect(second).toBeVisible();

  // Diagonally down to the list's second item: the way cuts the corner of
  // Select layer, the row below, just before it reaches the list.
  const from = await selectComponent.boundingBox();
  const to = await second.boundingBox();
  if (!from || !to) throw new Error('The rows have no boxes.');
  await shell.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await shell.mouse.move(to.x + 8, to.y + to.height / 2, { steps: 4 });
  await expect(second).toBeFocused();
  await expect(selectLayer).toHaveAttribute('aria-expanded', 'false');

  // Resting on a row is a choice: its list replaces the open one.
  await selectLayer.hover();
  await expect(list(shell, 'Select layer')).toBeVisible();
  await expect(components).toBeHidden();
});
