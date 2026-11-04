// TRU-1.3's app checks (spike/t212/e2e/app-checks.mjs), ported to run through the
// Truing's shell: the app in a frame on the shell's origin, the runtime
// injected by Truing's browser, nothing of Truing in the app.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  appFrame,
  expect,
  fixtureAppDir,
  frame,
  fixtureReady,
  frameStatus,
  test,
} from './fixtures';

const MARKER_FILE = path.join(fixtureAppDir, 'app/hmr-marker.tsx');
const IDLE_MS = 60_000;

test('HMR updates the frame, and still does after 60 s idle', async ({
  shell,
}) => {
  // The 60 s idle is the check itself (TRU-1.3: HMR after idle), on top of the usual budget.
  test.setTimeout(IDLE_MS + 120_000);
  await fixtureReady(shell);
  const marker = frame(shell, 'Desktop').getByLabel('hmr marker');
  const original = readFileSync(MARKER_FILE, 'utf8');

  try {
    writeFileSync(MARKER_FILE, original.replace('hmr-v0', 'hmr-v1'));
    await expect(marker).toHaveText('hmr-v1');

    // Idle on purpose: an HMR socket that drops after a minute fails here.
    await new Promise((resolve) => setTimeout(resolve, IDLE_MS));

    writeFileSync(MARKER_FILE, original.replace('hmr-v0', 'hmr-v2'));
    await expect(marker).toHaveText('hmr-v2');
  } finally {
    writeFileSync(MARKER_FILE, original);
  }
  await expect(marker).toHaveText('hmr-v0');
});

test('<Link> navigation is a soft navigation inside the frame', async ({
  shell,
}) => {
  // Before hydration a link click is a full load, which this test must not pass on.
  await fixtureReady(shell);
  await appFrame(shell, 'main').evaluate(() => {
    (window as unknown as { beforeNavigation: boolean }).beforeNavigation =
      true;
  });

  await frame(shell, 'Desktop')
    .getByRole('link', { name: 'Other page' })
    .click();

  await expect(
    frame(shell, 'Desktop').getByRole('heading', { name: 'Other page' }),
  ).toBeVisible();
  expect(
    await appFrame(shell, 'main').evaluate(
      () =>
        (window as unknown as { beforeNavigation?: boolean })
          .beforeNavigation ?? false,
    ),
  ).toBe(true);
});

test('a Server Action runs from the frame', async ({ shell }) => {
  await fixtureReady(shell);
  const app = frame(shell, 'Desktop');
  await app.getByRole('button', { name: 'Run Server Action' }).click();
  await expect(app.getByLabel('server action result')).toHaveText('ok');
});

test('a streamed page arrives in parts', async ({ shell }) => {
  const routeBox = shell.getByRole('textbox', { name: 'Route' });
  await routeBox.fill('/stream');
  await routeBox.press('Enter');

  const app = frame(shell, 'Desktop');
  // The fallback is on screen while the streamed part is not: the page was not buffered.
  await expect(app.getByLabel('stream fallback')).toBeVisible();
  await expect(app.getByLabel('streamed part')).toHaveCount(0);
  await expect(app.getByLabel('streamed part')).toBeVisible();
  await expect(frameStatus(shell, 'Desktop', '/stream')).toBeVisible();
});
