// The Changes tray (TRU-4.1) through the host and Truing server: routing
// at stage time, "Let Claude do this", Apply all or none, and the write
// endpoint, which only the shell's socket can reach.
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';

import { twMerge } from 'tailwind-merge';
import { afterEach, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import type { TruingConfig } from '../../src/config';
import { REASONS } from '../../src/edits/engine';
import { NOT_WRITTEN } from '../../src/edits/messages';
import type { Edit, StagedChange } from '../../src/module';
import { createModuleHost, REQUESTED_REASON } from '../../src/module-host';
import { loadModules } from '../../src/module-loader';
import { applyNotice, sharedOf } from '../../src/modules/changes/panel';
import {
  cssFor,
  escapeClass,
  previewOf,
  previewOfDraft,
} from '../../src/modules/changes/preview';
import type { Session } from '../../src/protocol';
import { type TruingServer, startTruingServer } from '../../src/server';

import { moduleTs, PACKAGE_ROOT, serverTs, writeModules } from './temp-modules';

const REPO = PACKAGE_ROOT;
const CARD = 'src/features/card.tsx';

const config: TruingConfig = {
  name: 'test',
  app: { devCommand: 'true', port: 3000 },
  primitives: 'src/components/ui/',
  tokens: 'tokens.css',
  tailwindMerge: 'tokens.json',
  writable: {
    include: ['src/**/*.tsx', 'src/app/globals.css', 'src/stories/**'],
    exclude: ['src/server/**', 'src/app/**/route.ts', 'src/app/actions/**'],
  },
  branch: { pattern: 'design/{feature}' },
  modules: ['./stager', 'changes'],
};

/** A project: the edit fixture, plus a module that stages whatever edit it is given. */
async function project() {
  const root = writeModules({
    stager: {
      'module.ts': moduleTs(
        `{ id: 'stager', title: 'Stager', server: { ops: { stage: { input: z.object({ edit: z.unknown(), claude: z.optional(z.boolean()), reason: z.optional(z.string()) }), output: z.string() } } } }`,
      ),
      'server.ts': serverTs(
        `(ctx) => ({ ops: { stage: async ({ edit, claude, reason }) => (await ctx.stage({ label: 'A change', intent: 'Change it', viewport: { frame: 'main', width: 390 }, property: 'class', write: { by: 'edit', edit }, claude, reason })).id } })`,
      ),
    },
  });
  cpSync(path.join(PACKAGE_ROOT, 'test/fixtures/edit-project'), root, {
    recursive: true,
  });
  cpSync(path.join(REPO, '.prettierrc'), path.join(root, '.prettierrc'));
  cpSync(
    path.join(
      REPO,
      'test/fixtures/design-system/src/lib/tailwind-merge-tokens.json',
    ),
    path.join(root, 'tokens.json'),
  );
  const host = createModuleHost({
    modules: await loadModules(root, config),
    root,
    config: { ...config, modules: config.modules },
  });
  await host.start();
  expect(host.failures()).toEqual([]);
  const read = (file = CARD): string =>
    readFileSync(path.join(root, file), 'utf8');
  const stage = async (
    edit: Edit,
    claude?: boolean,
    reason?: string,
  ): Promise<StagedChange> => {
    const id = await host.call('stager', 'stage', { edit, claude, reason });
    const change = host.changes.list().find((entry) => entry.id === id);
    if (!change) throw new Error('not staged');
    return change;
  };
  return { root, host, read, stage };
}

function at(text: string, id: string) {
  const start = text.lastIndexOf('<', text.indexOf(`id="${id}"`));
  const before = text.slice(0, start);
  return {
    file: CARD,
    line: before.split('\n').length,
    column: start - (before.lastIndexOf('\n') + 1) + 1,
  };
}

it('routes an edit when it is staged: Direct, or Claude with the reason, and hashes the file', async () => {
  const { stage, read } = await project();
  const text = read();
  const direct = await stage({
    kind: 'classes',
    at: at(text, 'card'),
    add: ['px-500'],
    remove: [],
  });
  expect(direct.route).toEqual({ by: 'direct' });
  expect(direct.files).toEqual([
    { file: CARD, hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
  ]);

  const runtime = await stage({
    kind: 'classes',
    at: at(text, 'runtime'),
    add: ['p-200'],
    remove: [],
  });
  expect(runtime.route).toEqual({
    by: 'claude',
    reason: REASONS.runtimeClass,
    requested: false,
  });
});

it('sends an edit with a reason to Claude, keeping the edit for its preview (TRU-4.2)', async () => {
  const { stage, read } = await project();
  const change = await stage(
    {
      kind: 'classes',
      at: at(read(), 'card'),
      add: ['max-md:flex-col'],
      remove: [],
    },
    false,
    'layout change at Phone size needs restructuring',
  );
  expect(change.route).toEqual({
    by: 'claude',
    reason: 'layout change at Phone size needs restructuring',
    requested: false,
  });
  expect(change.write).toMatchObject({
    by: 'edit',
    edit: { add: ['max-md:flex-col'] },
  });
});

it('records a cva edit as a change to the component, and any other edit as one use (TRU-2.2)', async () => {
  const { stage, read } = await project();
  const cva = await stage({
    kind: 'cva',
    file: 'src/components/ui/button.tsx',
    component: 'Button',
    variant: 'size',
    value: 'sm',
    add: ['px-400'],
    remove: [],
  });
  expect(cva.reach).toEqual({
    kind: 'component',
    component: 'Button',
    usages: null,
  });
  const classes = await stage({
    kind: 'classes',
    at: at(read(), 'card'),
    add: ['px-500'],
    remove: [],
  });
  expect(classes.reach).toEqual({ kind: 'use' });
});

it('"Let Claude do this" sends a direct change to Claude, and back again', async () => {
  const { stage, host, read } = await project();
  const change = await stage(
    { kind: 'classes', at: at(read(), 'card'), add: ['px-500'], remove: [] },
    true,
  );
  expect(change.route).toEqual({
    by: 'claude',
    reason: REQUESTED_REASON,
    requested: true,
  });

  const back = await host.changes.setClaude(change.id, false);
  expect(back.route).toEqual({ by: 'direct' });
  const again = await host.changes.setClaude(change.id, true);
  expect(again.route).toMatchObject({ by: 'claude', requested: true });
});

it('Apply writes the direct changes and leaves the Claude ones staged', async () => {
  const { stage, host, read } = await project();
  const text = read();
  const direct = await stage({
    kind: 'classes',
    at: at(text, 'card'),
    add: ['px-500'],
    remove: [],
  });
  const claude = await stage({
    kind: 'classes',
    at: at(text, 'runtime'),
    add: ['p-200'],
    remove: [],
  });

  expect(await host.changes.apply()).toEqual([
    { id: direct.id, result: { status: 'applied' } },
    {
      id: claude.id,
      result: { status: 'needs-claude', reason: REASONS.runtimeClass },
    },
  ]);
  expect(read()).toContain(
    'className="flex flex-col gap-200 px-500 md:px-500"',
  );
  expect(host.changes.list().map((entry) => entry.id)).toEqual([claude.id]);
});

it('Apply writes nothing when one file changed since staging, and keeps every change', async () => {
  const { stage, host, read, root } = await project();
  const text = read();
  await stage({
    kind: 'classes',
    at: at(text, 'card'),
    add: ['px-500'],
    remove: [],
  });
  await stage({
    kind: 'cva',
    file: 'src/components/ui/button.tsx',
    component: 'Button',
    variant: 'size',
    value: 'sm',
    add: ['px-400'],
    remove: [],
  });
  const button = read('src/components/ui/button.tsx');
  writeFileSync(path.join(root, CARD), `${text}\n// a developer's edit\n`);

  const outcomes = await host.changes.apply();
  expect(outcomes.map((outcome) => outcome.result)).toEqual([
    {
      status: 'failed',
      message: `${CARD} was edited after you made this change. Reload, then redo it.`,
    },
    {
      status: 'failed',
      message: NOT_WRITTEN,
    },
  ]);
  expect(read('src/components/ui/button.tsx')).toBe(button);
  expect(host.changes.list()).toHaveLength(2);
});

it('refuses a class name that could leave the string it is written into', async () => {
  const { host, read } = await project();
  for (const name of ['a"b', "a'b", 'a`b', 'a b', 'a{b}', 'a\\b']) {
    await expect(
      host.call('stager', 'stage', {
        edit: {
          kind: 'classes',
          at: at(read(), 'card'),
          add: [name],
          remove: [],
        },
      }),
    ).rejects.toThrow('Invalid edit');
  }
  expect(host.changes.list()).toEqual([]);
});

it('Undo drops one change and Discard drops them all', async () => {
  const { stage, host, read } = await project();
  const text = read();
  const first = await stage({
    kind: 'classes',
    at: at(text, 'card'),
    add: ['px-500'],
    remove: [],
  });
  await stage({
    kind: 'classes',
    at: at(text, 'plain'),
    add: ['gap-100'],
    remove: [],
  });
  await host.call('changes', 'undo', { id: first.id });
  expect(host.changes.list()).toHaveLength(1);
  await host.call('changes', 'discard', {});
  expect(host.changes.list()).toEqual([]);
  expect(read()).toBe(text);
});

// ---------------------------------------------------------------------------
// The write endpoint: the shell's socket, with its origin and the token.

const session: Session = {
  token: 'b'.repeat(64),
  wsUrl: 'ws://localhost:0/ws',
  appOrigin: 'http://localhost:3000',
  shellOrigin: 'http://localhost:4100',
};

let server: TruingServer | null = null;
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets) socket.terminate();
  sockets.length = 0;
  await server?.close();
  server = null;
});

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        resolve(typeof address === 'object' && address ? address.port : 0),
      );
    });
  });
}

