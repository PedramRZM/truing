#!/usr/bin/env node
// Runs Truing's TypeScript directly: it builds its own UI when it starts, so
// there is nothing to compile on install.
import { register } from 'tsx/esm/api';

register();
await import('../src/cli.ts');
