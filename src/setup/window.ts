// The window the setup screens live in, and the browser everything runs in.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { chromium } from 'playwright';

import type { AppHandle } from '../app-process';
import { buildSetup } from '../build';
import type { TruingConfig } from '../config';

import { type SetupEntry, type SetupResult, startSetupServer } from './server';

const require = createRequire(import.meta.url);

/**
 * Whether a browser finished installing. Playwright writes this marker last, so
 * a download that failed part way has the program but not the marker.
 */
export function browserIsComplete(executable: string): boolean {
  if (!existsSync(executable)) return false;
  let dir = path.dirname(executable);
  while (!path.basename(dir).startsWith('chromium')) {
    const parent = path.dirname(dir);
    if (parent === dir) return true;
    dir = parent;
  }
  return existsSync(path.join(dir, 'INSTALLATION_COMPLETE'));
}

export function browserIsReady(): boolean {
  return browserIsComplete(chromium.executablePath());
}

/** The browser downloads once, on the first run, with its own progress bar. */
export async function ensureChromium(): Promise<void> {
  if (browserIsReady()) return;
  console.log('[truing] getting its own browser, once. This takes a minute.');
  const cli = path.join(
    path.dirname(require.resolve('playwright/package.json')),
    'cli.js',
  );
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'install', 'chromium'], {
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `Getting the browser stopped with code ${code}. Check your connection and run truing again: it picks up from there.`,
            ),
          ),
    );
  });
}

export type Opened = {
  root: string;
  config: TruingConfig;
  app?: AppHandle;
  /** Closes the setup window, once Truing's own window is up. */
  close: (() => Promise<void>) | null;
} | null;

/**
 * Runs the setup screens until a project is running. Null if the person closed
 * the window first. A window of its own, app-style, not a browser tab.
 */
export async function runSetupWindow(
  options: { from: string } & SetupEntry,
): Promise<Opened> {
  const server = await startSetupServer({
    ...options,
    assets: await buildSetup(),
  });

  const profile = path.join(os.homedir(), '.cache', 'truing', '_setup');
  mkdirSync(profile, { recursive: true });
  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: null,
    colorScheme: null,
    args: [`--app=${server.url}`, '--window-size=1120,820'],
  });

  const closed = new Promise<null>((resolve) =>
    context.once('close', () => resolve(null)),
  );
  const result: SetupResult | null = await Promise.race([
    server.result,
    closed,
  ]);

  if (!result) {
    await server.close();
    return null;
  }
  return {
    root: result.root,
    config: result.config,
    app: result.app,
    close: async () => {
      await context.close().catch(() => {});
      await server.close();
    },
  };
}
