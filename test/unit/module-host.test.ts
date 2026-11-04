import { expect, it } from 'vitest';

import type { TruingConfig } from '../../src/config';
import { type Bus, createModuleHost } from '../../src/module-host';
import { loadModules } from '../../src/module-loader';
import type { ToRuntime, ToShell } from '../../src/protocol';

import {
  CONTRACT,
  moduleTs,
  PACKAGE_ROOT,
  serverTs,
  writeModules,
} from './temp-modules';

const config: TruingConfig = {
  name: 'test',
  app: { devCommand: 'true', port: 3000 },
  primitives: 'ui/',
  tokens: 'tokens.css',
  writable: { include: ['**'], exclude: [] },
  branch: { pattern: 'design/{feature}' },
};

/**
 * A bus whose frames run `answer` for each probe command, the way a frame's
 * runtime would, and which records what the shells were sent.
 */
function fakeBus(
  host: ReturnType<typeof createModuleHost>,
  answer: (
    frame: string,
    message: Extract<ToRuntime, { type: 'module-command' }>,
  ) => unknown = () => undefined,
): { bus: Bus; shells: ToShell[] } {
  const shells: ToShell[] = [];
  const bus: Bus = {
    toShells: (message) => shells.push(message),
    toRuntime: (frame, message) => {
      if (message.type === 'module-command') {
        const value = answer(frame, message);
        if (value !== undefined) {
          queueMicrotask(() =>
            host.onRuntimeMessage(frame, {
              type: 'module-result',
              id: message.id,
              value,
            }),
          );
        }
      }
      return true;
    },
  };
  host.connect(bus);
  return { bus, shells };
}

async function elementCountHost(commandTimeoutMs?: number) {
  const modules = await loadModules(PACKAGE_ROOT, {
    modules: ['selection', './examples/element-count'],
  });
  const host = createModuleHost({
    modules,
    root: PACKAGE_ROOT,
    config,
    commandTimeoutMs,
  });
  await host.start();
  return host;
}

it('keeps a valid report and passes it to the shells; drops one that breaks its schema', async () => {
  const host = await elementCountHost();
  const { shells } = fakeBus(host);
  host.onRuntimeHello('main', ['element-count']);

  host.onRuntimeMessage('main', {
    type: 'module-report',
    module: 'element-count',
    name: 'count',
    payload: { elements: 'many' },
  });
  host.onRuntimeMessage('main', {
    type: 'module-report',
    module: 'element-count',
    name: 'count',
    payload: { elements: 37 },
  });

  expect(shells).toEqual([
    {
      type: 'module-report',
      module: 'element-count',
      frame: 'main',
      name: 'count',
      payload: { elements: 37 },
    },
  ]);
  expect(await host.call('element-count', 'counts', {})).toEqual({ main: 37 });
});

it('answers an op with an error a person can read', async () => {
  const host = await elementCountHost();
  fakeBus(host);
  await expect(host.call('element-count', 'counts', 'all')).rejects.toThrow(
    /^Invalid input for counts/,
  );
  await expect(host.call('element-count', 'nope', {})).rejects.toThrow(
    'Module "element-count" has no op "nope".',
  );
  await expect(host.call('missing', 'counts', {})).rejects.toThrow(
    'No module "missing" is loaded.',
  );
});

it("lists each Claude tool with its JSON Schema, and runs it through the frames' probes", async () => {
  const host = await elementCountHost();
  fakeBus(host, (frame, message) =>
    message.name === 'count'
      ? { elements: frame === 'phone' ? 20 : 37 }
      : undefined,
  );
  host.onRuntimeHello('phone', ['selection', 'element-count']);
  host.onRuntimeHello('desktop', ['selection', 'element-count']);

  expect(host.tools.list()).toEqual([
    expect.objectContaining({
      name: 'count_elements',
      module: 'element-count',
      inputSchema: expect.objectContaining({ type: 'object' }),
    }),
  ]);
  expect(await host.tools.call('count_elements', {})).toEqual({
    content: [{ type: 'text', text: '{"phone":20,"desktop":37}' }],
  });
  expect(
    await host.tools.call('count_elements', { selector: 3 }),
  ).toMatchObject({ isError: true });
  expect(await host.tools.call('no_such_tool', {})).toEqual({
    content: [{ type: 'text', text: 'No tool "no_such_tool".' }],
    isError: true,
  });
});

it('gives up on a frame that does not answer', async () => {
  const host = await elementCountHost(20);
  fakeBus(host);
  host.onRuntimeHello('main', ['element-count']);
  await expect(
    host.command('element-count', 'main', 'count', {}),
  ).rejects.toThrow("The main frame didn't answer count.");
});

it('refuses a command to a frame where the probe is not running', async () => {
  const host = await elementCountHost();
  fakeBus(host);
  host.onRuntimeHello('main', ['selection']);
  await expect(
    host.command('element-count', 'main', 'count', {}),
  ).rejects.toThrow(`Module "element-count" isn't running in the main frame.`);
});

