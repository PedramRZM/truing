// The module contract through Truing itself (TRU-1.6): the toy module's four
// parts appear when the config lists it and disappear when it doesn't, a
// broken module fails alone, and the selection module works in a frame.
import { WebSocket } from 'ws';

import type { ToShell } from '../../src/protocol';
import type { Truing } from '../../src/truing';
import { PANEL_ERROR } from '../modules/broken/panel';
import { PROBE_ERROR } from '../modules/broken/probe';

import {
  expect,
  fixtureConfig,
  fixtureReady,
  frame,
  frameStatus,
  packageRoot,
  startHeadless,
  test,
} from './fixtures';

const TOY = './examples/element-count';
const BROKEN = './test/modules/broken';
const THEME_TAB = './test/modules/theme-tab';

/** The fixture app, with its own truing port so it never meets the other specs' truing. */
function startWith(modules: string[]): Promise<Truing> {
  return startHeadless(packageRoot, {
    ...fixtureConfig,
    server: { port: 4112 },
    modules,
  });
}

/** A second shell connection, as a panel's calls go: over Truing's bus. */
async function shellBus(truing: Truing) {
  const url = new URL(truing.session.wsUrl);
  url.searchParams.set('role', 'shell');
  url.searchParams.set('token', truing.session.token);
  const socket = new WebSocket(url, {
    headers: { origin: truing.session.shellOrigin },
  });
  const messages: ToShell[] = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
  await new Promise((resolve) => socket.once('open', resolve));

  return {
    /** Calls a module's server op and returns its result message. */
    async call(module: string, op: string, input: unknown) {
      const id = Math.floor(Math.random() * 1e9);
      socket.send(
        JSON.stringify({ type: 'module-call', id, module, op, input }),
      );
      await expect
        .poll(() =>
          messages.some((m) => m.type === 'module-result' && m.id === id),
        )
        .toBe(true);
      return messages.find((m) => m.type === 'module-result' && m.id === id);
    },
    close: () => socket.close(),
  };
}

async function openShell(truing: Truing) {
  const { shell } = truing;
  await shell.goto(`${truing.session.shellOrigin}/?route=/`);
  await shell.getByRole('button', { name: 'Interact' }).click();
  await expect(frameStatus(shell, 'Desktop', '/')).toBeVisible();
  await fixtureReady(shell);
  return shell;
}

