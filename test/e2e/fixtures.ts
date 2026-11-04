import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  expect,
  type FrameLocator,
  type Page,
  test as base,
} from '@playwright/test';

import type { TruingConfig } from '../../src/config';
import { type Truing, startTruing } from '../../src/truing';

export const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
export const fixtureAppDir = path.join(packageRoot, 'test/fixture-app');

/** A plain Next app with nothing of ours in it, on its own ports. */
export const fixtureConfig: TruingConfig = {
  name: 'fixture',
  app: {
    // Webpack here; real-app.spec.ts covers Turbopack on the same fixture.
    devCommand: 'pnpm exec next dev --webpack -p 3110 test/fixture-app',
    port: 3110,
    startRoute: '/',
    dir: 'test/fixture-app',
  },
  server: { port: 4110 },
  primitives: 'test/fixture-app/components/ui/',
  source: 'test/fixture-app',
  tokens: 'test/fixtures/tokens/tokens.css',
  writable: { include: ['test/fixture-app/app/**'], exclude: [] },
  branch: { pattern: 'design/{feature}' },
  modules: ['selection'],
};

export async function startHeadless(
  root: string,
  config: TruingConfig,
): Promise<Truing> {
  const truing = await startTruing({
    root,
    config,
    headless: true,
    profileDir: mkdtempSync(path.join(os.tmpdir(), 'truing-e2e-')),
    log: () => {},
  });
  // The tray's rows stay open above its summary (TRU-3.10): the specs read them.
  await truing.shell.addInitScript(() =>
    localStorage.setItem('truing:changes-open', 'open'),
  );
  // A cold dev server compiles a route on its first request, which on a large app
  // takes longer than a test should wait. That compile is part of starting.
  await fetch(
    `${truing.session.appOrigin}${config.app.startRoute ?? '/'}`,
  ).then((response) => response.text());
  return truing;
}

type WorkerFixtures = { truing: Truing };
type TestFixtures = { shell: Page };

function truingTest(start: () => Promise<Truing>, route = '/') {
  return base.extend<TestFixtures, WorkerFixtures>({
    truing: [
      async ({}, provide) => {
        const truing = await start();
        await provide(truing);
        await truing.close();
      },
      // The dev server's first compile is part of starting.
      { scope: 'worker', timeout: 240_000 },
    ],
    // Every test starts from a fresh shell: one Desktop frame on /, in Interact.
    shell: async ({ truing }, provide) => {
      const shell = truing.shell;
      await shell.goto(`${truing.session.shellOrigin}/?route=${route}`);
      await shell.getByRole('button', { name: 'Interact' }).click();
      await expect(frameStatus(shell, 'Desktop')).toBeVisible();
      await provide(shell);
    },
  });
}

/** Truing on the fixture app. */
export const test = truingTest(() => startHeadless(packageRoot, fixtureConfig));

/** Truing on the fixture's /real-app page, on Turbopack. */
export const realAppTest = truingTest(
  () =>
    startHeadless(packageRoot, {
      ...fixtureConfig,
      app: {
        ...fixtureConfig.app,
        devCommand: 'pnpm exec next dev -p 3105 test/fixture-app',
        port: 3105,
        startRoute: '/real-app',
      },
      server: { port: 4111 },
      modules: ['selection', 'changes'],
      tokens: 'test/fixtures/design-system/src/app/globals.css',
    }),
  '/real-app',
);

/**
 * Puts a fixture's source back, only if it changed, and waits for the dev server to
 * rebuild it. A rewrite makes it rebuild, which can reload a frame under a test's click.
 */
export async function restoreSource(
  truing: Truing,
  file: string,
  text: string,
  route: string,
): Promise<void> {
  if (readFileSync(file, 'utf8') === text) return;
  writeFileSync(file, text);
  await fetch(`${truing.session.appOrigin}${route}`).then((response) =>
    response.text(),
  );
}

/** A frame connects before React reaches its page, which is what a test's pick needs. */
export async function waitForHydration(
  shell: Page,
  label: string,
): Promise<void> {
  await expect
    .poll(() =>
      frame(shell, label)
        .locator('body')
        .evaluate((body) =>
          Object.keys(body).some((key) => key.startsWith('__reactFiber')),
        ),
    )
    .toBe(true);
}

export { expect };

/** A frame's content, by the iframe's accessible name ("Desktop view of the app"). */
export function frame(shell: Page, label: string): FrameLocator {
  return shell.getByTitle(`${label} view of the app`).contentFrame();
}

/** The status under a frame's label: where it is, and whether its runtime said hello. */
export function frameStatus(
  shell: Page,
  label: string,
  route: string | RegExp = /.*/,
) {
  const at =
    typeof route === 'string'
      ? route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : route.source;
  return shell.getByRole('status', {
    name: new RegExp(`^${label} frame at ${at}, connected$`),
  });
}

/** The Playwright Frame for a Truing frame, for evaluating inside the app. */
export function appFrame(shell: Page, id: string) {
  const found = shell
    .frames()
    .find((candidate) => candidate.name() === `truing-frame:${id}`);
  if (!found) {
    throw new Error(`No truing frame named ${id}.`);
  }
  return found;
}

/**
 * The fixture page is interactive: React has hydrated it (its counter is
 * enabled) and Next's dev client, HMR included, is running. A runtime hello
 * comes earlier, at document start.
 */
export async function fixtureReady(
  shell: Page,
  label = 'Desktop',
): Promise<void> {
  await expect(
    frame(shell, label).getByRole('button', { name: /^Clicked/ }),
  ).toBeEnabled();
}

export async function chooseViewport(shell: Page, name: RegExp): Promise<void> {
  await shell.getByRole('button', { name: 'Viewport' }).click();
  await shell.getByRole('button', { name }).first().click();
}
