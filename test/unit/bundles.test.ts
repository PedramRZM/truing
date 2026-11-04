import { expect, it } from 'vitest';

import { buildRuntime, buildShell } from '../../src/build';
import { loadModules } from '../../src/module-loader';
import type { Session } from '../../src/protocol';

import { PACKAGE_ROOT } from './temp-modules';

const session: Session = {
  token: 't'.repeat(64),
  wsUrl: 'ws://localhost:4100/ws',
  appOrigin: 'http://localhost:3000',
  shellOrigin: 'http://localhost:4100',
};

// Strings only the toy module's probe entry and panel contain. The runtime is
// minified (TRU-2.1), so the probe's mark is its module's id, a string literal.
const TOY_PROBE = '"element-count"';
const TOY_PANEL = 'Counts show once a frame loads.';

it("bundles a listed module's probe into the runtime and its panel into the shell, and drops them when it is removed", async () => {
  const listed = await loadModules(PACKAGE_ROOT, {
    modules: ['selection', './examples/element-count'],
  });
  const removed = await loadModules(PACKAGE_ROOT, { modules: ['selection'] });

  const [runtimeWith, runtimeWithout, shellWith, shellWithout] =
    await Promise.all([
      buildRuntime(session, listed),
      buildRuntime(session, removed),
      buildShell(listed),
      buildShell(removed),
    ]);

  expect(runtimeWith).toContain(TOY_PROBE);
  expect(runtimeWithout).not.toContain(TOY_PROBE);
  expect(shellWith.js).toContain(TOY_PANEL);
  expect(shellWithout.js).not.toContain(TOY_PANEL);
  // The toy's server part never reaches a browser bundle.
  expect(runtimeWith).not.toContain('No frame of the app is open in Truing.');
  expect(shellWith.js).not.toContain('No frame of the app is open in Truing.');
});

it("builds the shell with React's production build, without its dead code", async () => {
  const modules = await loadModules(PACKAGE_ROOT, { modules: ['selection'] });
  const { js } = await buildShell(modules);
  // Development React costs several times as much on every render.
  expect(js).not.toContain('jsxDEV');
  expect(js).not.toContain('sourceMappingURL');
  // React throws this from a build with its dead code left in.
  expect(js).not.toContain('^_^');
});

it('keeps the runtime small with the core modules in it', async () => {
  const modules = await loadModules(PACKAGE_ROOT, { modules: ['selection'] });
  const runtime = await buildRuntime(session, modules);
  // TRU-1.5 brought it to 52 KB by keeping React and full zod out. TRU-2.4's
  // Select layer took it past 80 KB (79,881 → 80,298 bytes); the budget rose
  // the budget to 85 KB on 2026-11-01, as more probe features are coming.
  // TRU-3.6's page measurements took it to 86,797 bytes; the budget rose it to
  // 90 KB on 2026-11-02, leaving room for TRU-3.7 and TRU-16.4. TRU-4.5 came to 90,223
  // bytes, after dropping 844 of schemas only the server reads. Asked on
  // 2026-11-02 for a budget that fits what's left, rather than a raise per task:
  // about ten pending tasks draw in the frame (TRU-16.9, TRU-16.12, TRU-16.1, TRU-16.2, TRU-14.2, TRU-11.3,
  // TRU-16.3, TRU-16.4, TRU-16.6, TRU-11.4), at about 2 KB each as the panel tasks shipped so far averaged.
  expect(runtime.length).toBeLessThan(110_000);
  // Only Truing's process reads a module's server schemas (TRU-4.2).
  expect(runtime).not.toContain('stage-variant');
  expect(runtime).not.toContain('react-dom');
  // bippy's entry imports React for hooks the probes never call (TRU-2.1).
  expect(runtime).not.toContain('react.development');
});