test.describe('with the toy module listed', () => {
  let truing: Truing;
  test.beforeAll(async () => {
    truing = await startWith(['selection', TOY, BROKEN]);
  });
  test.afterAll(async () => {
    await truing.close();
  });

  test('its probe, panel, server handler and Claude tool are all there', async () => {
    const shell = await openShell(truing);

    // Probe: the frame's runtime says it runs, and its count reaches the panel.
    expect(truing.modules.probesIn('main')).toContain('element-count');
    const panel = shell.getByRole('region', { name: 'Element count' });
    await expect(panel).toContainText(/Desktop\s*\d+ elements/);

    // Server handler: an op answers over the bus.
    const bus = await shellBus(truing);
    const result = await bus.call('element-count', 'counts', {});
    bus.close();
    expect(result).toMatchObject({ value: { main: expect.any(Number) } });
    expect(result).not.toHaveProperty('error');

    // Claude tool: listed, and answered by the frame's probe.
    expect(truing.modules.tools.list().map((tool) => tool.name)).toEqual([
      'count_elements',
    ]);
    const counted = await truing.modules.tools.call('count_elements', {
      selector: 'h1',
    });
    expect(counted).toEqual({
      content: [{ type: 'text', text: '{"main":1}' }],
    });
  });

  test('a module that throws in its probe and its panel shows as failed, and the others keep working', async () => {
    const shell = await openShell(truing);

    const broken = shell.getByRole('region', { name: 'Broken' });
    await expect(broken).toContainText('Stopped in the Desktop frame.');
    await expect(broken).toContainText(PROBE_ERROR);
    await expect(broken).toContainText('This section stopped.');
    await expect(broken).toContainText(PANEL_ERROR);
    // The Reload buttons carry the action, so the sentences don't repeat it.
    await expect(broken).not.toContainText('try again');
    expect(truing.modules.probesIn('main')).not.toContain('broken');

    await expect(
      shell.getByRole('region', { name: 'Element count' }),
    ).toContainText(/\d+ elements/);
    await expect(
      shell.getByRole('region', { name: 'Selection' }),
    ).toContainText('Press V, then pick an element');
  });

  test('a probe that stops the same way in every frame shows once, with a way to reload them', async () => {
    const shell = await openShell(truing);
    await shell.getByRole('button', { name: 'Side by side' }).click();
    for (const label of ['Phone', 'Tablet', 'Desktop']) {
      await expect(frameStatus(shell, label, '/')).toBeVisible();
    }

    const broken = shell.getByRole('region', { name: 'Broken' });
    await expect(broken).toContainText(
      'Stopped in the Phone, Tablet and Desktop frames.',
    );
    await expect(broken.getByText(PROBE_ERROR)).toHaveCount(1);

    // The frames reload, and the probe stops again in each of them.
    await broken.getByRole('button', { name: 'Reload frames' }).click();
    for (const label of ['Phone', 'Tablet', 'Desktop']) {
      await expect(frameStatus(shell, label, '/')).toBeVisible();
    }
    await expect(broken).toContainText(
      'Stopped in the Phone, Tablet and Desktop frames.',
    );
    await expect(
      broken.getByRole('button', { name: 'Reload truing' }),
    ).toBeVisible();
  });

  test('the selection module outlines and picks an element in Select mode', async () => {
    const shell = await openShell(truing);
    const selection = shell.getByRole('region', { name: 'Selection' });
    await shell.getByRole('button', { name: 'Select' }).click();

    const heading = frame(shell, 'Desktop').getByRole('heading', {
      name: 'Fixture home',
    });
    // Hovering alone draws the outline, outside the app's tree.
    const overlay = frame(shell, 'Desktop').locator('truing-overlay');
    await expect(overlay).toHaveCount(0);
    await heading.hover();
    await expect(overlay).toHaveCount(1);
    await heading.click();

    await expect(selection).toContainText(/Desktop\s*<h1>/);

    // A second pick replaces the first.
    await frame(shell, 'Desktop')
      .getByRole('link', { name: 'Other page' })
      .click();
    await expect(selection).toContainText(/Desktop\s*<a>/);
  });
});

test.describe('with the toy module removed from the config', () => {
  let truing: Truing;
  test.beforeAll(async () => {
    truing = await startWith(['selection']);
  });
  test.afterAll(async () => {
    await truing.close();
  });

  test('its probe, panel, server handler and Claude tool are all gone', async () => {
    const shell = await openShell(truing);

    expect(truing.modules.probesIn('main')).toEqual(['selection']);
    await expect(
      shell.getByRole('region', { name: 'Element count' }),
    ).toHaveCount(0);
    // Only the selection module's tree is left in the left panel (TRU-2.1).
    const layerSections = shell
      .getByRole('complementary', { name: 'Left panel' })
      .getByRole('region');
    await expect(layerSections).toHaveCount(1);
    await expect(layerSections).toHaveAccessibleName('Page');

    const bus = await shellBus(truing);
    const result = await bus.call('element-count', 'counts', {});
    bus.close();
    expect(result).toMatchObject({
      error: 'No module "element-count" is loaded.',
    });

    expect(truing.modules.tools.list()).toEqual([]);
    expect(await truing.modules.tools.call('count_elements', {})).toMatchObject(
      { isError: true },
    );
  });
});

test.describe('a module that asks for the Theme tab (TRU-3.4)', () => {
  let truing: Truing;

  test.beforeAll(async () => {
    truing = await startWith(['selection', THEME_TAB]);
  });

  test.afterAll(async () => {
    await truing.close();
  });

  test('its section shows in Theme, and the others stay in Design', async () => {
    const shell = await openShell(truing);
    const panel = shell.getByRole('complementary', { name: 'Left panel' });
    const section = panel.getByRole('region', { name: 'Theme fixture' });
    const page = panel.getByRole('region', { name: 'Page' });

    await expect(page).toBeVisible();
    await expect(section).toBeHidden();

    await panel.getByRole('tab', { name: 'Theme' }).click();
    await expect(section).toBeVisible();
    await expect(page).toBeHidden();
    await expect(panel).not.toContainText("The project's tokens will show");
  });
});
