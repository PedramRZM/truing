// What only a real Claude session can prove (TRU-5.2), on the project this runs in:
// the init event lists the project's skills and Truing's servers, the project's
// formatter ran on Claude's edit if it has one, its bash guard held, a write out of
// bounds was refused, and a prompt reached the designer. It spends model usage on
// the person's own seat, so it isn't part of the unit suite, which never starts
// Claude. `pnpm check-claude <a writable .tsx path>`
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { MCP_SERVER, prepareSession } from '../src/claude/session';
import { findProjectRoot, loadConfig } from '../src/config';
import {
  type PermissionPrompt,
  startBridge,
} from '../src/modules/claude/bridge';

type Event = Record<string, unknown>;

const from = process.env.INIT_CWD ?? process.cwd();
const root = findProjectRoot(from);
const { config } = await loadConfig(root);
const scratch = process.argv[2] ?? 'src/components/t225-session-check.tsx';
const refused = 'package.json';

const results: { check: string; ok: boolean; detail: string }[] = [];
function report(check: string, ok: boolean, detail = ''): void {
  results.push({ check, ok, detail });
  console.log(
    `${ok ? 'pass' : 'FAIL'}  ${check}${detail ? `: ${detail}` : ''}`,
  );
}

const asked: PermissionPrompt[] = [];
const bridge = await startBridge(async (prompt) => {
  asked.push(prompt);
  return { allow: false };
});

async function turn(prompt: string): Promise<Event[]> {
  const session = await prepareSession({
    root,
    config,
    bridge: bridge.address,
  });
  const child = spawn(
    'claude',
    [
      '-p',
      ...session.args,
      '--output-format',
      'stream-json',
      '--verbose',
      '--no-session-persistence',
      '--model',
      'haiku',
      '--effort',
      'low',
      '--max-turns',
      '6',
      prompt,
    ],
    { cwd: root, env: session.env, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  let out = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    out += chunk;
  });
  await new Promise((resolve) => child.on('close', resolve));
  await session.dispose();
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Event);
}

/** What each tool call came back with, as text. */
function toolResults(events: readonly Event[]): string[] {
  return events.flatMap((event) => {
    if (event.type !== 'user') return [];
    const { content } = event.message as { content: unknown };
    return Array.isArray(content)
      ? content.map((block) => JSON.stringify(block))
      : [];
  });
}

try {
  const edit = await turn(
    `Use the Write tool to create ${scratch} with exactly this text: export const a = {"b":    "c"};`,
  );
  const init = edit.find((event) => event.subtype === 'init') as
    | {
        skills: string[];
        mcp_servers: { name: string; status: string }[];
        apiKeySource: string;
        permissionMode: string;
      }
    | undefined;
  report('init event arrives', Boolean(init));
  const skillsOnDisk = existsSync(path.join(root, '.claude/skills'));
  report(
    "lists Truing's design skill",
    Boolean(init?.skills.includes('truing:design-rules')),
  );
  if (skillsOnDisk) {
    report(
      "lists the project's skills",
      Boolean(init && init.skills.length > 1),
      `${init?.skills.length} skills`,
    );
  }
  const server = init?.mcp_servers.find(({ name }) => name === MCP_SERVER);
  report("Truing's MCP server connected", server?.status === 'connected');
  report(
    'runs on the login, with no API key',
    init?.apiKeySource === 'none',
    init?.apiKeySource,
  );
  report(
    'runs in Manual by default, never bypass',
    init?.permissionMode === 'default',
    init?.permissionMode,
  );

  const written = path.join(root, scratch);
  report('Claude wrote an allowed file', existsSync(written));
  if (existsSync(written)) {
    const text = readFileSync(written, 'utf8');
    report(
      "the project's formatter ran on it",
      !text.includes('"b":    "c"'),
      JSON.stringify(text.trim()),
    );
  }

  const guard = await turn(
    `This checks the project's bash guard. Make one Bash call: git clean -f no-such-folder. Report its result.`,
  );
  const blocked = toolResults(guard).some((text) =>
    /guard-bash|Blocked by|denied/.test(text),
  );
  report("the project's bash guard refused a forbidden command", blocked);

  const before = readFileSync(path.join(root, refused), 'utf8');
  const write = await turn(
    `This checks Truing's path guard. Make one Edit call on ${refused}: change its first character to a space. Report the result, and don't try another way.`,
  );
  report(
    'a write out of bounds was refused',
    readFileSync(path.join(root, refused), 'utf8') === before,
    toolResults(write).some((text) => text.includes('Truing may change'))
      ? 'by the path guard'
      : 'Claude declined before the guard',
  );

  await turn(
    `Make one Bash call: node -e "process.exit(0)". Report what happened, and don't try another way.`,
  );
  report(
    'a prompt reached the designer, who said no',
    asked.some(({ tool_name: tool }) => tool === 'Bash'),
    `${asked.length} asked`,
  );
} finally {
  rmSync(path.join(root, scratch), { force: true });
  await bridge.close();
}

const failed = results.filter(({ ok }) => !ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
