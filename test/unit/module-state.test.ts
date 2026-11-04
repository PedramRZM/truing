// What TRU-5.2 added to the module contract: a server part telling its panel things,
// one queue for everything that writes source, views in the right panel, and a
// panel following another module's reports.
import { expect, it } from 'vitest';

import type { TruingConfig } from '../../src/config';
import type { ApplyOutcome, ModuleSpec } from '../../src/module';
import { createModuleHost } from '../../src/module-host';
import { loadModules, ModuleConfigError } from '../../src/module-loader';
import type { ToShell } from '../../src/protocol';
import { panelProps } from '../../src/shell/module-section';
import type { ShellState, ShellStore } from '../../src/shell/store';

import { moduleTs, serverTs, writeModules } from './temp-modules';

const config: TruingConfig = {
  name: 'test',
  app: { devCommand: 'x', port: 3000 },
  primitives: 'ui/',
  tokens: 'tokens.css',
  writable: { include: ['**/*.tsx'], exclude: [] },
  branch: { pattern: 'design/{feature}' },
};

const TELLER = {
  'module.ts': moduleTs(`{
    id: 'teller',
    title: 'Teller',
    server: {
      state: { news: z.object({ text: z.string() }) },
      ops: {
        tell: { input: z.object({ text: z.string() }), output: z.boolean() },
        bad: { input: z.object({}), output: z.boolean() },
        unknown: { input: z.object({}), output: z.boolean() },
        hold: { input: z.object({}), output: z.boolean() },
      },
    },
  }`),
  'server.ts': serverTs(`(ctx) => {
    globalThis.teller = ctx;
    return {
      ops: {
        tell: ({ text }) => { ctx.publish('news', { text }); return true; },
        bad: () => { ctx.publish('news', { text: 1 }); return true; },
        unknown: () => { ctx.publish('other', {}); return true; },
        hold: () => ctx.exclusive(() => new Promise((resolve) => {
          globalThis.release = () => resolve(true);
        })),
      },
      onClose: () => { globalThis.tellerClosed = true; },
    };
  }`),
};

async function tellerHost() {
  const root = writeModules({ teller: TELLER });
  const modules = await loadModules(root, { modules: ['./teller'] });
  const host = createModuleHost({ modules, root, config });
  const shells: ToShell[] = [];
  host.connect({
    toShells: (message) => shells.push(message),
    toRuntime: () => false,
  });
  await host.start();
  return { host, shells };
}

it('sends what a server part publishes, and keeps the latest for a new shell', async () => {
  const { host, shells } = await tellerHost();
  await host.call('teller', 'tell', { text: 'one' });
  await host.call('teller', 'tell', { text: 'two' });
  expect(shells).toContainEqual({
    type: 'module-state',
    module: 'teller',
    name: 'news',
    value: { text: 'two' },
  });
  expect(host.snapshot().state).toEqual([
    { module: 'teller', name: 'news', value: { text: 'two' } },
  ]);
});

it('refuses state its module doesn’t declare, or of the wrong shape', async () => {
  const { host } = await tellerHost();
  await expect(host.call('teller', 'bad', {})).rejects.toThrow(/Invalid state/);
  await expect(host.call('teller', 'unknown', {})).rejects.toThrow(
    /declares no state/,
  );
});

