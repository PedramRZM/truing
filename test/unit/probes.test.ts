import { afterEach, beforeEach, expect, it } from 'vitest';
import * as z from 'zod/mini';

import { defineModule, defineProbe } from '../../src/module';
import { DEFAULT_VIEW, type RuntimeMessage } from '../../src/protocol';
import { type ProbeEntry, startProbes } from '../../src/runtime/probes';

// The probes run in a frame; here a bare EventTarget stands in for its window.
beforeEach(() => {
  Object.assign(globalThis, { window: new EventTarget() });
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

const steady = defineModule({
  id: 'steady',
  title: 'Steady',
  probe: {
    reports: { seen: z.object({ type: z.string() }) },
    commands: {
      check: { input: z.object({ ok: z.boolean() }), output: z.string() },
    },
  },
});
const fragile = defineModule({ id: 'fragile', title: 'Fragile', probe: {} });

/** A steady probe that reports every `ping` event, and answers `check`. */
const steadyEntry: ProbeEntry = {
  module: steady,
  probe: defineProbe(steady, (ctx) => {
    ctx.listen('message', (event) => ctx.report('seen', { type: event.type }));
    return {
      commands: {
        check: ({ ok }) => {
          if (!ok) throw new Error('not ok');
          return 'fine';
        },
      },
    };
  }),
};

function start(entries: ProbeEntry[]) {
  const sent: RuntimeMessage[] = [];
  const probes = startProbes(entries, {
    frame: 'main',
    mode: () => 'interact',
    view: () => DEFAULT_VIEW,
    send: (message) => sent.push(message),
  });
  return { probes, sent };
}

it('stops a probe that throws while starting, and starts the others', () => {
  const { probes, sent } = start([
    {
      module: fragile,
      probe: defineProbe(fragile, () => {
        throw new Error('no luck');
      }),
    },
    steadyEntry,
  ]);

  expect(probes.running()).toEqual(['steady']);
  expect(sent).toEqual([
    { type: 'module-failed', module: 'fragile', message: 'no luck' },
  ]);
});

it('stops a probe whose listener throws, removes its listeners, and keeps the others', () => {
  let calls = 0;
  const { probes, sent } = start([
    {
      module: fragile,
      probe: defineProbe(fragile, (ctx) => {
        ctx.listen('message', () => {
          calls += 1;
          throw new Error('listener broke');
        });
      }),
    },
    steadyEntry,
  ]);

  window.dispatchEvent(new Event('message'));
  window.dispatchEvent(new Event('message'));

  expect(calls).toBe(1);
  expect(probes.running()).toEqual(['steady']);
  expect(sent).toEqual([
    { type: 'module-failed', module: 'fragile', message: 'listener broke' },
    {
      type: 'module-report',
      module: 'steady',
      name: 'seen',
      payload: { type: 'message' },
    },
    {
      type: 'module-report',
      module: 'steady',
      name: 'seen',
      payload: { type: 'message' },
    },
  ]);
});

it('stops a probe whose guarded callback throws later, as from a timer', () => {
  let later: () => void = () => {};
  const { probes, sent } = start([
    {
      module: fragile,
      probe: defineProbe(fragile, (ctx) => {
        later = ctx.guard(() => {
          throw new Error('timer broke');
        });
      }),
    },
  ]);

  later();

  expect(probes.running()).toEqual([]);
  expect(sent).toEqual([
    { type: 'module-failed', module: 'fragile', message: 'timer broke' },
  ]);
});

it('answers a command, and answers a throwing command with its error without stopping the probe', async () => {
  const { probes, sent } = start([steadyEntry]);

  await probes.command({
    type: 'module-command',
    id: 1,
    module: 'steady',
    name: 'check',
    input: { ok: true },
  });
  await probes.command({
    type: 'module-command',
    id: 2,
    module: 'steady',
    name: 'check',
    input: { ok: false },
  });
  await probes.command({
    type: 'module-command',
    id: 3,
    module: 'gone',
    name: 'check',
    input: {},
  });

  expect(sent).toEqual([
    { type: 'module-result', id: 1, value: 'fine', error: undefined },
    { type: 'module-result', id: 2, value: null, error: 'not ok' },
    {
      type: 'module-result',
      id: 3,
      value: null,
      error: `Module "gone" can't answer check in this frame.`,
    },
  ]);
  expect(probes.running()).toEqual(['steady']);
});

it('stops a probe defined for another module', () => {
  const { probes, sent } = start([
    { module: fragile, probe: defineProbe(steady, () => {}) },
    steadyEntry,
  ]);

  expect(probes.running()).toEqual(['steady']);
  expect(sent).toEqual([
    {
      type: 'module-failed',
      module: 'fragile',
      message: 'probe.ts must export defineProbe(module, …) for "fragile".',
    },
  ]);
});

it('hands Esc to every probe that listens, and stops one whose handler throws', () => {
  const calm = defineModule({ id: 'calm', title: 'Calm', probe: {} });
  const heard: string[] = [];
  const { probes, sent } = start([
    {
      module: calm,
      probe: defineProbe(calm, (ctx) => ctx.onEscape(() => heard.push('calm'))),
    },
    {
      module: fragile,
      probe: defineProbe(fragile, (ctx) =>
        ctx.onEscape(() => {
          throw new Error('no escape');
        }),
      ),
    },
  ]);

  probes.escape();
  probes.escape();

  expect(heard).toEqual(['calm', 'calm']);
  expect(probes.running()).toEqual(['calm']);
  expect(sent).toContainEqual({
    type: 'module-failed',
    module: 'fragile',
    message: 'no escape',
  });
});

it('reports whether any probe used Esc, so an unused one can leave Fill', () => {
  const calm = defineModule({ id: 'calm', title: 'Calm', probe: {} });
  let used = true;
  const { probes } = start([
    {
      module: calm,
      probe: defineProbe(calm, (ctx) => ctx.onEscape(() => used)),
    },
  ]);

  expect(probes.escape()).toBe(true);
  used = false;
  expect(probes.escape()).toBe(false);
});
