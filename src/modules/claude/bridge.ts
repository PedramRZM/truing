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
  close: () => Promise<void>;
};

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
          reply(
            200,
            tools
              ? await tools.call(call.name, call.arguments ?? {})
              : {
                  content: [{ type: 'text', text: `No tool "${call.name}".` }],
                  isError: true,
                },
          );
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
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        // A prompt still waiting holds its connection open.
        server.closeAllConnections();
      }),
  };
}
