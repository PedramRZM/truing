// What only a real Claude session can prove (TRU-5.2), on the project this runs in:
// the init event lists the project's skills and Truing's servers, the project's
// formatter ran on Claude's edit if it has one, its bash guard held, the path guard
// refused writes that looked allowed, and a prompt reached the designer. It spends model usage on
// the person's own seat, so it isn't part of the unit suite, which never starts
// Claude. `pnpm check-claude <a writable .tsx path>`
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
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
const links = ['link', 'dangling'].map((name) =>
  path.join(
    path.dirname(scratch),
    `t225-guard-${name}${path.extname(scratch)}`,
  ),
);
const outside = mkdtempSync(path.join(os.tmpdir(), 'truing-check-outside-'));

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
  // Reading the link's target asks, as it's outside: the write is what's being checked.
  return { allow: prompt.tool_name === 'Read' };
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

  // TRU-5.3: a file Claude can see is off limits passes because Claude declines, before
  // the guard has run. These look like any other file it may write, so only the guard
  // can stop them, and only the guard's own words count as a pass.
  mkdirSync(path.dirname(path.join(root, scratch)), { recursive: true });
  const held = path.join(outside, 'held.tsx');
  const wanted = path.join(outside, 'not-yet.tsx');
  writeFileSync(held, 'untouched\n');
  symlinkSync(held, path.join(root, links[0] ?? ''));
  symlinkSync(wanted, path.join(root, links[1] ?? ''));
  for (const [what, ask, landed] of [
    [
      'a link out of the project',
      // Claude Code writes over a file only once it has read it.
      `Read ${links[0]}, then use the Edit tool to change its word "untouched" to "changed".`,
      () => readFileSync(held, 'utf8') !== 'untouched\n',
    ],
    [
      'a link to nothing out of the project',
      `Use the Write tool to write exactly this text to ${links[1]}: export const a = 1;`,
      () => existsSync(wanted),
    ],
  ] as const) {
    const write = await turn(
      `${ask}\nReport the result, and don't try another way.`,
    );
    const byGuard = toolResults(write).some((text) =>
      /Truing (may change only|won't change)/.test(text),
    );
    report(
      `the path guard refused a write through ${what}`,
      byGuard && !landed(),
      landed()
        ? 'IT LANDED OUTSIDE THE PROJECT'
        : byGuard
          ? 'by the path guard'
          : 'the call never reached the guard, so this proves nothing',
    );
  }

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
  for (const link of links) rmSync(path.join(root, link), { force: true });
  rmSync(outside, { recursive: true, force: true });
  await bridge.close();
}

const failed = results.filter(({ ok }) => !ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
