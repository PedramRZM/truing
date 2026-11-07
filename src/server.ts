import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocket, WebSocketServer } from 'ws';

import { TRUING_HEADER } from './app-process';
import type { ModuleHost } from './module-host';
import {
  type Board,
  DEFAULT_VIEW,
  routeOf,
  MODES,
  type Mode,
  parseMessage,
  runtimeMessageSchema,
  type Session,
  shellMessageSchema,
  type ToRuntime,
  type ToShell,
  type View,
} from './protocol';

export type ShellAssets = {
  html: string;
  js: string;
  css: string;
};

export type TruingServerOptions = {
  session: Session;
  port: number;
  /** The config's `name`. */
  projectName: string;
  /** Whether the project has a token source: the Theme tab says if it doesn't. */
  hasTokens: boolean;
  startRoute: string;
  /** Read on every request, so a rebuilt shell is served without a restart. */
  assets: () => ShellAssets;
  pingEveryMs?: number;
  /** The modules' server side (TRU-1.6). */
  modules: ModuleHost;
  /** Where the board is kept between runs (TRU-14.2); none keeps nothing. */
  board?: { load: () => Board | null; save: (board: Board) => void };
};

export type TruingServer = {
  server: Server;
  /** Tells every open shell to reload, after its bundle was rebuilt. */
  reloadShells: () => void;
  /** Sends a message to every open shell. */
  toShells: (message: ToShell) => void;
  close: () => Promise<void>;
};

type Role = 'runtime' | 'shell';

/**
 * Decides whether a WebSocket upgrade may connect: the right origin for its
 * role and the session's token. Exported for the tests.
 */
export function authorizeUpgrade(
  session: Session,
  request: Pick<IncomingMessage, 'url' | 'headers'>,
): Role | null {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname !== '/ws') {
    return null;
  }

  const role = url.searchParams.get('role');
  const token = url.searchParams.get('token') ?? '';
  const origin = request.headers.origin;

  if (!sameSecret(token, session.token)) {
    return null;
  }

  if (role === 'runtime' && origin === session.appOrigin) {
    return 'runtime';
  }

  if (role === 'shell' && origin === session.shellOrigin) {
    return 'shell';
  }

  return null;
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only Truing's own host names, so a rebinding DNS name can't reach the server. */
export function isAllowedHost(host: string | undefined, port: number): boolean {
  return host === `localhost:${port}` || host === `127.0.0.1:${port}`;
}

