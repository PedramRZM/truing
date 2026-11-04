import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { findMarker } from '../../scripts/check-build.mjs';
import { buildRuntime, buildShell } from '../../src/build';
import { TRUING_MARKER } from '../../src/marker.mjs';

const session = {
  token: 'f'.repeat(64),
  wsUrl: 'ws://localhost:4100/ws',
  appOrigin: 'http://localhost:3000',
  shellOrigin: 'http://localhost:4100',
};

describe('the marker the CI check looks for', () => {
  it('is in the runtime bundle and the shell bundle', async () => {
    // Otherwise the check would pass by searching for the wrong thing.
    expect(await buildRuntime(session, [])).toContain(TRUING_MARKER);
    const shell = await buildShell([]);
    expect(shell.js).toContain(TRUING_MARKER);
  });

  it('keeps the token out of window and markup: it is only in the closure', async () => {
    const runtime = await buildRuntime(session, []);
    expect(runtime).toContain(session.token);
    expect(runtime).not.toMatch(/window\.__TRUING_SESSION__/);
    expect(runtime).not.toMatch(/setAttribute\([^)]*token/);
  });
});

describe('findMarker', () => {
  function buildDir(): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'ds-check-'));
    mkdirSync(path.join(dir, '.next', 'static'), { recursive: true });
    mkdirSync(path.join(dir, '.next', 'cache'), { recursive: true });
    writeFileSync(path.join(dir, '.next', 'static', 'app.js'), 'clean');
    return dir;
  }

  it('finds nothing in a clean build, and skips .next/cache', () => {
    const dir = buildDir();
    writeFileSync(path.join(dir, '.next', 'cache', 'old.js'), TRUING_MARKER);
    expect(findMarker(path.join(dir, '.next')).hits).toEqual([]);
  });

  it('finds the marker in a shipped file', () => {
    const dir = buildDir();
    const planted = path.join(dir, '.next', 'static', 'chunk.js');
    writeFileSync(planted, `/* ${TRUING_MARKER} */`);
    expect(findMarker(path.join(dir, '.next')).hits).toEqual([planted]);
  });
});
