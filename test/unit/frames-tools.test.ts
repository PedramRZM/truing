// TRU-18.2: Claude's frame tools work on the board the person sees, through the
// same messages the shell applies, and leave the person's frames to them.
import { expect, it } from 'vitest';

import type { TruingConfig } from '../../src/config';
import { createModuleHost } from '../../src/module-host';
import { loadModules } from '../../src/module-loader';
import { listFrames } from '../../src/modules/frames/server';
import { type Board, FRAME_CAP, type ToShell } from '../../src/protocol';

import { PACKAGE_ROOT } from './temp-modules';

const config: TruingConfig = {
  name: 'test',
  app: { devCommand: 'x', port: 3000 },
  primitives: 'ui/',
  tokens: 'tokens.css',
  writable: { include: ['**/*.tsx'], exclude: [] },
  branch: { pattern: 'design/{feature}' },
};

const BOARD: Board = {
  version: 1,
  layout: 'single',
  viewport: { kind: 'preset', preset: 'desktop' },
  route: '/',
  frames: [
    { id: 'tab-1', route: '/library', by: 'person' },
    {
      id: 'claude-1',
      route: '/library',
      by: 'claude',
      viewport: { kind: 'preset', preset: 'phone' },
    },
  ],
};

async function framesHost(board: Board | null = BOARD) {
  const modules = await loadModules(PACKAGE_ROOT, { modules: ['frames'] });
  const host = createModuleHost({ modules, root: PACKAGE_ROOT, config });
  const shells: ToShell[] = [];
  host.connect({
    toShells: (message) => shells.push(message),
    toRuntime: () => false,
  });
  await host.start();
  if (board) host.onBoard(board);
  const ops = () =>
    shells.flatMap((message) =>
      message.type === 'frame-op' ? [message.op] : [],
    );
  const text = (result: { content: Array<{ type: string; text?: string }> }) =>
    result.content[0]?.text ?? '';
  return { host, ops, text };
}

it('describes its tools to Claude as recorded here', async () => {
  const { host } = await framesHost();
  expect(
    host.tools.list().map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  ).toMatchSnapshot();
});

it('lists the layout’s frame and the record frames, with who opened each', () => {
  expect(listFrames(BOARD, ['main', 'claude-1'])).toEqual([
    expect.objectContaining({ id: 'main', device: 'desktop', loaded: true }),
    expect.objectContaining({
      id: 'tab-1',
      opened_by: 'person',
      loaded: false,
    }),
    expect.objectContaining({
      id: 'claude-1',
      opened_by: 'claude',
      device: 'phone',
      width: 390,
      loaded: true,
    }),
  ]);
});

it('opens a frame on the canvas and answers once its page has loaded', async () => {
  const { host, ops, text } = await framesHost();
  setTimeout(() => host.onRuntimeHello('claude-2', []), 300);
  const result = await host.tools.call('open_frame', {
    route: '/library/42',
    device: 'tablet',
    name: 'Take A',
  });
  expect(JSON.parse(text(result))).toEqual({ frame: 'claude-2', loaded: true });
  expect(ops()).toContainEqual({
    kind: 'open',
    id: 'claude-2',
    route: '/library/42',
    viewport: { kind: 'preset', preset: 'tablet' },
    name: 'Take A',
  });
});

it('opens nothing past the cap, and says what to do', async () => {
  const many = Array.from({ length: FRAME_CAP - 1 }, (_, i) => ({
    id: `tab-${i + 1}`,
    route: '/',
  }));
  const { host, ops, text } = await framesHost({ ...BOARD, frames: many });
  const result = await host.tools.call('open_frame', { route: '/' });
  expect(result.isError).toBe(true);
  expect(text(result)).toMatch(/Close one of yours with close_frame/);
  expect(ops()).toEqual([]);
});

it('closes only the frames Claude opened', async () => {
  const { host, ops, text } = await framesHost();
  const theirs = await host.tools.call('close_frame', { frame: 'tab-1' });
  expect(theirs.isError).toBe(true);
  expect(text(theirs)).toMatch(/the person's frame/);
  const mine = await host.tools.call('close_frame', { frame: 'claude-1' });
  expect(mine.isError).toBeUndefined();
  expect(ops()).toEqual([{ kind: 'close', frame: 'claude-1' }]);
});

it('refuses a frame that isn’t there, and a route that isn’t a path on the app', async () => {
  const { host, ops } = await framesHost();
  expect(
    (await host.tools.call('navigate_frame', { frame: 'nope', route: '/' }))
      .isError,
  ).toBe(true);
  expect(
    (
      await host.tools.call('navigate_frame', {
        frame: 'main',
        route: '//evil.example/x',
      })
    ).isError,
  ).toBe(true);
  await host.tools.call('navigate_frame', { frame: 'main', route: '/a' });
  await host.tools.call('resize_frame', { frame: 'tab-1', device: 'phone' });
  await host.tools.call('move_frame', { frame: 'tab-1', x: 40, y: 0 });
  expect(ops()).toEqual([
    { kind: 'navigate', frame: 'main', route: '/a' },
    {
      kind: 'resize',
      frame: 'tab-1',
      viewport: { kind: 'preset', preset: 'phone' },
    },
    { kind: 'move', frame: 'tab-1', x: 40, y: 0 },
  ]);
});
