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
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  // TRU-7.2: a failure explains itself. CI uploads this folder.
  outputDir: 'test-results',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
