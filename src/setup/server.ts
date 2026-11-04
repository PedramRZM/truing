// The local server behind the setup screens. Loopback only, with the same Host
// check as Truing's own server, and every call carries the page's token, so
// another site open in the browser can't ask it to run anything.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { statSync } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import path from 'node:path';

import { z } from 'zod';

import { type AppHandle, AppStartError, ensureApp } from '../app-process';
import { loadConfig, type TruingConfig } from '../config';

import { checkConnection, type Connection, startSignIn } from './connection';
import {
  checkedTokens,
  draftProblem,
  draftToConfig,
  foldersOf,
  keepYours,
  pathProblem,
  profileToDraft,
} from './draft';
import { findProjects, listFolder } from './find-projects';
import {
  loadProfile,
  type Profile,
  profileFile,
  saveProfile,
  withAppPort,
} from './profile';
import {
  checkReading,
  type Draft,
  emptyDraft,
  type ReadHandle,
  readProject,
} from './read-project';
import { configText, trustConfig } from './trust';

export type SetupResult = {
  root: string;
  config: TruingConfig;
  app: AppHandle;
};

export type SetupAssets = { js: string; css: string };

export type SetupServer = {
  url: string;
  /** Resolves when a project is running and Truing can open it. */
  result: Promise<SetupResult>;
  close: () => Promise<void>;
};

/** Where the screens start, when it isn't at the beginning. */
export type SetupEntry = {
  /** Read this folder again. */
  reconfigure?: string;
  /** Show this folder's `truing.config.ts`, and run it only if a person agrees. */
  confirm?: string;
  /** Back on the review screen for a saved project whose start command failed. */
  review?: { root: string; problem: string };
};

const rootBody = z.object({ root: z.string().min(1) });
const readBody = rootBody.extend({
  answers: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .optional(),
});
const startBody = rootBody.extend({
  draft: z.custom<Draft>(
    (value) => typeof value === 'object' && value !== null,
  ),
});

