// TRU-7.8: starting the CLI costs what the command uses. Importing all of Truing
// took `truing --help` 1.5s where tsx alone takes 0.1s, and tests that start the CLI
// missed their time limit on a busy machine. This walks imports rather than timing
// anything, so it can't be flaky itself.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

/** What a file loads as it's imported: files and packages, not `import()`s. */
async function loadedBy(entry: string): Promise<Set<string>> {
  const { metafile } = await esbuild.build({
    entryPoints: [entry],
    absWorkingDir: packageRoot,
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    metafile: true,
    packages: 'external',
    platform: 'node',
    write: false,
  });
  const loaded = new Set<string>();
  const visit = (file: string): void => {
    for (const { path: target, kind, external } of metafile.inputs[file]
      ?.imports ?? []) {
      if (kind !== 'import-statement' || loaded.has(target)) continue;
      loaded.add(target);
      if (!external) visit(target);
    }
  };
  visit(entry);
  return loaded;
}

describe('starting the CLI', () => {
  it('loads no command’s code before it knows which command it is', async () => {
    const loaded = await loadedBy('src/cli.ts');
    const tooEarly = [
      'playwright',
      'esbuild',
      'src/truing.ts',
      'src/setup/browser.ts',
      'src/setup/window.ts',
      'src/setup/connection.ts',
      'src/doctor.ts',
      'src/tokens/cli.ts',
      'src/modules/claude-config/ask-claude.ts',
      'src/modules/claude-config/setup.ts',
    ].filter((name) => loaded.has(name));
    expect(tooEarly).toEqual([]);
  });

  it('checks for the browser without loading the setup screens', async () => {
    const loaded = await loadedBy('src/setup/browser.ts');
    expect(loaded.has('playwright')).toBe(true);
    expect(loaded.has('esbuild')).toBe(false);
    expect(loaded.has('src/setup/server.ts')).toBe(false);
  });
});
