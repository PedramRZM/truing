#!/usr/bin/env node
// Truing's MCP server for a Claude session (TRU-5.2, from TRU-1.2): stdio, no
// dependencies. It holds the permission prompt tool, which asks the designer
// through the bridge, and lists and calls every module's Claude tools there
// (TRU-12.1). Its token reaches it only
// through the session's MCP config, never Claude's environment, and can ask a
// prompt but never answer one. With no bridge to ask, every call is denied.
import { request } from 'node:http';
import { createInterface } from 'node:readline';

const BRIDGE = process.env.TRUING_BRIDGE_URL;
const TOKEN = process.env.TRUING_BRIDGE_TOKEN;

const TOOLS = [
  {
    name: 'approve',
    description:
      'The permission prompt tool. Claude Code calls it when a tool call needs approval; it asks the designer in Truing. Not for calling directly.',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: { type: 'string' },
        input: { type: 'object' },
        tool_use_id: { type: 'string' },
      },
      required: ['tool_name', 'input'],
    },
  },
];

const DENY = {
  behavior: 'deny',
  message: "Truing couldn't ask the designer, so this was refused.",
};

const send = (message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);

/**
 * A POST to the bridge, and its JSON reply, or null. Node's own client, as `fetch`
 * gives up on a reply after five minutes, which answered no for a designer who was
 * still deciding (TRU-5.3). This one waits for as long as the connection lasts.
 */
function post(path, body) {
  if (!BRIDGE || !TOKEN) return Promise.resolve(null);
  return new Promise((resolve) => {
    const asking = request(
      `${BRIDGE}${path}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'content-type': 'application/json',
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('error', () => resolve(null));
        response.on('end', () => {
          try {
            resolve(response.statusCode === 200 ? JSON.parse(body) : null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    asking.on('error', () => resolve(null));
    asking.end(JSON.stringify(body));
  });
}

/** The reply is the bridge's, as it holds the rule on what an allow may carry. */
async function approve(args) {
  return (await post('/permission', args)) ?? DENY;
}

/** The modules' tools, after the prompt tool, which keeps its name. */
async function moduleTools() {
  const listed = await post('/tools/list', {});
  const tools = Array.isArray(listed?.tools) ? listed.tools : [];
  return tools.filter((tool) => tool?.name !== 'approve');
}

async function handle({ id, method, params }) {
  if (method === 'initialize') {
    send({
      id,
      result: {
        protocolVersion: '2025-11-25',
        capabilities: { tools: {} },
        serverInfo: { name: 'truing', version: '1.0.0' },
      },
    });
    return;
  }
  if (method === 'tools/list') {
    send({ id, result: { tools: [...TOOLS, ...(await moduleTools())] } });
    return;
  }
  if (method === 'tools/call') {
    if (params?.name !== 'approve') {
      const result = await post('/tools/call', {
        name: params?.name,
        arguments: params?.arguments ?? {},
      });
      send({
        id,
        result: result ?? {
          isError: true,
          content: [
            { type: 'text', text: `Truing couldn't run "${params?.name}".` },
          ],
        },
      });
      return;
    }
    const reply = await approve(params.arguments ?? {});
    send({
      id,
      result: { content: [{ type: 'text', text: JSON.stringify(reply) }] },
    });
    return;
  }
  if (method === 'ping') {
    send({ id, result: {} });
    return;
  }
  if (id !== undefined) {
    send({ id, error: { code: -32601, message: `No method ${method}.` } });
  }
}

createInterface({ input: process.stdin })
  .on('line', (line) => {
    if (!line.trim()) return;
    try {
      void handle(JSON.parse(line));
    } catch {
      // Not JSON: nothing to answer.
    }
  })
  // Claude has gone, so a prompt still waiting has nobody to answer: the connection
  // closing takes it off the screen.
  .on('close', () => process.exit(0));