it('records a failed probe for its frame, and forgets it when the frame says hello again', async () => {
  const host = await elementCountHost();
  const { shells } = fakeBus(host);
  host.onRuntimeHello('main', ['selection', 'element-count']);

  host.onRuntimeMessage('main', {
    type: 'module-failed',
    module: 'element-count',
    message: 'boom',
  });

  const failure = {
    module: 'element-count',
    part: 'probe',
    frame: 'main',
    message: 'boom',
  };
  expect(shells).toContainEqual({ type: 'module-failed', failure });
  expect(host.failures()).toEqual([failure]);
  expect(host.probesIn('main')).toEqual(['selection']);

  host.onRuntimeHello('main', ['selection', 'element-count']);
  expect(host.failures()).toEqual([]);
});

it('fails a server part that throws while starting, and starts the others', async () => {
  const root = writeModules({
    broken: {
      'module.ts': moduleTs(
        `{ id: 'broken', title: 'Broken', server: { ops: { get: { input: z.object({}), output: z.number() } } }, claude: { tools: { get_it: { description: 'Gets it.', input: z.object({}) } } } }`,
      ),
      'server.ts': serverTs(`() => { throw new Error('no database'); }`),
    },
    fine: {
      'module.ts': moduleTs(
        `{ id: 'fine', title: 'Fine', server: { ops: { get: { input: z.object({}), output: z.number() } } } }`,
      ),
      'server.ts': serverTs(`() => ({ ops: { get: () => 1 } })`),
    },
  });
  const modules = await loadModules(root, { modules: ['./broken', './fine'] });
  const host = createModuleHost({ modules, root, config });
  await host.start();

  expect(host.failures()).toEqual([
    { module: 'broken', part: 'server', frame: null, message: 'no database' },
  ]);
  await expect(host.call('broken', 'get', {})).rejects.toThrow(
    `Module "broken" didn't start: no database`,
  );
  expect(host.tools.list()).toEqual([]);
  expect(await host.call('fine', 'get', {})).toBe(1);
});

it('keeps a server-only report from the shells, and still hands it to the server', async () => {
  const root = writeModules({
    busy: {
      'module.ts': moduleTs(
        `{ id: 'busy', title: 'Busy', probe: { serverOnly: ['moved'], reports: { moved: z.number(), shown: z.number() } }, server: { ops: { last: { input: z.object({}), output: z.number() } } } }`,
      ),
      'probe.ts': `import { defineProbe } from ${JSON.stringify(CONTRACT)};
        import module from './module';
        export default defineProbe(module, () => ({ commands: {} }));`,
      'server.ts': serverTs(`() => {
        let last = 0;
        return {
          ops: { last: () => last },
          onReport: (name, value) => { if (name === 'moved') last = value; },
        };
      }`),
    },
  });
  const host = createModuleHost({
    modules: await loadModules(root, { modules: ['./busy'] }),
    root,
    config,
  });
  await host.start();
  const { shells } = fakeBus(host);
  host.onRuntimeHello('main', ['busy']);

  for (const [name, payload] of [
    ['moved', 7],
    ['shown', 8],
  ] as const) {
    host.onRuntimeMessage('main', {
      type: 'module-report',
      module: 'busy',
      name,
      payload,
    });
  }

  expect(shells).toEqual([
    {
      type: 'module-report',
      module: 'busy',
      frame: 'main',
      name: 'shown',
      payload: 8,
    },
  ]);
  // A shell that connects later doesn't get it either.
  expect(host.snapshot().reports).toEqual([
    { module: 'busy', frame: 'main', name: 'shown', payload: 8 },
  ]);
  expect(await host.call('busy', 'last', {})).toBe(7);
});

it('fails a server part that leaves out a handler it declared', async () => {
  const root = writeModules({
    partial: {
      'module.ts': moduleTs(
        `{ id: 'partial', title: 'Partial', server: { ops: { get: { input: z.object({}), output: z.number() } } } }`,
      ),
      'server.ts': serverTs(`() => ({ ops: {} })`),
    },
  });
  const host = createModuleHost({
    modules: await loadModules(root, { modules: ['./partial'] }),
    root,
    config,
  });
  await host.start();
  expect(host.failures()).toEqual([
    expect.objectContaining({
      module: 'partial',
      message: 'server.ts has no handler for op "get".',
    }),
  ]);
});

