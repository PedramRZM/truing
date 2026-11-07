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
import {
  actionSummary,
  type Bridge,
  startBridge,
  TURN_BUDGET,
} from '../../src/modules/claude/bridge';

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

// TRU-18.1, TRU-18.4: a tool that changes the app asks the person first, through
// the bridge, whatever Claude Code's permission mode; and a turn has a budget.
const ACTOR = {
  'module.ts': moduleTs(`{
    id: 'actor',
    title: 'Actor',
    server: {},
    claude: {
      tools: {
        push: {
          description: 'Pushes a button.',
          input: z.object({ frame: z.string(), role: z.string(), name: z.string() }),
          asks: true,
        },
        look: { description: 'Looks.', input: z.object({}) },
      },
    },
  }`),
  'server.ts': serverTs(`() => ({
    tools: {
      push: ({ name }) => { globalThis.pushed = (globalThis.pushed ?? 0) + 1; return 'pushed ' + name; },
      look: () => 'looked',
    },
  })`),
};

async function actorBridge(answer: boolean) {
  const root = writeModules({ actor: ACTOR });
  const modules = await loadModules(root, { modules: ['./actor'] });
  const host = createModuleHost({ modules, root, config });
  await host.start();
  const asked: unknown[] = [];
  bridge = await startBridge(async (prompt) => {
    asked.push(prompt);
    return { allow: answer };
  }, host.tools);
  const { url, token } = bridge.address;
  const call = async (name: string, args: unknown) =>
    (await (
      await fetch(`${url}/tools/call`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, arguments: args }),
      })
    ).json()) as { content: Array<{ text: string }>; isError?: boolean };
  return { call, asked };
}

const PUSH = { frame: 'desktop', role: 'button', name: 'Save' };

it('asks the person before a tool that changes the app, in words, and runs it on a yes', async () => {
  const { call, asked } = await actorBridge(true);
  expect(await call('push', PUSH)).toEqual({
    content: [{ type: 'text', text: 'pushed Save' }],
  });
  expect(asked).toEqual([
    {
      tool_name: 'push',
      input: { ...PUSH, what: 'Push the button "Save" in frame desktop' },
    },
  ]);
  expect(await call('look', {})).toEqual({
    content: [{ type: 'text', text: 'looked' }],
  });
  expect(asked).toHaveLength(1);
});

it('runs nothing when the person says no, and tells Claude to ask', async () => {
  delete (globalThis as { pushed?: number }).pushed;
  const { call } = await actorBridge(false);
  const result = await call('push', PUSH);
  expect(result.isError).toBe(true);
  expect(result.content[0]?.text).toMatch(/The person said no/);
  expect((globalThis as { pushed?: number }).pushed ?? 0).toBe(0);
});

it('stops a turn at its budget, and starts the next one fresh', async () => {
  const { call } = await actorBridge(true);
  for (let i = 0; i < TURN_BUDGET; i++) await call('look', {});
  const over = await call('look', {});
  expect(over.isError).toBe(true);
  expect(over.content[0]?.text).toMatch(/used its 60 tool calls/);
  bridge?.newTurn();
  expect((await call('look', {})).isError).toBeUndefined();
});

it('says what a tool will do in the app in plain words', () => {
  expect(
    actionSummary('type_text', {
      frame: 'phone',
      role: 'textbox',
      name: 'Email',
      text: 'a@b.test',
    }),
  ).toBe('Type text the textbox "Email" in frame phone: "a@b.test"');
});
