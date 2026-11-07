// TRU-10.10: people usually have their app running before they open Truing, and
// some start commands can't run under Truing at all (a turborepo whose interactive
// tasks need a terminal). Truing finds a server the person started with the
// project's start command, on any port, and can wait for one they start themselves.
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  ChooseServerError,
  commandWords,
  ensureApp,
  findFreePort,
  runningServers,
  TRUING_HEADER,
  waitForApp,
} from '../../src/app-process';
import { loadProfile, saveProfile } from '../../src/setup/profile';
import { startSetupServer } from '../../src/setup/server';

const children: ChildProcess[] = [];

afterEach(() => {
  for (const child of children.splice(0)) child.kill();
});

function temp(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'truing-running-'));
}

/**
 * A project whose start command is `node serve.mjs`. Run with a port, it is the
 * person's own server; run by Truing, without one, it leaves a mark.
 */
function project(dir = temp()): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'serve.mjs'),
    `import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
const [port, status = '200', type = 'text/html', header] = process.argv.slice(2);
if (!port) writeFileSync('ran', '');
createServer((q, s) => {
  if (header) s.setHeader(header, '1');
  s.writeHead(Number(status), { 'content-type': type });
  s.end('<p>ok</p>');
}).listen(Number(port ?? process.env.PORT), () => console.log('up'));
`,
  );
  return dir;
}

const START = 'node serve.mjs';