it('stages a direct change, sends the change set to the shells, and applies it', async () => {
  const root = writeModules({
    edits: {
      'module.ts': moduleTs(
        `{ id: 'edits', title: 'Edits', server: { direct: { rename: { input: z.object({ to: z.string() }) } }, ops: { stage: { input: z.object({ to: z.string() }), output: z.string() } } } }`,
      ),
      'server.ts': serverTs(`(ctx) => {
        let fail = false;
        return {
          ops: { stage: async ({ to }) => {
            if (to === 'fail-next') { fail = true; return ''; }
            return (await ctx.stage({ label: 'Rename to ' + to, intent: 'Rename it to ' + to, viewport: { frame: 'phone', width: 390 }, property: 'name', write: { by: 'op', op: 'rename', input: { to } } })).id;
          } },
          direct: { rename: () => fail ? { status: 'failed', message: 'name taken' } : { status: 'applied' } },
        };
      }`),
    },
  });
  const host = createModuleHost({
    modules: await loadModules(root, { modules: ['./edits'] }),
    root,
    config,
  });
  await host.start();
  const { shells } = fakeBus(host);

  const id = await host.call('edits', 'stage', { to: 'b' });
  const staged = {
    version: 5,
    id,
    module: 'edits',
    label: 'Rename to b',
    intent: 'Rename it to b',
    viewport: { frame: 'phone', width: 390 },
    scope: 'all',
    reach: { kind: 'use' },
    element: null,
    property: 'name',
    before: [],
    after: [],
    write: { by: 'op', op: 'rename', input: { to: 'b' } },
    route: { by: 'direct' },
    files: [],
  };
  expect(host.changes.list()).toEqual([staged]);
  expect(shells).toContainEqual({ type: 'changes', changes: [staged] });

  await host.call('edits', 'stage', { to: 'fail-next' });
  expect(await host.changes.apply()).toEqual([
    { id, result: { status: 'failed', message: 'name taken' } },
  ]);
  expect(host.changes.list()).toEqual([staged]);

  await host.call('edits', 'stage', { to: 'c' });
  host.changes.remove(String(id));
  expect(host.changes.list().map((change) => change.label)).toEqual([
    'Rename to c',
  ]);
  host.changes.discard();
  expect(host.changes.list()).toEqual([]);
});

it('refuses to stage a direct change the module does not declare', async () => {
  const root = writeModules({
    edits: {
      'module.ts': moduleTs(
        `{ id: 'edits', title: 'Edits', server: { ops: { stage: { input: z.object({}), output: z.string() } } } }`,
      ),
      'server.ts': serverTs(
        `(ctx) => ({ ops: { stage: async () => (await ctx.stage({ label: 'x', intent: 'x', viewport: { frame: null, width: null }, property: 'x', write: { by: 'op', op: 'delete', input: {} } })).id } })`,
      ),
    },
  });
  const host = createModuleHost({
    modules: await loadModules(root, { modules: ['./edits'] }),
    root,
    config,
  });
  await host.start();
  await expect(host.call('edits', 'stage', {})).rejects.toThrow(
    'Module "edits" has no direct operation "delete".',
  );
});

it('treats names that exist on every object (toString, constructor) as unknown, never as a crash', async () => {
  const host = await elementCountHost();
  const { shells } = fakeBus(host);
  host.onRuntimeHello('main', ['element-count']);

  expect(() =>
    host.onRuntimeMessage('main', {
      type: 'module-report',
      module: 'element-count',
      name: 'toString',
      payload: {},
    }),
  ).not.toThrow();
  expect(shells).toEqual([]);
  expect(await host.tools.call('constructor', {})).toEqual({
    content: [{ type: 'text', text: 'No tool "constructor".' }],
    isError: true,
  });
  await expect(host.call('element-count', 'toString', {})).rejects.toThrow(
    'Module "element-count" has no op "toString".',
  );
});

it('takes an answer only from the frame that was asked', async () => {
  const host = await elementCountHost();
  let asked: { frame: string; id: number } | null = null;
  fakeBus(host, (frame, message) => {
    asked = { frame, id: message.id };
    return undefined;
  });
  host.onRuntimeHello('main', ['element-count']);
  host.onRuntimeHello('phone', ['element-count']);

  const answer = host.command('element-count', 'main', 'count', {});
  const { id } = asked ?? { id: -1 };
  host.onRuntimeMessage('phone', {
    type: 'module-result',
    id,
    value: { elements: 1 },
  });
  host.onRuntimeMessage('main', {
    type: 'module-result',
    id,
    value: { elements: 37 },
  });

  await expect(answer).resolves.toEqual({ elements: 37 });
});

it('tells the shells when a frame that reported reloads, so a stale pick goes with it', async () => {
  const host = await elementCountHost();
  const { shells } = fakeBus(host);
  host.onRuntimeHello('main', ['element-count']);
  host.onRuntimeMessage('main', {
    type: 'module-report',
    module: 'element-count',
    name: 'count',
    payload: { elements: 3 },
  });
  shells.length = 0;

  host.onRuntimeHello('main', ['element-count']);
  expect(shells).toEqual([{ type: 'module-frame-reset', frame: 'main' }]);
});