const html = (token: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="truing-token" content="${token}" />
    <title>Set up Truing</title>
    <link rel="stylesheet" href="/setup.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/setup.js"></script>
  </body>
</html>
`;

function isFolder(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function sameToken(given: unknown, token: string): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function bodyOf(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}

function sendJson(
  response: ServerResponse,
  value: unknown,
  status = 200,
): void {
  response
    .writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    })
    .end(JSON.stringify(value));
}

/** Newline-delimited JSON: each line is one event for the screen. */
function openStream(response: ServerResponse): (event: unknown) => void {
  response.writeHead(200, {
    'content-type': 'application/x-ndjson',
    'cache-control': 'no-store',
  });
  return (event) => {
    response.write(`${JSON.stringify(event)}\n`);
  };
}

export async function startSetupServer(
  options: {
    /** Where `truing` was run. */
    from: string;
    assets: SetupAssets;
    log?: (line: string) => void;
    check?: () => Promise<Connection>;
    env?: NodeJS.ProcessEnv;
  } & SetupEntry,
): Promise<SetupServer> {
  const { from, assets } = options;
  const env = options.env ?? process.env;
  const log = options.log ?? (() => {});
  const check = options.check ?? (() => checkConnection());
  const token = randomBytes(32).toString('hex');
  // From the system, once it's listening: the Host check below needs to know.
  let port = 0;

  let resolveResult: (result: SetupResult) => void = () => {};
  const result = new Promise<SetupResult>((resolve) => {
    resolveResult = resolve;
  });
  let reading: ReadHandle | null = null;
  /** The config file as it was last put in front of the person. */
  let shownConfig: string | null = null;

  /**
   * Runs the app and hands it to Truing once it answers. A person's confirmation
   * is what saves the project, so it's saved first; a config file in the repository
   * holds its own settings, and saves nothing.
   */
  async function startProject(
    response: ServerResponse,
    root: string,
    config: TruingConfig,
    saved: Pick<Profile, 'framework' | 'evidence' | 'folders' | 'yours'> | null,
  ): Promise<void> {
    const write = openStream(response);
    if (saved) saveProfile({ root, config, ...saved }, env);
    try {
      const app = await ensureApp({
        root,
        command: config.app.devCommand,
        port: config.app.port,
        ...(config.app.dir
          ? { appDir: path.resolve(root, config.app.dir) }
          : {}),
        log: (line) => {
          log(line);
          write({ type: 'log', line });
        },
      });
      // A port learned at the start, or a server that moved, stays for next time.
      const adopted = config.app.port !== app.port;
      const next = adopted ? withAppPort(config, app.port) : config;
      if (saved && adopted) saveProfile({ root, config: next, ...saved }, env);
      write({ type: 'up', port: app.port, moved: app.moved, note: app.note });
      response.end();
      resolveResult({ root, config: next, app });
    } catch (error) {
      write({
        type: 'failed',
        message: error instanceof Error ? error.message : String(error),
        output: error instanceof AppStartError ? error.output.slice(-40) : [],
      });
      response.end();
    }
  }

  const routes: Record<
    string,
    (request: IncomingMessage, response: ServerResponse) => Promise<void>
  > = {
    '/api/state': async (_request, response) => {
      const saved = options.review
        ? loadProfile(options.review.root, env)
        : null;
      shownConfig = options.confirm ? configText(options.confirm) : null;
      sendJson(response, {
        from,
        reconfigure: options.reconfigure ?? null,
        confirm:
          options.confirm && shownConfig !== null
            ? { root: options.confirm, text: shownConfig }
            : null,
        review:
          options.review && saved
            ? {
                root: options.review.root,
                problem: options.review.problem,
                draft: profileToDraft(saved),
              }
            : null,
        profileFolder: path.dirname(profileFile(from, env)),
      });
    },
    '/api/connection': async (_request, response) => {
      sendJson(response, await check());
    },
    '/api/sign-in': async (_request, response) => {
      // Answers once Claude Code's sign-in has ended, however it ended.
      await startSignIn();
      sendJson(response, { ended: true });
    },
    '/api/projects': async (_request, response) => {
      sendJson(response, await findProjects(from, env));
    },
    '/api/folder': async (request, response) => {
      const { root } = rootBody.parse(await bodyOf(request));
      if (!isFolder(root)) {
        sendJson(response, { problem: "That folder doesn't exist." }, 404);
        return;
      }
      sendJson(response, listFolder(root));
    },
    '/api/read': async (request, response) => {
      const { root, answers } = readBody.parse(await bodyOf(request));
      if (!isFolder(root)) {
        sendJson(response, { problem: "That folder doesn't exist." }, 404);
        return;
      }
      const write = openStream(response);
      reading?.cancel();
      reading = readProject(
        root,
        (event) => {
          // Only checked against the folder here. Compiling a token stylesheet
          // would run the project's own Tailwind, before anyone has confirmed
          // anything: `/api/start` does that, once a person has.
          if (event.type === 'done') {
            write({
              type: 'done',
              draft: keepYours(
                checkReading(root, event.reading),
                loadProfile(root, env),
              ),
            });
            return;
          }
          write(event);
        },
        answers ? { answers } : {},
      );
      await reading.finished;
      response.end();
    },
    '/api/read-cancel': async (_request, response) => {
      reading?.cancel();
      reading = null;
      sendJson(response, { cancelled: true });
    },
    '/api/by-hand': async (request, response) => {
      const { root } = rootBody.parse(await bodyOf(request));
      sendJson(response, emptyDraft(root));
    },
    '/api/start': async (request, response) => {
      const { root, draft } = startBody.parse(await bodyOf(request));
      const problem = draftProblem(draft) ?? pathProblem(root, draft);
      if (problem) {
        sendJson(response, { problem }, 400);
        return;
      }
      const checked = await checkedTokens(root, draft);
      const folders = foldersOf(checked);
      await startProject(response, root, draftToConfig(checked), {
        framework: checked.framework,
        evidence: checked.evidence,
        ...(folders ? { folders } : {}),
        ...(checked.yours ? { yours: checked.yours } : {}),
      });
    },
    '/api/open': async (request, response) => {
      const { root } = rootBody.parse(await bodyOf(request));
      const profile = loadProfile(root, env);
      if (!profile) {
        sendJson(
          response,
          { problem: 'This project has no saved setup.' },
          404,
        );
        return;
      }
      await startProject(response, root, profile.config, {
        framework: profile.framework,
        evidence: profile.evidence,
        ...(profile.folders ? { folders: profile.folders } : {}),
        ...(profile.yours ? { yours: profile.yours } : {}),
      });
    },
    '/api/saved-draft': async (request, response) => {
      const { root } = rootBody.parse(await bodyOf(request));
      const profile = loadProfile(root, env);
      if (!profile) {
        sendJson(
          response,
          { problem: 'This project has no saved setup.' },
          404,
        );
        return;
      }
      sendJson(response, profileToDraft(profile));
    },
    '/api/confirm': async (_request, response) => {
      if (!options.confirm) {
        sendJson(response, { problem: 'Nothing to confirm.' }, 400);
        return;
      }
      // Agreeing covers the file as it was shown, not as it may be by now.
      if (shownConfig === null || configText(options.confirm) !== shownConfig) {
        openStream(response)({
          type: 'failed',
          message:
            "This file changed after it was shown, so it wasn't run. Close this window and run truing again to read the new version.",
          output: [],
        });
        response.end();
        return;
      }
      trustConfig(options.confirm, env);
      // Loading the file runs it, so this is the first time it does.
      const { config } = await loadConfig(options.confirm);
      await startProject(response, options.confirm, config, null);
    },
  };

  const server: Server = createServer((request, response) => {
    const allowed =
      request.headers.host === `localhost:${port}` ||
      request.headers.host === `127.0.0.1:${port}`;
    if (!allowed) {
      response.writeHead(403).end();
      return;
    }

    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    const send = (type: string, body: string): void => {
      response
        .writeHead(200, {
          'content-type': `${type}; charset=utf-8`,
          'cache-control': 'no-store',
        })
        .end(body);
    };
    if (pathname === '/') return send('text/html', html(token));
    if (pathname === '/setup.js') return send('text/javascript', assets.js);
    if (pathname === '/setup.css') return send('text/css', assets.css);

    const route = routes[pathname];
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    if (
      request.method !== 'POST' ||
      !sameToken(request.headers['x-truing-token'], token)
    ) {
      response.writeHead(403).end();
      return;
    }
    route(request, response).catch((error: unknown) => {
      if (response.headersSent) {
        response.end();
        return;
      }
      sendJson(
        response,
        { problem: error instanceof Error ? error.message : String(error) },
        500,
      );
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      port = typeof address === 'object' && address ? address.port : 0;
      resolve();
    });
  });

  return {
    url: `http://localhost:${port}`,
    result,
    close: () =>
      new Promise((resolve) => {
        reading?.cancel();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
