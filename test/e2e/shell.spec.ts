import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  appFrame,
  chooseViewport,
  expect,
  fixtureAppDir,
  frame,
  frameStatus,
  test,
} from './fixtures';

test('the runtime says hello from the frame and keeps its token out of the page', async ({
  shell,
  truing,
}) => {
  await expect(frameStatus(shell, 'Desktop', '/')).toBeVisible();

  const leaks = await appFrame(shell, 'main').evaluate((token) => {
    const inMarkup = document.documentElement.outerHTML.includes(token);
    const onWindow = Object.getOwnPropertyNames(window).filter((key) => {
      try {
        return JSON.stringify(
          (window as unknown as Record<string, unknown>)[key],
        )?.includes(token);
      } catch {
        return false;
      }
    });
    return { inMarkup, onWindow };
  }, truing.session.token);
  expect(leaks).toEqual({ inMarkup: false, onWindow: [] });
});

for (const { preset, width, layout } of [
  { preset: /^Phone/, width: 390, layout: 'phone layout' },
  { preset: /^Tablet/, width: 768, layout: 'tablet layout' },
  { preset: /^Desktop/, width: 1440, layout: 'desktop layout' },
]) {
  test(`the ${preset.source.slice(1)} preset gives the app a ${width} px viewport, and its breakpoints respond`, async ({
    shell,
  }) => {
    await chooseViewport(shell, preset);
    await expect(frameStatus(shell, preset.source.slice(1), '/')).toBeVisible();

    const app = frame(shell, preset.source.slice(1));
    await expect(app.getByText(layout)).toBeVisible();
    expect(await appFrame(shell, 'main').evaluate(() => innerWidth)).toBe(
      width,
    );
  });
}

test('a custom width and height resize the frame', async ({ shell }) => {
  await shell.getByRole('button', { name: /^Viewport/ }).click();
  await shell.getByRole('spinbutton', { name: 'Width' }).fill('1000');
  await shell.getByRole('spinbutton', { name: 'Height' }).fill('700');
  await shell.getByRole('button', { name: 'Apply' }).click();

  await expect(frameStatus(shell, 'Custom', '/')).toBeVisible();
  await expect(frame(shell, 'Custom').getByText('tablet layout')).toBeVisible();
  expect(
    await appFrame(shell, 'main').evaluate(() => [innerWidth, innerHeight]),
  ).toEqual([1000, 700]);
});

test('typing a route navigates the frame, and navigating in the app updates the route box', async ({
  shell,
}) => {
  const routeBox = shell.getByRole('textbox', { name: 'Route' });
  await routeBox.fill('/other');
  await routeBox.press('Enter');
  await expect(
    frame(shell, 'Desktop').getByRole('heading', { name: 'Other page' }),
  ).toBeVisible();

  await frame(shell, 'Desktop').getByRole('link', { name: 'Home' }).click();
  await expect(
    frame(shell, 'Desktop').getByRole('heading', { name: 'Fixture home' }),
  ).toBeVisible();
  await expect(routeBox).toHaveValue('/');
});

test('side by side shows Phone, Tablet and Desktop, each scaled to fit and selectable', async ({
  shell,
}) => {
  await shell.getByRole('button', { name: 'Side by side' }).click();

  for (const [label, layout] of [
    ['Phone', 'phone layout'],
    ['Tablet', 'tablet layout'],
    ['Desktop', 'desktop layout'],
  ] as const) {
    await expect(frameStatus(shell, label, '/')).toBeVisible();
    await expect(frame(shell, label).getByText(layout)).toBeVisible();
    const box = await shell
      .getByTitle(`${label} view of the app`)
      .boundingBox();
    const window = shell.viewportSize();
    expect(
      box && window && box.x >= 0 && box.x + box.width <= window.width,
    ).toBe(true);
  }

  const phoneName = shell.getByRole('button', { name: 'Phone', exact: true });
  await phoneName.click();
  await expect(phoneName).toHaveAttribute('aria-pressed', 'true');
});

test('navigating in one frame of side by side moves the others to the same route', async ({
  shell,
}) => {
  await shell.getByRole('button', { name: 'Side by side' }).click();
  await expect(frameStatus(shell, 'Phone', '/')).toBeVisible();

  // Scaled to fit: Playwright's click check fails in a scaled frame, though a
  // person's click works (docs/learnings/2026-11-03-first-run-on-real-projects.md).
  // So the mouse goes where the link shows, which also makes this frame the leader.
  const iframe = await shell.getByTitle('Phone view of the app').boundingBox();
  if (!iframe) throw new Error('The Phone frame has no box.');
  const link = await frame(shell, 'Phone')
    .getByRole('link', { name: 'Other page' })
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        frameWidth: window.innerWidth,
      };
    });
  const scale = iframe.width / link.frameWidth;
  await shell.mouse.click(iframe.x + link.x * scale, iframe.y + link.y * scale);

  for (const label of ['Phone', 'Tablet', 'Desktop']) {
    await expect(
      frame(shell, label).getByRole('heading', { name: 'Other page' }),
    ).toBeVisible();
  }
  await expect(shell.getByRole('textbox', { name: 'Route' })).toHaveValue(
    '/other',
  );
});