export async function startTruingServer(
  options: TruingServerOptions,
): Promise<TruingServer> {
  const { session, port, projectName, hasTokens, startRoute, assets, modules } =
    options;
  const shells = new Set<WebSocket>();
  const runtimes = new Map<
    string,
    { socket: WebSocket; href: string; title: string }
  >();
  const pending = new Map<number, { frame: string; sentAt: number }>();
  let mode: Mode = MODES.interact;
  let view: View = DEFAULT_VIEW;
  let pingId = 0;

  const toShells = (message: ToShell): void => {
    const data = JSON.stringify(message);
    for (const shell of shells) {
      shell.send(data);
    }
  };
  const toRuntime = (socket: WebSocket, message: ToRuntime): void => {
    socket.send(JSON.stringify(message));
  };
  modules.connect({
    toShells,
    toRuntime: (frame, message) => {
      const runtime = runtimes.get(frame);
      if (!runtime) return false;
      toRuntime(runtime.socket, message);
      return true;
    },
  });
  const setMode = (next: Mode): void => {
    mode = next;
    toShells({ type: 'mode', mode });
    for (const { socket } of runtimes.values()) {
      toRuntime(socket, { type: 'mode', mode });
    }
  };

  const server = createServer((request, response) => {
    response.setHeader(TRUING_HEADER, '1');
    if (!isAllowedHost(request.headers.host, port)) {
      response.writeHead(403).end();
      return;
    }

    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    const { html, js, css } = assets();
    const send = (type: string, body: string): void => {
      response
        .writeHead(200, {
          'content-type': `${type}; charset=utf-8`,
          'cache-control': 'no-store',
          // The shell and the app are one site (the app's cookies need that),
          // which would put them on one main thread. This gives the shell its
          // own, so a busy app can't stall the canvas, or the canvas the app.
          'origin-agent-cluster': '?1',
        })
        .end(body);
    };

    switch (pathname) {
      case '/':
        send('text/html', html);
        return;
      case '/shell.js':
        send('text/javascript', js);
        return;
      case '/shell.css':
        send('text/css', css);
        return;
      default:
        response.writeHead(404).end();
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket: Duplex, head) => {
    socket.on('error', () => socket.destroy());
    const role = authorizeUpgrade(session, request);
    if (!role) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) =>
      role === 'shell' ? onShell(ws) : onRuntime(ws),
    );
  });

  // Nothing a module does with a message may throw out of a socket's
  // listener: Node would exit, and every module with it.
  const guard = (run: () => void): void => {
    try {
      run();
    } catch (error) {
      console.error('[truing] a module message failed:', error);
    }
  };

  // A malformed frame or a dropped connection must close that one socket,
  // never crash Truing: without an 'error' listener, ws rethrows.
  const dropOnError = (ws: WebSocket): void => {
    ws.on('error', () => ws.terminate());
  };

  function onShell(ws: WebSocket): void {
    dropOnError(ws);
    shells.add(ws);
    ws.on('close', () => shells.delete(ws));
    ws.on('message', (data) => {
      const message = parseMessage(shellMessageSchema, data.toString());
      if (!message) {
        return;
      }

      switch (message.type) {
        case 'hello':
          ws.send(
            JSON.stringify({
              type: 'welcome',
              mode,
              appOrigin: session.appOrigin,
              projectName,
              hasTokens,
              startRoute,
              board: options.board?.load() ?? null,
              frames: [...runtimes].map(([frame, { href, title }]) => ({
                frame,
                href,
                title,
              })),
              modules: modules.snapshot(),
            } satisfies ToShell),
          );
          return;
        case 'set-mode':
          setMode(message.mode);
          return;
        case 'save-board':
          options.board?.save(message.board);
          return;
        case 'set-view':
          view = message.view;
          for (const { socket } of runtimes.values()) {
            toRuntime(socket, { type: 'view', view });
          }
          return;
        case 'reload':
          // The runtime reloads its own page, so the frame stays on its route.
          for (const frame of message.frames) {
            const runtime = runtimes.get(frame);
            if (runtime) toRuntime(runtime.socket, { type: 'reload' });
          }
          return;
        case 'escape':
          if (mode !== MODES.select) return;
          for (const { socket } of runtimes.values()) {
            toRuntime(socket, { type: 'escape' });
          }
          return;
        case 'module-call':
        case 'module-command':
          guard(() =>
            modules.onShellMessage(message, (answer) =>
              ws.send(JSON.stringify(answer)),
            ),
          );
          return;
      }
    });
  }

  function onRuntime(ws: WebSocket): void {
    dropOnError(ws);
    let frame: string | null = null;

    ws.on('close', () => {
      if (frame && runtimes.get(frame)?.socket === ws) {
        runtimes.delete(frame);
        modules.onRuntimeGone(frame);
        toShells({ type: 'runtime-gone', frame });
      }
    });
    ws.on('message', (data) => {
      const message = parseMessage(runtimeMessageSchema, data.toString());
      if (!message) {
        return;
      }

      switch (message.type) {
        case 'hello':
          frame = message.frame;
          modules.onRuntimeHello(frame, message.probes);
          runtimes.set(frame, {
            socket: ws,
            href: message.href,
            title: message.title,
          });
          toRuntime(ws, { type: 'welcome', mode, view });
          toShells({
            type: 'runtime-hello',
            frame,
            href: message.href,
            title: message.title,
          });
          ping(frame, ws);
          return;
        case 'pong': {
          const sent = pending.get(message.id);
          pending.delete(message.id);
          if (sent) {
            toShells({
              type: 'runtime-ping',
              frame: sent.frame,
              ms: Date.now() - sent.sentAt,
            });
          }
          return;
        }
        case 'location': {
          const entry = runtimes.get(message.frame);
          if (entry?.socket === ws) {
            entry.href = message.href;
            entry.title = message.title;
          }
          toShells(message);
          return;
        }
        case 'mode-request':
          setMode(message.mode);
          return;
        case 'module-report':
        case 'module-result':
        case 'module-failed': {
          // Only the page now in the frame speaks for it: not before its
          // hello, and not an old page's socket after a reload.
          const from = frame;
          if (!from || runtimes.get(from)?.socket !== ws) return;
          guard(() => modules.onRuntimeMessage(from, message));
          return;
        }
        case 'open-in-frame': {
          // A link to another site is not the app's to show.
          const route = routeOf(message.href, session.appOrigin);
          if (route !== null) {
            toShells({ type: 'open-frame', route, from: message.frame });
          }
          return;
        }
        case 'interaction':
        case 'shortcut':
        case 'wheel-zoom':
        case 'context-menu':
        case 'pan-key':
        case 'pan-drag':
          toShells(message);
          return;
      }
    });
  }

  function ping(frame: string, ws: WebSocket): void {
    pingId += 1;
    pending.set(pingId, { frame, sentAt: Date.now() });
    toRuntime(ws, { type: 'ping', id: pingId });
  }

  const pinger = setInterval(() => {
    for (const [frame, { socket }] of runtimes) {
      ping(frame, socket);
    }
  }, options.pingEveryMs ?? 5000);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  return {
    server,
    reloadShells: () => toShells({ type: 'shell-reload' }),
    toShells,
    close: async () => {
      clearInterval(pinger);
      await modules.close();
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
