import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const designSystem = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'test/fixtures/design-system',
);

export default defineConfig({
  // The cva test loads the design-system fixture's primitives, which import through `@/`.
  resolve: { alias: [{ find: /^@\//, replacement: `${designSystem}/` }] },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    // TRU-4.1: fails the run if any test starts a `claude` process.
    globalSetup: ['test/unit/no-claude.setup.ts'],
  },
});
