// The window the setup screens live in.
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { chromium } from 'playwright';

import type { AppHandle } from '../app-process';
import { buildSetup } from '../build';
import type { TruingConfig } from '../config';

import { type SetupEntry, type SetupResult, startSetupServer } from './server';

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
