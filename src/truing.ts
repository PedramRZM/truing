import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { type BrowserContext, chromium, type Page } from 'playwright';

import { type AppHandle, ensureApp, isAppUp, systemPort } from './app-process';
import { showAwayPagesInWindows } from './away-window';
import { boardFile, loadBoard, saveBoard } from './board';
import { buildRuntime, buildShell, watchShell } from './build';
import { writeFramingExtension } from './frame-headers';
import type { TruingConfig } from './config';
import { createModuleHost, type ModuleHost } from './module-host';
import { type LoadedModule, loadModules } from './module-loader';
import type { Session } from './protocol';
import { createScreenshots } from './screenshots';
import {
  type ShellAssets,
  type TruingServer,
  startTruingServer,
} from './server';

export type StartOptions = {
  root: string;
  config: TruingConfig;
  /** Scripts run without a window. */
  headless?: boolean;
  /** Rebuild and reload the shell when its source changes. */
  watch?: boolean;
  /** Browser profile folder; a persistent one by default so a sign-in survives. */
  profileDir?: string;
  /** The app, when setup has already started it. */
  app?: AppHandle;
  log?: (line: string) => void;
};

export type Truing = {
  session: Session;
  context: BrowserContext;
  shell: Page;
  app: AppHandle;
  server: TruingServer;
  /** The listed modules' server side: their ops, tools and change set. */
  modules: ModuleHost;
  /** Resolves once Truing's window is closed. */
  closed: Promise<void>;
  close: () => Promise<void>;
};

export function defaultProfileDir(config: TruingConfig): string {
  return path.join(os.homedir(), '.cache', 'truing', config.name);
}

/**
 * A port from the system, and the same one again while it's free: panels, zoom
 * and open sections are kept per origin, so a new port each time would forget them.
 */
async function shellPort(profileDir: string): Promise<number> {
  const file = path.join(profileDir, 'shell-port');
  const last = existsSync(file)
    ? Number.parseInt(readFileSync(file, 'utf8'), 10)
    : Number.NaN;
  const port =
    Number.isInteger(last) && !(await isAppUp(`http://localhost:${last}`))
      ? last
      : await systemPort();
  mkdirSync(profileDir, { recursive: true });
  writeFileSync(file, `${port}\n`);
  return port;
}

/**
 * Chromium remembers a page zoom per host. Truing's canvas owns zoom, so
 * any window zoom saved in Truing's own profile is dropped before launch.
 */
export function clearSavedPageZoom(profileDir: string): void {
  const file = path.join(profileDir, 'Default', 'Preferences');
  if (!existsSync(file)) {
    return;
  }

  try {
    const prefs: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (
      typeof prefs !== 'object' ||
      prefs === null ||
      !('partition' in prefs)
    ) {
      return;
    }
    const { partition } = prefs;
    if (typeof partition !== 'object' || partition === null) {
      return;
    }
    if (
      !('per_host_zoom_levels' in partition) &&
      !('default_zoom_level' in partition)
    ) {
      return;
    }
    const {
      per_host_zoom_levels: _hosts,
      default_zoom_level: _default,
      ...rest
    } = partition as Record<string, unknown>;
    writeFileSync(file, JSON.stringify({ ...prefs, partition: rest }));
  } catch {
    // An unreadable Preferences file is Chromium's to repair; Truing still starts.
  }
}