async function connect(
  port: number,
  role: 'shell' | 'runtime',
  origin: string,
): Promise<WebSocket> {
  const socket = new WebSocket(
    `ws://127.0.0.1:${port}/ws?role=${role}&token=${session.token}`,
    { origin },
  );
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return socket;
}

const applyCall = JSON.stringify({
  type: 'module-call',
  id: 7,
  module: 'changes',
  op: 'apply',
  input: {},
});

it("a frame's runtime can't Apply; the shell can", async () => {
  const { stage, host, read } = await project();
  await stage({
    kind: 'classes',
    at: at(read(), 'card'),
    add: ['px-500'],
    remove: [],
  });
  const port = await freePort();
  server = await startTruingServer({
    session,
    port,
    projectName: 'test',
    hasTokens: true,
    startRoute: '/',
    assets: () => ({ html: '', js: '', css: '' }),
    modules: host,
  });

  // The app's page holds a runtime socket: it can send the same message.
  const runtime = await connect(port, 'runtime', session.appOrigin);
  runtime.send(
    JSON.stringify({
      type: 'hello',
      frame: 'main',
      href: 'http://localhost:3000/',
      title: 'App',
      runtime: 'test',
      probes: [],
    }),
  );
  runtime.send(applyCall);
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(host.changes.list()).toHaveLength(1);
  expect(read()).not.toContain('px-500 md:px-500');

  // A socket from the app's origin can't claim to be the shell.
  await expect(connect(port, 'shell', session.appOrigin)).rejects.toThrow(
    /403/,
  );

  const shell = await connect(port, 'shell', session.shellOrigin);
  const answer = new Promise<unknown>((resolve) => {
    shell.on('message', (data) => {
      const message: unknown = JSON.parse(data.toString());
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'module-result'
      )
        resolve(message);
    });
  });
  shell.send(applyCall);
  expect(await answer).toMatchObject({
    id: 7,
    value: { outcomes: [{ result: { status: 'applied' } }] },
  });
  expect(read()).toContain('px-500 md:px-500');
});

