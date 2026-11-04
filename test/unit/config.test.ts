import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  branchFor,
  findProjectRoot,
  loadConfig,
  validateConfig,
} from '../../src/config';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('config', () => {
  it('finds a project root from below it and reads its config', async () => {
    const fixture = path.join(here, '../fixtures/design-system');
    const root = findProjectRoot(path.join(fixture, 'src/app'));
    expect(root).toBe(fixture);
    const { config } = await loadConfig(root);

    expect(config.app).toMatchObject({ devCommand: 'pnpm dev', port: 3000 });
    expect(config.primitives).toBe('src/components/ui/');
    expect(config.tokens).toBe('src/app/globals.css');
    expect(config.writable.include).toContain('src/**/*.tsx');
    expect(config.writable.exclude).toContain('src/server/**');
    expect(config.writable.exclude).toContain('src/**/*.test.tsx');
    expect(branchFor(config, 'x')).toBe('design/x');
  });

  it('names every missing or invalid field', () => {
    expect(() =>
      validateConfig({ name: 'x', app: { devCommand: '', port: 'no' } }),
    ).toThrow(/app\.devCommand.*app\.port.*writable/);
  });

  it('requires {feature} in the branch pattern', () => {
    expect(() =>
      validateConfig({
        name: 'x',
        app: { devCommand: 'pnpm dev', port: 3000 },
        primitives: 'ui/',
        tokens: 'tokens.css',
        writable: { include: ['src/**'], exclude: [] },
        branch: { pattern: 'design/x' },
      }),
    ).toThrow(/branch\.pattern/);
  });
});
