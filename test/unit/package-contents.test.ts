// TRU-7.3: what `npx truing-cli` downloads. It runs from a person's machine, so it holds
// what it needs and nothing else: no fixtures, no backlog, no secrets, and every
// package its code imports is one npm will install.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { tooOldFor } from '../../src/node-version.mjs';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const manifest = z
  .object({
    version: z.string(),
    dependencies: z.record(z.string(), z.string()),
    engines: z.object({ node: z.string() }),
  })
  .parse(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')));

function packedFiles(): string[] {
  const output = execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const [packed] = z
    .array(z.object({ files: z.array(z.object({ path: z.string() })) }))
    .parse(JSON.parse(output));
  return (packed?.files ?? []).map((file) => file.path);
}

describe('the package', () => {
  const files = packedFiles();

  it.each([
    'bin/truing.mjs',
    'src/cli.ts',
    'src/shell/index.html',
    'src/setup/ui/index.tsx',
    'src/modules/settings/module.ts',
    'src/claude/path-guard.mjs',
    'src/claude/plugin/skills/design-rules/SKILL.md',
    'LICENSE',
    'README.md',
    'THIRD_PARTY_NOTICES.md',
  ])('holds %s', (file) => {
    expect(files).toContain(file);
  });

  it('holds nothing from the repository’s own working files', () => {
    const allowedDocs = ['docs/modules.md'];
    const unwanted = files.filter(
      (file) =>
        /^(test|backlog|scripts|tools|refs|\.[a-z]+)\//.test(file) ||
        (file.startsWith('docs/') && !allowedDocs.includes(file)),
    );
    expect(unwanted).toEqual([]);
  });

  it('holds no tests, and no file that could hold a secret', () => {
    const secret = /(^|\/)(\.env|\.npmrc|id_rsa|id_ed25519)|\.(pem|key|p12)$/;
    expect(files.filter((file) => secret.test(file))).toEqual([]);
    expect(files.filter((file) => /\.(test|spec)\./.test(file))).toEqual([]);
  });

  it('stays small', () => {
    const bytes = files.reduce(
      (total, file) => total + statSync(path.join(root, file)).size,
      0,
    );
    expect(bytes).toBeLessThan(3_000_000);
  });

  it('installs every package the code imports', () => {
    // A real import, not text that reads like one: at a line's start, or after it opens.
    const bare =
      /^\s*(?:import\b[^'"\n]*?|export\b[^'"\n]*?from\s*|\}\s*from\s*)['"]([^.'"][^'"]*)['"]|\bimport\(\s*['"]([^.'"][^'"]*)['"]\s*\)/gm;
    const needed = new Set<string>();
    for (const file of files) {
      if (!/\.(ts|tsx|mjs)$/.test(file)) continue;
      if (file.endsWith('.d.ts') || file.startsWith('examples/')) continue;
      const text = readFileSync(path.join(root, file), 'utf8');
      for (const [, fromStatement, fromCall] of text.matchAll(bare)) {
        const specifier = fromStatement ?? fromCall ?? '';
        if (specifier.startsWith('node:')) continue;
        if (specifier.startsWith('truing:')) continue;
        const parts = specifier.split('/');
        const name = specifier.startsWith('@')
          ? parts.slice(0, 2).join('/')
          : (parts[0] ?? '');
        if (builtinModules.includes(name)) continue;
        needed.add(name);
      }
    }
    const missing = [...needed].filter(
      (name) => !(name in manifest.dependencies),
    );
    expect(missing).toEqual([]);
  });

  it('pins what it installs, so a release is what was tested', () => {
    const loose = Object.entries(manifest.dependencies).filter(
      ([, version]) => !/^\d/.test(version),
    );
    expect(loose).toEqual([]);
  });

  it('won’t publish unless the gate and the changelog pass', () => {
    const { scripts } = z
      .object({ scripts: z.record(z.string(), z.string()) })
      .parse(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')));
    expect(scripts.prepublishOnly).toContain('make check');
    expect(scripts.prepublishOnly).toContain('check-release');
  });

  it('needs no install step of its own', () => {
    const { scripts } = z
      .object({ scripts: z.record(z.string(), z.string()) })
      .parse(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')));
    for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
      expect(scripts[hook]).toBeUndefined();
    }
  });
});

describe('an old Node', () => {
  it.each([
    ['18.20.4', true],
    ['20.0.0', true],
    ['20.18.3', true],
    ['20.19.0', false],
    ['22.1.0', false],
    ['24.22.1', false],
  ])('%s', (version, tooOld) => {
    expect(tooOldFor(version) !== null).toBe(tooOld);
  });

  it('says what it found, and what to do', () => {
    expect(tooOldFor('18.20.4')).toBe(
      'Truing needs Node.js 20.19 or newer, and this is 18.20.4. Update Node.js and run it again.',
    );
  });

  it('asks for the same version as the package does', () => {
    expect(manifest.engines.node).toBe('>=20.19');
  });
});

describe('a folder of its own', () => {
  it('starts from a folder with no package.json and leaves nothing behind', () => {
    const folder = path.join(root, 'node_modules/.cache/truing-empty-folder');
    execFileSync('mkdir', ['-p', folder]);
    const before = readdirSync(folder);
    const help = execFileSync(
      process.execPath,
      [path.join(root, 'bin/truing.mjs'), '--help'],
      {
        cwd: folder,
        encoding: 'utf8',
        env: { ...process.env, INIT_CWD: folder },
      },
    );
    expect(help).toContain('Usage');
    expect(readdirSync(folder)).toEqual(before);
  });
});