// ---------------------------------------------------------------------------
// The preview and the notice.

const fakeCss = (name: string): string | null =>
  ({
    'px-400': '.px-400 {\n  padding-inline: var(--spacing-400);\n}\n',
    'px-500': '.px-500 {\n  padding-inline: var(--spacing-500);\n}\n',
    'md:px-600':
      '.md\\:px-600 {\n  @media (width >= 48rem) {\n    padding-inline: var(--spacing-600);\n  }\n}\n',
    shadow:
      '.shadow {\n  --tw-shadow: 0 1px 3px;\n  box-shadow: var(--tw-shadow);\n}\n',
  })[name] ?? null;

it('escapes class names as Tailwind writes them in selectors', () => {
  expect(escapeClass('md:px-500')).toBe('md\\:px-500');
  expect(escapeClass('w-1/2')).toBe('w-1\\/2');
  expect(escapeClass('p-0.5')).toBe('p-0\\.5');
  // A leading digit is written as its code point, as Tailwind does.
  expect(escapeClass('2xl:px-4')).toBe('\\32 xl\\:px-4');
});

it("names a shared component's reach, with the count once it is known", () => {
  const change = (usages: number | null): StagedChange => ({
    version: 5,
    id: 'x',
    module: 'm',
    label: 'x',
    intent: 'x',
    viewport: { frame: null, width: null },
    scope: 'all',
    reach: { kind: 'component', component: 'Button', usages },
    element: null,
    property: 'class',
    before: [],
    after: [],
    write: {
      by: 'edit',
      edit: {
        kind: 'cva',
        file: 'src/components/ui/button.tsx',
        component: 'Button',
        variant: 'size',
        value: 'sm',
        add: ['px-400'],
        remove: [],
      },
    },
    route: { by: 'direct' },
    files: [],
  });
  expect(sharedOf(change(null))).toBe('Changes every Button');
  expect(sharedOf(change(12))).toBe(
    'Changes every Button: 12 uses in the code',
  );
  expect(sharedOf(change(1))).toBe('Changes every Button: 1 use in the code');
});

