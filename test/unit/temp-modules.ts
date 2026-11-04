import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The contract, by absolute path, for modules written to a temporary folder. */
export const CONTRACT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/module.ts',
);
export const PACKAGE_ROOT = path.resolve(CONTRACT, '../..');

/**
 * Writes modules into a fresh folder: `{ name: { 'module.ts': source } }`.
 * Returns the folder, which a test uses as the project root.
 */
export function writeModules(
  modules: Record<string, Record<string, string>>,
): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'truing-modules-'));
  for (const [name, files] of Object.entries(modules)) {
    const dir = path.join(root, name);
    mkdirSync(dir, { recursive: true });
    for (const [file, source] of Object.entries(files)) {
      writeFileSync(path.join(dir, file), source);
    }
  }
  return root;
}

/** A module.ts declaring `body` (the object passed to defineModule). */
export function moduleTs(body: string): string {
  return [
    `import * as z from 'zod/mini';`,
    `import { defineModule } from ${JSON.stringify(CONTRACT)};`,
    `export default defineModule(${body});`,
  ].join('\n');
}

export function serverTs(body: string): string {
  return [
    `import { defineServer } from ${JSON.stringify(CONTRACT)};`,
    `import module from './module';`,
    `export default defineServer(module, ${body});`,
  ].join('\n');
}
