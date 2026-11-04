#!/usr/bin/env node
// Runs Truing's TypeScript directly: it builds its own UI when it starts, so
// there is nothing to compile on install.
import { tooOldFor } from '../src/node-version.mjs';

// TRU-7.3: before anything an old Node couldn't load, so it says so in words.
const problem = tooOldFor(process.versions.node);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const { register } = await import('tsx/esm/api');
register();
await import('../src/cli.ts');