it('scopes the added classes to the element and unsets the removed ones', () => {
  expect(
    cssFor('#card', ['px-400', 'shadow'], ['px-500', 'md:px-600'], fakeCss),
  ).toBe(
    [
      ':is(#card) {\n  padding-inline: unset;\n}\n',
      ':is(#card) {\n  \n  box-shadow: unset;\n}\n',
      ':is(#card) {\n  padding-inline: var(--spacing-500);\n}\n',
      ':is(#card) {\n  @media (width >= 48rem) {\n    padding-inline: var(--spacing-600);\n  }\n}\n',
    ].join('\n'),
  );
});

it('previews a text edit as its new text, and an intent with nothing to write not at all', async () => {
  const base: StagedChange = {
    version: 5,
    id: 'x',
    module: 'selection',
    label: 'x',
    intent: 'x',
    viewport: { frame: 'main', width: 390 },
    scope: 'all',
    reach: { kind: 'use' },
    element: {
      tag: 'p',
      href: 'http://localhost:3000/',
      selector: '#t',
      classes: [],
      callSite: null,
      definition: null,
      component: null,
    },
    property: 'text',
    before: [],
    after: [],
    write: {
      by: 'edit',
      edit: {
        kind: 'text',
        at: { file: CARD, line: 1, column: 1 },
        before: 'a',
        after: 'b',
      },
    },
    route: { by: 'direct' },
    files: [],
  };
  const deps = {
    merge: (classes: string) => classes,
    css: fakeCss,
    variant: async () => null,
  };
  expect(await previewOf(base, deps)).toEqual({
    href: 'http://localhost:3000/',
    selector: '#t',
    css: '',
    text: 'b',
  });
  expect(await previewOf({ ...base, write: null }, deps)).toBeNull();
});

it('says what an Apply did in one line', () => {
  expect(applyNotice([{ id: 'a', result: { status: 'applied' } }])).toEqual({
    text: 'Applied 1 change.',
    stays: false,
  });
  expect(
    applyNotice([
      { id: 'a', result: { status: 'applied' } },
      { id: 'b', result: { status: 'applied' } },
      { id: 'c', result: { status: 'needs-claude', reason: 'x' } },
    ]),
  ).toEqual({
    text: 'Applied 2 changes. Apply writes direct changes only, so 1 Claude change stays here.',
    stays: false,
  });
  // The change that broke, even when one that only waited on it comes first.
  const broke =
    'src/a.tsx was edited after you made this change. Reload, then redo it.';
  expect(
    applyNotice([
      { id: 'a', result: { status: 'failed', message: NOT_WRITTEN } },
      { id: 'b', result: { status: 'failed', message: broke } },
    ]),
  ).toEqual({ text: broke, stays: true });
});

it('previews a change still being made last, and its classes even when the element has them (TRU-4.2)', () => {
  const css = (name: string): string => `.${name} { padding-inline: ${name} }`;
  const rule = previewOfDraft(
    {
      element: {
        href: 'http://x/',
        selector: '#card',
        classes: ['px-400', 'gap-200'],
      },
      add: ['px-400'],
      remove: [],
    },
    { merge: twMerge, css },
  );
  expect(rule.href).toBe('http://x/');
  expect(rule.css).toContain(':is(#card) { padding-inline: px-400 }');
  expect(rule.css).not.toContain('gap-200');
});
