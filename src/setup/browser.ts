// The browser everything runs in: whether it's here, and getting it once.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { chromium } from 'playwright';

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
