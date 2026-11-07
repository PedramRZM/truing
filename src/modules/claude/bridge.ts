// What a session's MCP server calls to ask the designer (TRU-5.2, from TRU-1.2). It
// listens on loopback, answers only its own loopback Host, and holds a token of
// its own: the page's token answers prompts over Truing's socket, and this
// one can only ask them.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';

import { z } from 'zod';

import type { BridgeAddress } from '../../claude/session';
import type { ClaudeTools } from '../../module';

const MAX_BODY_BYTES = 1024 * 1024;

const promptSchema = z.object({
  tool_name: z.string(),
  input: z.record(z.string(), z.unknown()),
  tool_use_id: z.string().optional(),
});
export type PermissionPrompt = z.infer<typeof promptSchema>;

/** All the designer can say: an edited input isn't one of the choices. */
export type Decision = { allow: boolean };

export type PermissionReply =
  | { behavior: 'allow'; updatedInput: Record<string, unknown> }
  | { behavior: 'deny'; message: string };

/**
 * What Claude Code gets back. An allow carries the original input and nothing
 * else: Claude Code runs a changed `updatedInput` without running the hooks or
 * the deny rules again (TRU-1.2). A deny must carry a message.
 */
export function permissionReply(
  prompt: PermissionPrompt,
  decision: Decision,
): PermissionReply {
  return decision.allow
    ? { behavior: 'allow', updatedInput: prompt.input }
    : { behavior: 'deny', message: 'The designer said no.' };
}

export type Bridge = {
  address: BridgeAddress;
  /** A new turn: its own budget of tool calls (TRU-18.4). */
  newTurn: () => void;
  close: () => Promise<void>;
};

/** TRU-18.1: how many module tool calls one turn may make before it stops and says so. */
export const TURN_BUDGET = 60;

/** What the person is asked before a tool that changes the app, in words. */
export function actionSummary(tool: string, input: unknown): string {
  const given = typeof input === 'object' && input !== null ? input : {};
  const field = (key: string): string | null => {
    const value: unknown = (given as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  };
  const verb = tool.replace(/_/g, ' ');
  const name = field('name');
  const role = field('role');
  const target = name ? ` the ${role ?? 'element'} "${name}"` : '';
  const text = field('text');
  const typed = text === null ? '' : `: "${text}"`;
  const frame = field('frame');
  const where = frame ? ` in frame ${frame}` : '';
  return `${verb.charAt(0).toUpperCase()}${verb.slice(1)}${target}${where}${typed}`;
}

function bodyOf(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('The request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const callSchema = z.object({
  name: z.string(),
  arguments: z.unknown().optional(),
});

/**
 * `gone` fires when nobody is left to hear the answer. With `tools`, the session's
 * MCP server also lists and calls every module's Claude tools here (TRU-12.1),
 * behind the same Host and token checks.
 */
export async function startBridge(
  ask: (prompt: PermissionPrompt, gone: AbortSignal) => Promise<Decision>,
  tools?: ClaudeTools,
): Promise<Bridge> {
  const token = randomBytes(32).toString('hex');
  let host = '';
  let calls = 0;

  const server = createServer((request, response) => {
    const reply = (status: number, value: unknown): void => {
      response
        .writeHead(status, { 'content-type': 'application/json' })
        .end(JSON.stringify(value));
    };

    // Only the address it gave out, so a rebinding DNS name can't reach it.
    if (request.headers.host !== host) {
      reply(403, { error: 'Forbidden host.' });
      return;
    }
    const given = (request.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!sameSecret(given, token)) {
      reply(401, { error: 'Unauthorised.' });
      return;
    }
    if (request.method === 'POST' && request.url === '/tools/list') {
      reply(200, {
        tools: (tools?.list() ?? []).map(
          ({ module: _module, ...tool }) => tool,
        ),
      });
      return;
    }
    if (request.method === 'POST' && request.url === '/tools/call') {
      void bodyOf(request)
        .then(async (body) => {
          const call = callSchema.parse(JSON.parse(body));
          const refuse = (text: string): void =>
            reply(200, { content: [{ type: 'text', text }], isError: true });
          if (!tools) {
            refuse(`No tool "${call.name}".`);
            return;
          }
          // TRU-18.1: a turn stops at its budget, and says so.
          calls += 1;
          if (calls > TURN_BUDGET) {
            refuse(
              `This turn has used its ${TURN_BUDGET} tool calls. Say what you found, and the person can ask you to go on.`,
            );
            return;
          }
          // TRU-18.1: a tool that changes the app asks the person first, whatever
          // Claude Code's permission mode, as nothing in Claude Code decides it.
          const spec = tools.list().find((tool) => tool.name === call.name);
          if (spec?.asks) {
            const asking = new AbortController();
            response.once('close', () => {
              if (!response.writableEnded) asking.abort();
            });
            const input =
              typeof call.arguments === 'object' && call.arguments !== null
                ? (call.arguments as Record<string, unknown>)
                : {};
            const decision = await ask(
              {
                tool_name: call.name,
                input: {
                  ...input,
                  what: actionSummary(call.name, call.arguments),
                },
              },
              asking.signal,
            ).catch(() => ({ allow: false }));
            if (!decision.allow) {
              refuse(
                'The person said no. Ask them what they would like instead.',
              );
              return;
            }
          }
          reply(200, await tools.call(call.name, call.arguments ?? {}));
        })
        .catch(() => reply(400, { error: 'Bad request.' }));
      return;
    }
    if (request.method !== 'POST' || request.url !== '/permission') {
      reply(404, { error: 'Not found.' });
      return;
    }

    void bodyOf(request)
      .then(async (body) => {
        const prompt = promptSchema.parse(JSON.parse(body));
        const asking = new AbortController();
        response.once('close', () => {
          if (!response.writableEnded) asking.abort();
        });
        // Refused or gone, the answer is no.
        const decision = await ask(prompt, asking.signal).catch(() => ({
          allow: false,
        }));
        reply(200, permissionReply(prompt, decision));
      })
      .catch(() => reply(400, { error: 'Bad request.' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  host = `127.0.0.1:${port}`;

  return {
    address: { url: `http://${host}`, token },
    newTurn: () => {
      calls = 0;
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        // A prompt still waiting holds its connection open.
        server.closeAllConnections();
      }),
  };
}
