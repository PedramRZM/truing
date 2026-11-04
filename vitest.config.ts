import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const designSystem = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'test/fixtures/design-system',
);

/**
 * TRU-7.8: compiles every utility against every token, so it keeps a core busy for
 * as long as it runs. Beside the other files on a busy machine it passed the time
 * limit (5.8s). Alone, with every core taken, it needs 2.2s. So it runs after them.
 */
const COMPILES = 'test/unit/tokens.test.ts';

export default defineConfig({
  // The cva test loads the design-system fixture's primitives, which import through `@/`.
  resolve: { alias: [{ find: /^@\//, replacement: `${designSystem}/` }] },
  test: {
    environment: 'node',
    // TRU-4.1: fails the run if any test starts a `claude` process.
    globalSetup: ['test/unit/no-claude.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          exclude: [COMPILES],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'compiles',
          include: [COMPILES],
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
