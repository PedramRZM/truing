// Truing imports nothing from the app (ADR 0001): no `@/` alias, and no
// relative path that leaves this package. This test is the guard.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const SCANNED = ['src', 'scripts', 'test'];
// edit-project and usages-project stand in for an app, so they
// import as one does.
const SKIPPED = new Set([
  'node_modules',
  'edit-project',
  'usages-project',
  'design-system',
  '.next',
]);
const SOURCE = /\.(ts|tsx|mts|mjs|js|cjs)$/;
/** `from '…'`, `import '…'`, `import('…')` and `require('…')`. */
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

/** The import specifiers in a file's text that reach outside the package. */
export function forbiddenImports(file: string, text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(SPECIFIER)) {
    const specifier = match[1] ?? '';
    if (specifier.startsWith('@/')) {
      found.push(specifier);
      continue;
    }
    if (!specifier.startsWith('.')) {
      continue;
    }
    const target = path.resolve(path.dirname(file), specifier);
    if (path.relative(packageRoot, target).startsWith('..')) {
      found.push(specifier);
    }
  }
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return SOURCE.test(entry.name) ? [full] : [];
  });
}

describe('import guard', () => {
  it('finds no import from the app in the package', () => {
    // This file is skipped: it holds deliberate bad imports as test data.
    const self = fileURLToPath(import.meta.url);
    const files = SCANNED.flatMap((dir) =>
      sourceFiles(path.join(packageRoot, dir)),
    ).filter((file) => file !== self);
    expect(files.length).toBeGreaterThan(10);

    const offenders = files.flatMap((file) =>
      forbiddenImports(file, readFileSync(file, 'utf8')).map(
        (specifier) => `${path.relative(packageRoot, file)}: ${specifier}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('catches an @/ import and a relative path into the app', () => {
    const file = path.join(packageRoot, 'src/shell/example.tsx');
    const text = [
      "import { Button } from '@/src/components/ui/button';",
      "import { cn } from '../../../../src/lib/utils';",
      "const lazy = import('../../../../src/app/page');",
      "import { MODES } from '../protocol';",
      "import { z } from 'zod';",
    ].join('\n');

    expect(forbiddenImports(file, text)).toEqual([
      '@/src/components/ui/button',
      '../../../../src/lib/utils',
      '../../../../src/app/page',
    ]);
  });
});