/** Runs a server in `cwd` as `node <script> <args>`, as the person would. */
async function run(cwd: string, script: string, ...args: string[]) {
  const running = spawn(process.execPath, [script, ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  children.push(running);
  await new Promise((resolve) => running.stdout?.once('data', resolve));
}

const ran = (root: string): boolean => existsSync(path.join(root, 'ran'));

it('uses the server the person started with the start command, on another port, and runs nothing', async () => {
  const root = project();
  const recorded = await findFreePort(43100);
  const running = await findFreePort(recorded + 1);
  await run(root, 'serve.mjs', String(running));
  const app = await ensureApp({
    root,
    command: START,
    port: recorded,
    log: () => {},
  });
  expect(app.port).toBe(running);
  expect(app.startedByTruing).toBe(false);
  expect(app.moved).toBe(true);
  expect(app.note).toBe(`It was already running on port ${running}.`);
  expect(ran(root)).toBe(false);
});

it('finds it with no port on record', async () => {
  const root = project();
  const running = await findFreePort(43200);
  await run(root, 'serve.mjs', String(running));
  const app = await ensureApp({ root, command: START, log: () => {} });
  expect(app.port).toBe(running);
  expect(app.startedByTruing).toBe(false);
});

it('leaves a server the start command didn’t start alone, such as Storybook', async () => {
  const root = project();
  writeFileSync(
    path.join(root, 'storybook.mjs'),
    `import { createServer } from 'node:http';
createServer((q, s) => { s.setHeader('content-type', 'text/html'); s.end('<p>stories</p>'); })
  .listen(Number(process.argv[2]), () => console.log('up'));
`,
  );
  await run(root, 'storybook.mjs', String(await findFreePort(43300)));
  const port = await findFreePort(43350);
  const app = await ensureApp({ root, command: START, port, log: () => {} });
  expect(app.startedByTruing).toBe(true);
  expect(app.port).toBe(port);
  expect(ran(root)).toBe(true);
  await app.stop();
});

it('doesn’t take an API’s error page for the app', async () => {
  const root = project();
  const api = await findFreePort(43400);
  await run(root, 'serve.mjs', String(api), '404');
  expect(await runningServers(root, { command: START })).toEqual([]);
});

it('leaves another project’s server alone', async () => {
  const theirs = project();
  const port = await findFreePort(43450);
  await run(theirs, 'serve.mjs', String(port));
  expect(await runningServers(project(), { command: START })).toEqual([]);
});

it('in a monorepo, counts only this app’s folder', async () => {
  const root = temp();
  const web = path.join(root, 'apps/web');
  mkdirSync(web, { recursive: true });
  const admin = project(path.join(root, 'apps/admin'));
  await run(admin, 'serve.mjs', String(await findFreePort(43500)));
  expect(await runningServers(root, { appDir: web, command: START })).toEqual(
    [],
  );
});

it('never counts a Truing’s own servers, which work in the project too', async () => {
  const root = project();
  await run(
    root,
    'serve.mjs',
    String(await findFreePort(43550)),
    '200',
    'text/html',
    TRUING_HEADER,
  );
  expect(await runningServers(root)).toEqual([]);
});

it('does not guess between two servers the start command started, and runs nothing', async () => {
  const root = project();
  const first = await findFreePort(43600);
  const second = await findFreePort(first + 1);
  await run(root, 'serve.mjs', String(first));
  await run(root, 'serve.mjs', String(second));
  const started = ensureApp({ root, command: START, log: () => {} });
  await expect(started).rejects.toThrow(ChooseServerError);
  await expect(started).rejects.toThrow(
    `This project runs servers on ports ${first} and ${second}. Set the app's port to one of them.`,
  );
  expect(ran(root)).toBe(false);
});

it('waits for a server the person starts themselves, however they start it', async () => {
  const root = project();
  const port = await findFreePort(43700);
  const waiting = waitForApp({
    root,
    signal: AbortSignal.timeout(20_000),
    log: () => {},
  });
  setTimeout(() => void run(root, 'serve.mjs', String(port)), 500);
  const app = await waiting;
  expect(app.port).toBe(port);
  expect(app.startedByTruing).toBe(false);
});

it('while waiting, takes the port on record over the project’s other servers', async () => {
  const root = project();
  const other = await findFreePort(43750);
  const recorded = await findFreePort(other + 1);
  await run(root, 'serve.mjs', String(other));
  await run(root, 'serve.mjs', String(recorded));
  const app = await waitForApp({
    root,
    port: recorded,
    signal: AbortSignal.timeout(20_000),
    log: () => {},
  });
  expect(app.port).toBe(recorded);
});

it('while waiting, never takes a page server that was running before, such as Storybook', async () => {
  const root = project();
  writeFileSync(
    path.join(root, 'storybook.mjs'),
    `import { createServer } from 'node:http';
createServer((q, s) => { s.setHeader('content-type', 'text/html'); s.end('<p>stories</p>'); })
  .listen(Number(process.argv[2]), () => console.log('up'));
`,
  );
  await run(root, 'storybook.mjs', String(await findFreePort(43800)));
  const port = await findFreePort(43850);
  const waiting = waitForApp({
    root,
    command: START,
    signal: AbortSignal.timeout(20_000),
    log: () => {},
  });
  setTimeout(() => void run(root, 'serve.mjs', String(port)), 1500);
  expect((await waiting).port).toBe(port);
});

it('while waiting, takes at once a server the start command had already started', async () => {
  const root = project();
  const port = await findFreePort(43900);
  await run(root, 'serve.mjs', String(port));
  const app = await waitForApp({
    root,
    command: START,
    signal: AbortSignal.timeout(20_000),
    log: () => {},
  });
  expect(app.port).toBe(port);
});

/** Setup's server for a saved project, as the start screen calls it. */
async function setupFor(root: string, port: number) {
  const env = { ...process.env, TRUING_HOME: temp() };
  saveProfile(
    {
      root,
      framework: { name: 'Next.js', version: null },
      evidence: {},
      config: {
        name: 'shop',
        app: { devCommand: START, port },
        source: 'src',
        writable: { include: ['src/**'], exclude: [] },
      },
    },
    env,
  );
  const ok = { ok: true, detail: null };
  const server = await startSetupServer({
    from: root,
    assets: { js: '', css: '' },
    env,
    check: async () => ({
      installed: ok,
      signedIn: ok,
      responds: ok,
      ok: true,
      problem: null,
      command: null,
    }),
  });
  const page = await (await fetch(server.url)).text();
  const token = /name="truing-token" content="([^"]+)"/.exec(page)?.[1] ?? '';
  const open = (signal?: AbortSignal) =>
    fetch(`${server.url}/api/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-truing-token': token },
      body: JSON.stringify({ root, self: true }),
      ...(signal ? { signal } : {}),
    });
  return { server, env, open };
}

it('setup waits for the app the person starts, opens it and keeps its port', async () => {
  const root = project();
  const recorded = await findFreePort(44000);
  const own = await findFreePort(recorded + 1);
  const { server, env, open } = await setupFor(root, recorded);
  try {
    const response = await open();
    setTimeout(() => void run(root, 'serve.mjs', String(own)), 500);
    const lines = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string; port?: number });
    expect(lines.at(-1)).toMatchObject({ type: 'up', port: own });
    expect((await server.result).app?.port).toBe(own);
    expect(loadProfile(root, env)?.config.app.port).toBe(own);
    expect(ran(root)).toBe(false);
  } finally {
    await server.close();
  }
});

it('setup forgets a wait the window gave up on', async () => {
  const root = project();
  const recorded = await findFreePort(44100);
  const { server, env, open } = await setupFor(root, recorded);
  try {
    const gone = new AbortController();
    const response = await open(gone.signal);
    expect(response.ok).toBe(true);
    gone.abort();
    await run(root, 'serve.mjs', String(await findFreePort(recorded + 1)));
    const settled = await Promise.race([
      server.result.then(() => 'opened'),
      new Promise((resolve) => setTimeout(() => resolve('still'), 2500)),
    ]);
    expect(settled).toBe('still');
    expect(loadProfile(root, env)?.config.app.port).toBe(recorded);
  } finally {
    await server.close();
  }
});

it('stops waiting when asked, even between looks', async () => {
  const controller = new AbortController();
  const waiting = waitForApp({
    root: project(),
    signal: controller.signal,
    log: () => {},
  });
  setTimeout(() => controller.abort(), 300);
  await expect(waiting).rejects.toThrow(/abort/i);
});

it('reads a command the way a process lists it', () => {
  expect(commandWords('pnpm run dev')).toEqual(['pnpm', 'dev']);
  expect(commandWords('PORT=3000 pnpm dev')).toEqual(['pnpm', 'dev']);
  expect(
    commandWords(
      '/home/a/.local/share/pnpm/.tools/pnpm-exe/10.27.0/pnpm dev -p 3005',
    ),
  ).toEqual(['pnpm', 'dev', '-p', '3005']);
  expect(
    commandWords('node /usr/lib/node_modules/npm/bin/npm-cli.js run dev'),
  ).toEqual(['node', 'npm', 'dev']);
  expect(commandWords('turbo run start:dev')).toEqual([
    'turbo',
    'run',
    'start:dev',
  ]);
});
