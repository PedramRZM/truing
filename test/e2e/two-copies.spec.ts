// Two copies of Truing, on two projects, side by side (TRU-6.8). Neither is told a
// port: each asks the system for its own.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { findFreePort } from '../../src/app-process';
import { startTruing, type Truing } from '../../src/truing';

import { frameStatus, packageRoot } from './fixtures';

const SERVER = path.join(packageRoot, 'test/fixtures/fake-claude/server.mjs');

function project(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'two-copies-'));
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'package.json'), '{}\n');
  return root;
}

async function start(name: string, appPort: number): Promise<Truing> {
  return startTruing({
    root: project(),
    config: {
      name,
      app: { devCommand: `node ${SERVER} ${appPort}`, port: appPort },
      writable: { include: ['src/**'], exclude: [] },
      modules: [],
    },
    headless: true,
    profileDir: mkdtempSync(path.join(os.tmpdir(), 'truing-e2e-')),
    log: () => {},
  });
}

test('two copies run at once, each on a port of its own', async () => {
  const first = await findFreePort(3210);
  const second = await findFreePort(first + 1);
  const [a, b] = await Promise.all([
    start('first', first),
    start('second', second),
  ]);
  try {
    expect(a.session.shellOrigin).not.toBe(b.session.shellOrigin);
    await a.shell.goto(`${a.session.shellOrigin}/?route=/`);
    await b.shell.goto(`${b.session.shellOrigin}/?route=/`);
    await expect(frameStatus(a.shell, 'Desktop')).toBeVisible();
    await expect(frameStatus(b.shell, 'Desktop')).toBeVisible();
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
});
