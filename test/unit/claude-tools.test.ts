// TRU-12.1: every module's Claude tools reach a Claude session through Truing's
// MCP server, which asks the claude module's bridge to list and call them.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { afterEach, expect, it } from 'vitest';

import type { TruingConfig } from '../../src/config';
import type { ClaudeTools } from '../../src/module';
import { createModuleHost } from '../../src/module-host';
import { loadModules } from '../../src/module-loader';
import { type Bridge, startBridge } from '../../src/modules/claude/bridge';

import { moduleTs, serverTs, writeModules } from './temp-modules';

const MCP_SERVER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/claude/mcp-server.mjs',
);

const config: TruingConfig = {
  name: 'test',
  app: { devCommand: 'x', port: 3000 },
  primitives: 'ui/',
  tokens: 'tokens.css',
  writable: { include: ['**/*.tsx'], exclude: [] },
  branch: { pattern: 'design/{feature}' },
};

// A module whose tool answers with a picture, built from the global symbol
// itself: its server part may load through its own copy of the contract.
const CAMERA = {
  'module.ts': moduleTs(`{
    id: 'camera',
    title: 'Camera',
    server: {},
    claude: {
      tools: {
        shot: { description: 'A picture.', input: z.object({}) },
        say: { description: 'Words.', input: z.object({ word: z.string() }) },
      },
    },
  }`),
  'server.ts': serverTs(`() => ({
    tools: {
      shot: () => ({
        [Symbol.for('truing.tool-image')]: true,
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
        text: 'The frame at /',
      }),
      say: ({ word }) => word,
    },
  })`),
};

async function cameraTools(): Promise<ClaudeTools> {
  const root = writeModules({ camera: CAMERA });
  const modules = await loadModules(root, { modules: ['./camera'] });
  const host = createModuleHost({ modules, root, config });
  await host.start();
  return host.tools;
}

let bridge: Bridge | null = null;
afterEach(async () => {
  await bridge?.close();
  bridge = null;
});

it('answers a tool with a picture as MCP image content', async () => {
  const tools = await cameraTools();
  expect(await tools.call('shot', {})).toEqual({
    content: [
      { type: 'image', data: 'AQID', mimeType: 'image/png' },
      { type: 'text', text: 'The frame at /' },
    ],
  });
});

it('lists and calls the tools through the bridge, only with its token', async () => {
  bridge = await startBridge(
    async () => ({ allow: false }),
    await cameraTools(),
  );
  const { url, token } = bridge.address;
  const post = (where: string, body: unknown, key = token) =>
    fetch(`${url}${where}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
  expect((await post('/tools/list', {}, 'wrong')).status).toBe(401);
  expect(await (await post('/tools/list', {})).json()).toEqual({
    tools: [
      expect.objectContaining({ name: 'shot', description: 'A picture.' }),
      expect.objectContaining({ name: 'say' }),
    ],
  });
  expect(
    await (
      await post('/tools/call', { name: 'say', arguments: { word: 'hi' } })
    ).json(),
  ).toEqual({ content: [{ type: 'text', text: 'hi' }] });
});

function mcp(env: Record<string, string>) {
  const child = spawn(process.execPath, [MCP_SERVER], {
    env: { PATH: process.env.PATH, ...env },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const lines = createInterface({ input: child.stdout });
  const waiting = new Map<number, (value: unknown) => void>();
  lines.on('line', (line) => {
    const message = JSON.parse(line) as { id: number; result: unknown };
    waiting.get(message.id)?.(message.result);
  });
  let id = 0;
  const call = (method: string, params?: unknown): Promise<unknown> =>
    new Promise((resolve) => {
      id += 1;
      waiting.set(id, resolve);
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
      );
    });
  return { call, stop: () => child.kill() };
}

it('gives a Claude session the modules’ tools after the prompt tool, and runs them', async () => {
  bridge = await startBridge(
    async () => ({ allow: false }),
    await cameraTools(),
  );
  const server = mcp({
    TRUING_BRIDGE_URL: bridge.address.url,
    TRUING_BRIDGE_TOKEN: bridge.address.token,
  });
  try {
    const listed = (await server.call('tools/list')) as {
      tools: { name: string }[];
    };
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      'approve',
      'shot',
      'say',
    ]);
    expect(
      await server.call('tools/call', { name: 'shot', arguments: {} }),
    ).toEqual({
      content: [
        { type: 'image', data: 'AQID', mimeType: 'image/png' },
        { type: 'text', text: 'The frame at /' },
      ],
    });
    expect(
      await server.call('tools/call', { name: 'nothing', arguments: {} }),
    ).toMatchObject({ isError: true });
  } finally {
    server.stop();
  }
});
