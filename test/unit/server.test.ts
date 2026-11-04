import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import type { TruingConfig } from '../../src/config';
import { createModuleHost } from '../../src/module-host';
import type { Session } from '../../src/protocol';
import {
  authorizeUpgrade,
  isAllowedHost,
  type TruingServer,
  startTruingServer,
} from '../../src/server';

const session: Session = {
  token: 'a'.repeat(64),
  wsUrl: 'ws://localhost:0/ws',
  appOrigin: 'http://localhost:3000',
  shellOrigin: 'http://localhost:4100',
};

const testConfig: TruingConfig = {
  name: 'test',
  app: { devCommand: 'true', port: 3000 },
  primitives: 'ui/',
  tokens: 'tokens.css',
  writable: { include: ['**'], exclude: [] },
  branch: { pattern: 'design/{feature}' },
};

function upgrade(url: string, origin: string | undefined) {
  return { url, headers: origin ? { origin } : {} };
}

describe('authorizeUpgrade', () => {
  const ok = `/ws?role=runtime&token=${session.token}`;

  it('accepts the runtime from the app origin with the token', () => {
    expect(authorizeUpgrade(session, upgrade(ok, session.appOrigin))).toBe(
      'runtime',
    );
  });

  it('accepts the shell from the shell origin with the token', () => {
    expect(
      authorizeUpgrade(
        session,
        upgrade(`/ws?role=shell&token=${session.token}`, session.shellOrigin),
      ),
    ).toBe('shell');
  });

  it('refuses a wrong or missing token', () => {
    expect(
      authorizeUpgrade(
        session,
        upgrade(`/ws?role=runtime&token=${'b'.repeat(64)}`, session.appOrigin),
      ),
    ).toBeNull();
    expect(
      authorizeUpgrade(session, upgrade('/ws?role=runtime', session.appOrigin)),
    ).toBeNull();
  });

  it('refuses another origin, or none, even with the token', () => {
    expect(
      authorizeUpgrade(session, upgrade(ok, 'http://evil.example')),
    ).toBeNull();
    expect(authorizeUpgrade(session, upgrade(ok, undefined))).toBeNull();
  });

  it('refuses a role from the other role’s origin', () => {
    expect(
      authorizeUpgrade(session, upgrade(ok, session.shellOrigin)),
    ).toBeNull();
    expect(
      authorizeUpgrade(
        session,
        upgrade(`/ws?role=shell&token=${session.token}`, session.appOrigin),
      ),
    ).toBeNull();
  });

  it('refuses any other path', () => {
    expect(
      authorizeUpgrade(
        session,
        upgrade(
          `/other?role=runtime&token=${session.token}`,
          session.appOrigin,
        ),
      ),
    ).toBeNull();
  });
});

describe('isAllowedHost', () => {
  it('allows only loopback names on Truing port', () => {
    expect(isAllowedHost('localhost:4100', 4100)).toBe(true);
    expect(isAllowedHost('127.0.0.1:4100', 4100)).toBe(true);
    expect(isAllowedHost('attacker.example:4100', 4100)).toBe(false);
    expect(isAllowedHost('localhost:3000', 4100)).toBe(false);
    expect(isAllowedHost(undefined, 4100)).toBe(false);
  });
});

function statusFor(port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { host: '127.0.0.1', port, path: '/', headers: { host } },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    request.on('error', reject);
    request.end();
  });
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function open(port: number, role: string, token: string, origin: string) {
  return new WebSocket(
    `ws://127.0.0.1:${port}/ws?role=${role}&token=${token}`,
    { origin },
  );
}

function nextMessage(ws: WebSocket, type: string): Promise<unknown> {
  return new Promise((resolve) => {
    const onMessage = (data: Buffer) => {
      const message: unknown = JSON.parse(data.toString());
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === type
      ) {
        ws.off('message', onMessage);
        resolve(message);
      }
    };
    ws.on('message', onMessage);
  });
}

describe('Truing server', () => {
  let server: TruingServer | null = null;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const ws of sockets) ws.terminate();
    sockets.length = 0;
    await server?.close();
    server = null;
  });

  async function start() {
    const port = await freePort();
    server = await startTruingServer({
      session,
      port,
      projectName: 'test',
      hasTokens: true,
      startRoute: '/',
      assets: () => ({ html: '<p>shell</p>', js: '', css: '' }),
      pingEveryMs: 50,
      modules: createModuleHost({ modules: [], root: '.', config: testConfig }),
    });
    return port;
  }

  it('closes a WebSocket without the token', async () => {
    const port = await start();
    const ws = open(port, 'runtime', 'wrong', session.appOrigin);
    sockets.push(ws);
    const status = await new Promise<number | string>((resolve) => {
      ws.on('unexpected-response', (_request, response) =>
        resolve(response.statusCode ?? 0),
      );
      ws.on('error', (error) => resolve(error.message));
    });
    expect(String(status)).toMatch(/403/);
  });

  it('relays a runtime hello and its pings to the shell', async () => {
    const port = await start();
    const shell = open(port, 'shell', session.token, session.shellOrigin);
    sockets.push(shell);
    await new Promise((resolve) => shell.once('open', resolve));
    shell.send(JSON.stringify({ type: 'hello' }));
    expect(await nextMessage(shell, 'welcome')).toMatchObject({
      projectName: 'test',
      hasTokens: true,
    });

    const runtime = open(port, 'runtime', session.token, session.appOrigin);
    sockets.push(runtime);
    runtime.on('message', (data) => {
      const message: unknown = JSON.parse(data.toString());
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'ping' &&
        'id' in message
      ) {
        runtime.send(JSON.stringify({ type: 'pong', id: message.id }));
      }
    });
    await new Promise((resolve) => runtime.once('open', resolve));
    const hello = nextMessage(shell, 'runtime-hello');
    const ping = nextMessage(shell, 'runtime-ping');
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

    expect(await hello).toMatchObject({
      frame: 'main',
      href: 'http://localhost:3000/',
    });
    expect(await ping).toMatchObject({ frame: 'main' });
  });

  it('drops a socket that sends a malformed frame, and keeps serving', async () => {
    const port = await start();
    const runtime = open(port, 'runtime', session.token, session.appOrigin);
    sockets.push(runtime);
    await new Promise((resolve) => runtime.once('open', resolve));
    const closed = new Promise((resolve) => runtime.once('close', resolve));

    // A frame with a reserved opcode (0x3): the server's ws emits 'error'.
    const raw = (
      runtime as unknown as { _socket: { write: (b: Buffer) => void } }
    )._socket;
    raw.write(Buffer.from([0x83, 0x80, 0, 0, 0, 0]));

    await closed;
    expect(await statusFor(port, `localhost:${port}`)).toBe(200);
  });

  it('serves the shell only to its own host names', async () => {
    const port = await start();
    expect(await statusFor(port, `localhost:${port}`)).toBe(200);
    // fetch drops a custom Host header, so this goes through node:http.
    expect(await statusFor(port, `attacker.example:${port}`)).toBe(403);
  });
});