it('holds Apply behind a running job, and says why', async () => {
  const { host, shells } = await tellerHost();
  const held = host.call('teller', 'hold', {});
  await new Promise((resolve) => setTimeout(resolve, 5));

  let applied: ApplyOutcome[] | null = null;
  const apply = host.changes.apply().then((outcomes) => {
    applied = outcomes;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(applied).toBeNull();
  expect(shells).toContainEqual({
    type: 'notice',
    text: 'Claude is working. Apply runs when it finishes.',
  });

  (globalThis as unknown as { release: () => void }).release();
  await held;
  await apply;
  expect(applied).toEqual([]);
});

it('keeps going after a job that failed', async () => {
  const root = writeModules({
    failing: {
      'module.ts': moduleTs(`{
        id: 'failing',
        title: 'Failing',
        server: { ops: {
          fail: { input: z.object({}), output: z.boolean() },
          pass: { input: z.object({}), output: z.boolean() },
        } },
      }`),
      'server.ts': serverTs(`(ctx) => ({ ops: {
        fail: () => ctx.exclusive(async () => { throw new Error('no'); }),
        pass: () => ctx.exclusive(async () => true),
      } })`),
    },
  });
  const host = createModuleHost({
    modules: await loadModules(root, { modules: ['./failing'] }),
    root,
    config,
  });
  await host.start();
  await expect(host.call('failing', 'fail', {})).rejects.toThrow('no');
  expect(await host.call('failing', 'pass', {})).toBe(true);
});

it('tells each server part when Truing closes', async () => {
  const { host } = await tellerHost();
  await host.close();
  expect(
    (globalThis as unknown as { tellerClosed: boolean }).tellerClosed,
  ).toBe(true);
});

it('says there is no browser, rather than hang', async () => {
  await tellerHost();
  const { screenshot } = (
    globalThis as unknown as {
      teller: { screenshot: { frame: (id: string) => Promise<unknown> } };
    }
  ).teller;
  await expect(screenshot.frame('main')).rejects.toThrow(/No browser/);
});

it('refuses a view without a right section', async () => {
  const root = writeModules({
    wrong: {
      'module.ts': moduleTs(`{
        id: 'wrong',
        title: 'Wrong',
        panel: { docks: ['left'], view: 'claude' },
      }`),
      'panel.tsx': '',
    },
  });
  await expect(loadModules(root, { modules: ['./wrong'] })).rejects.toThrow(
    ModuleConfigError,
  );
});

const spec: ModuleSpec = {
  id: 'follower',
  title: 'Follower',
  panel: { docks: ['right'], follows: { other: ['picked'] } },
};
const store = {} as ShellStore;
const base = {
  layout: 'single',
  viewport: { kind: 'preset', preset: 'desktop' },
  canvas: { width: 1000, height: 800 },
  frames: {},
  activeFrame: null,
  rightView: 'properties',
  resized: {},
  offsets: {},
  resizing: false,
  modules: {
    reports: { other: { picked: { main: 1 }, secret: { main: 2 } } },
    failures: [],
    changes: [],
    state: {},
  },
} as unknown as ShellState;

it('hands a panel only the reports it follows', () => {
  const { peers } = panelProps(spec, base, store);
  expect(peers.reports('other', 'picked')).toEqual({ main: 1 });
  expect(peers.reports('other', 'secret')).toEqual({});
  expect(peers.reports('nobody', 'picked')).toEqual({});
});

it('renders a panel for a report it follows, and not for another', () => {
  const props = panelProps(spec, base, store);
  const quiet = {
    ...base,
    modules: {
      ...base.modules,
      reports: {
        other: { ...base.modules.reports.other, secret: { main: 3 } },
      },
    },
  } as ShellState;
  expect(panelProps(spec, quiet, store)).toBe(props);

  const news = {
    ...base,
    modules: {
      ...base.modules,
      reports: {
        other: { ...base.modules.reports.other, picked: { main: 9 } },
      },
    },
  } as ShellState;
  expect(
    panelProps(spec, news, store).peers.reports('other', 'picked'),
  ).toEqual({
    main: 9,
  });
});

it('renders a panel for what its server published, and for a new view', () => {
  const props = panelProps(spec, base, store);
  const published = {
    ...base,
    modules: { ...base.modules, state: { follower: { news: 1 } } },
  } as ShellState;
  const told = panelProps(spec, published, store);
  expect(told).not.toBe(props);
  expect(told.state).toEqual({ news: 1 });

  const viewed = panelProps(
    spec,
    { ...published, rightView: 'claude' } as ShellState,
    store,
  );
  expect(viewed.rightView).toBe('claude');
});
