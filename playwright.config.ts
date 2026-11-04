import { defineConfig } from '@playwright/test';

// Each spec starts Truing itself, through the same startTruing the
// `truing` command uses, so every check goes through the real shell.
export default defineConfig({
  testDir: 'test/e2e',
  // One truing and one dev server per spec file; the files share ports.
  workers: 1,
  fullyParallel: false,
  // A cold `next dev` compile of a route can take tens of seconds on a large app.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
});