test('in Select the app gets no clicks; in Interact it does; V and I work from inside the frame', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  const counter = app.getByRole('button', { name: /^Clicked/ });

  await counter.click();
  await expect(counter).toHaveText('Clicked 1 times');

  await app.locator('body').press('v');
  await expect(shell.getByRole('button', { name: 'Select' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await counter.click();
  await expect(counter).toHaveText('Clicked 1 times');

  await app.locator('body').press('i');
  await expect(shell.getByRole('button', { name: 'Interact' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await counter.click();
  await expect(counter).toHaveText('Clicked 2 times');
});

test('reload loads the frame again on the route it is on', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app.getByRole('link', { name: 'Other page' }).click();
  await expect(app.getByRole('heading', { name: 'Other page' })).toBeVisible();
  await appFrame(shell, 'main').evaluate(() => {
    (window as unknown as { beforeReload: boolean }).beforeReload = true;
  });

  await shell.getByRole('button', { name: 'Reload' }).click();

  await expect(frameStatus(shell, 'Desktop', '/other')).toBeVisible();
  await expect(app.getByRole('heading', { name: 'Other page' })).toBeVisible();
  expect(
    await appFrame(shell, 'main').evaluate(
      () =>
        (window as unknown as { beforeReload?: boolean }).beforeReload ?? false,
    ),
  ).toBe(false);
});

test("the dev server's compile error shows in the frame", async ({ shell }) => {
  const file = path.join(fixtureAppDir, 'app/hmr-marker.tsx');
  const original = readFileSync(file, 'utf8');
  try {
    writeFileSync(file, original.replace('return <span', 'return <span <'));
    await expect(
      frame(shell, 'Desktop')
        .getByText(/Build Error|Failed to compile/)
        .first(),
    ).toBeVisible();
  } finally {
    writeFileSync(file, original);
  }
  await expect(frame(shell, 'Desktop').getByLabel('hmr marker')).toHaveText(
    'hmr-v0',
  );
});

test('zoom keys pressed inside a frame zoom the canvas, not the window', async ({
  shell,
}) => {
  const zoom = shell.getByRole('button', { name: 'Zoom to 100%' });
  await shell.getByRole('button', { name: 'Zoom to 100%' }).click();
  await expect(zoom).toHaveText('100%');

  await frame(shell, 'Desktop').locator('body').press('Control+Minus');
  await expect(zoom).toHaveText('90%');
  await frame(shell, 'Desktop').locator('body').press('Control+Equal');
  await expect(zoom).toHaveText('100%');
  expect(await shell.evaluate(() => window.visualViewport?.scale)).toBe(1);
});

test('dragging a frame edge resizes the app inside it, and the opposite edge stays put', async ({
  shell,
}) => {
  await chooseViewport(shell, /^Desktop/);
  // A handle, not a locator: the frame's title follows its size, so it changes mid-drag.
  const card = await shell
    .getByTitle('Desktop view of the app')
    .elementHandle();
  const before = await card?.boundingBox();
  // Grips are hidden from assistive tech (the Custom size fields are their
  // keyboard alternative), so they have no accessible name to find them by.
  const grip = shell.locator('.frame-handle[data-grip="w"]').first();
  const box = await grip.boundingBox();
  if (!before || !box) throw new Error('No frame or grip on screen.');

  await shell.mouse.move(box.x + box.width / 2, box.y + 60);
  await shell.mouse.down();
  await shell.mouse.move(box.x + box.width / 2 + 100, box.y + 60, { steps: 5 });
  await shell.mouse.up();

  const after = await card?.boundingBox();
  expect(Math.round((after?.x ?? 0) + (after?.width ?? 0))).toBe(
    Math.round(before.x + before.width),
  );
  const width = await appFrame(shell, 'main').evaluate(() => innerWidth);
  expect(width).toBeLessThan(1440);
});

test('the left panel switches between Design and Theme by click, key and restart', async ({
  shell,
}) => {
  const panel = shell.getByRole('complementary', { name: 'Left panel' });
  const design = panel.getByRole('tab', { name: 'Design' });
  const theme = panel.getByRole('tab', { name: 'Theme' });
  await expect(panel.getByRole('heading', { name: 'fixture' })).toBeVisible();
  await expect(design).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByRole('region', { name: 'Page' })).toBeVisible();

  await theme.click();
  await expect(theme).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByRole('tabpanel')).toContainText(
    "The project's tokens will show here.",
  );
  await expect(panel.getByRole('region', { name: 'Page' })).toBeHidden();

  await shell.keyboard.press('Alt+1');
  await expect(design).toHaveAttribute('aria-selected', 'true');
  await shell.keyboard.press('Alt+2');
  await expect(theme).toHaveAttribute('aria-selected', 'true');

  await theme.focus();
  await shell.keyboard.press('ArrowLeft');
  await expect(design).toBeFocused();
  await expect(design).toHaveAttribute('aria-selected', 'true');

  // The right panel has no title of its own, only its top row and toggle.
  const right = shell.getByRole('complementary', { name: 'Right panel' });
  await expect(
    right.getByRole('button', { name: 'Close right panel' }),
  ).toBeVisible();

  // Survives a reload; left as it started for the tests that follow.
  await theme.click();
  await shell.reload();
  await expect(theme).toHaveAttribute('aria-selected', 'true');
  await design.click();
});

test('the rail switches tools beside the left panel, and floats once the panel closes', async ({
  shell,
}) => {
  const rail = shell.getByRole('toolbar', { name: 'Truing' });
  const select = rail.getByRole('button', { name: 'Select', exact: true });
  const hand = rail.getByRole('button', { name: 'Hand' });

  await select.click();
  await expect(select).toHaveAttribute('aria-pressed', 'true');
  await hand.click();
  await expect(hand).toHaveAttribute('aria-pressed', 'true');
  await expect(select).toHaveAttribute('aria-pressed', 'false');
  await select.click();
  await expect(hand).toHaveAttribute('aria-pressed', 'false');
  await expect(select).toHaveAttribute('aria-pressed', 'true');

  const size = shell.viewportSize();
  if (!size) throw new Error('The page has no size.');
  expect(await rail.boundingBox()).toEqual({
    x: 240,
    y: 0,
    width: 42,
    height: size.height,
  });
  const canvas = shell.getByRole('main', { name: 'Canvas' });
  expect((await canvas.boundingBox())?.x).toBe(282);

  await shell.getByRole('button', { name: 'Close left panel' }).click();
  await expect.poll(async () => (await canvas.boundingBox())?.x).toBe(0);
  const floating = await rail.boundingBox();
  if (!floating) throw new Error('The rail is gone.');
  expect(floating.x).toBe(20);
  expect(floating.y + floating.height / 2).toBeCloseTo(size.height / 2, 0);

  await shell.keyboard.press('Period');
  await expect(rail).toBeHidden();
  await expect(shell.getByRole('banner')).toBeHidden();
  await shell.keyboard.press('Period');
  await shell.getByRole('button', { name: 'Open left panel' }).click();
});

test('Spacing is off in Interact, by button and by key', async ({ shell }) => {
  const rail = shell.getByRole('toolbar', { name: 'Truing' });
  const spacing = rail.getByRole('button', { name: 'Spacing' });

  await rail.getByRole('button', { name: 'Interact' }).click();
  await expect(spacing).toBeDisabled();
  await shell.keyboard.press('s');
  await rail.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(spacing).toBeEnabled();
  await expect(spacing).toHaveAttribute('aria-pressed', 'false');
  await rail.getByRole('button', { name: 'Interact' }).click();
});

test('Esc leaves Fill for the view it replaced, whichever mode and wherever the focus', async ({
  shell,
}) => {
  const rail = shell.getByRole('toolbar', { name: 'Truing' });
  const viewport = shell.getByRole('button', { name: /^Viewport/ });

  await chooseViewport(shell, /^Tablet/);
  const zoom = shell.getByRole('button', { name: 'Zoom to 100%' });
  await zoom.click();
  await chooseViewport(shell, /^Fill/);
  await expect(viewport).toHaveText(/^Fill/);
  await shell.keyboard.press('Escape');
  await expect(viewport).toHaveText(/^Tablet/);
  await expect(zoom).toHaveText('100%');

  // Focus in the frame, in Interact.
  await chooseViewport(shell, /^Fill/);
  await frame(shell, 'Fill').locator('body').click();
  await frame(shell, 'Fill').locator('body').press('Escape');
  await expect(viewport).toHaveText(/^Tablet/);

  // In Select with nothing picked, too.
  await rail.getByRole('button', { name: 'Select', exact: true }).click();
  await chooseViewport(shell, /^Fill/);
  await shell.keyboard.press('Escape');
  await expect(viewport).toHaveText(/^Tablet/);

  await rail.getByRole('button', { name: 'Interact' }).click();
  await chooseViewport(shell, /^Desktop/);
});