export async function startTruing(options: StartOptions): Promise<Truing> {
  const { root } = options;
  const log = options.log ?? ((line) => console.log(line));

  // A module that doesn't load stops Truing before anything starts.
  const modules = await loadModules(root, options.config);

  const app =
    options.app ??
    (await ensureApp({
      root,
      command: options.config.app.devCommand,
      port: options.config.app.port,
      ...(options.config.app.dir
        ? { appDir: path.resolve(root, options.config.app.dir) }
        : {}),
      log,
    }));
  // From here on, the port the app really answers on is the one that counts.
  const config: TruingConfig = {
    ...options.config,
    app: { ...options.config.app, port: app.port },
  };

  // Anything that fails after the app started must not leave it running.
  try {
    const truingPort =
      config.server?.port ??
      (await shellPort(options.profileDir ?? defaultProfileDir(config)));
    // localhost, not 127.0.0.1: the same site as the app on localhost, so the
    // app's SameSite=Lax session cookie is still sent inside the frame.
    const shellOrigin = `http://localhost:${truingPort}`;
    const session: Session = {
      token: randomBytes(32).toString('hex'),
      wsUrl: `ws://localhost:${truingPort}/ws`,
      appOrigin: app.origin,
      shellOrigin,
    };
    return await attach(
      { ...options, config },
      session,
      truingPort,
      app,
      modules,
      log,
    );
  } catch (error) {
    if (app.startedByTruing) {
      await app.stop();
    }
    throw error;
  }
}

async function attach(
  options: StartOptions,
  session: Session,
  truingPort: number,
  app: AppHandle,
  modules: readonly LoadedModule[],
  log: (line: string) => void,
): Promise<Truing> {
  const { config } = options;
  const shellOrigin = session.shellOrigin;

  const host = createModuleHost({
    modules,
    root: options.root,
    config,
    log,
  });
  await host.start();
  if (modules.length > 0) {
    log(`[truing] modules: ${host.ids.join(', ')}`);
  }

  const board = boardFile(options.root);
  let assets: ShellAssets;
  let stopWatch: () => Promise<void> = async () => {};
  let server: TruingServer | null = null;
  if (options.watch) {
    const watcher = await watchShell(modules, (next) => {
      assets = next;
      server?.reloadShells();
      log('[truing] shell rebuilt; reloading it');
    });
    assets = watcher.assets;
    stopWatch = watcher.stop;
  } else {
    assets = await buildShell(modules);
  }

  server = await startTruingServer({
    session,
    port: truingPort,
    projectName: config.name,
    hasTokens: Boolean(config.tokens),
    startRoute: config.app.startRoute ?? '/',
    assets: () => assets,
    modules: host,
    board: {
      load: () => loadBoard(board),
      save: (next) => saveBoard(board, next),
    },
  });
  log(`[truing] shell at ${shellOrigin}`);

  const profileDir = options.profileDir ?? defaultProfileDir(config);
  mkdirSync(profileDir, { recursive: true });
  clearSavedPageZoom(profileDir);
  const framing = writeFramingExtension(session.appOrigin);
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: options.headless ?? false,
    viewport: options.headless ? { width: 2200, height: 1200 } : null,
    // Playwright emulates light by default; the shell follows the system.
    colorScheme: null,
    // The full browser even without a window: only it loads extensions.
    channel: 'chromium',
    args: [
      ...(options.headless ? [] : ['--start-maximized']),
      `--disable-extensions-except=${framing}`,
      `--load-extension=${framing}`,
    ],
    // Playwright keeps every page at full speed for its tests. A person's
    // window behind others should cost what any browser's does.
    ...(options.headless
      ? {}
      : {
          ignoreDefaultArgs: [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        }),
  });
  await context.addInitScript({
    content: await buildRuntime(session, modules),
  });

  const shell = context.pages()[0] ?? (await context.newPage());
  host.connectBrowser(createScreenshots(shell));
  await shell.goto(shellOrigin);

  const truingServer = server;
  showAwayPagesInWindows({
    shell,
    appOrigin: session.appOrigin,
    toShells: truingServer.toShells,
    log,
  });
  let closing: Promise<void> | null = null;
  const close = (): Promise<void> => {
    closing ??= (async () => {
      await context.close().catch(() => {});
      await rm(framing, { recursive: true, force: true });
      await truingServer.close();
      await stopWatch();
      if (app.startedByTruing) {
        log('[truing] stopping the app it started');
        await app.stop();
      }
    })();
    return closing;
  };
  const closed = new Promise<void>((resolve) =>
    context.once('close', () => resolve()),
  );

  return {
    session,
    context,
    shell,
    app,
    server: truingServer,
    modules: host,
    closed,
    close,
  };
}
