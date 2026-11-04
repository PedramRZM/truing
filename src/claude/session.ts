// How Truing starts Claude Code, for any project (TRU-1.2's recommendation).
// One place, so what Claude's configuration view reports is what a session loads. What differs
// between projects comes from `truing.config.ts` and the project's own
// Claude Code files.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { isSafeCheck, isWholeProject, type TruingConfig } from '../config';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Truing's own plugin: its design skill. */
export const PLUGIN_DIR = path.join(here, 'plugin');
export const DESIGN_SKILL = path.join(
  PLUGIN_DIR,
  'skills/design-rules/SKILL.md',
);
const GUARD = path.join(here, 'path-guard.mjs');
const MCP_SERVER_FILE = path.join(here, 'mcp-server.mjs');

export const MCP_SERVER = 'truing';
export const PROMPT_TOOL = `mcp__${MCP_SERVER}__approve`;

/** Next's own dev endpoint: routes and errors (TRU-5.2). */
const NEXT_SERVER = 'next';

/**
 * Leaves the person's settings.json out, so their plugins, servers and helpers
 * don't change what a design session does. Their own CLAUDE.md, rules and auto
 * memory still load. Manual unless the designer chooses otherwise, and never
 * `--bare`.
 */
export const SESSION_ARGS = [
  '--setting-sources',
  'project,local',
  '--permission-mode',
  'manual',
  '--strict-mcp-config',
] as const;

/** Claude Code's own modes, as `--permission-mode` takes them. */
export const PERMISSION_MODES = [
  'manual',
  'acceptEdits',
  'plan',
  'auto',
  'dontAsk',
  'bypassPermissions',
] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

/**
 * The flags for a mode. The designer chooses it for each message. The path guard is a hook, and hooks run in every mode, bypass
 * included.
 */
export function modeArgs(mode: PermissionMode): string[] {
  const args = SESSION_ARGS.map((arg) => (arg === 'manual' ? mode : arg));
  return mode === 'bypassPermissions'
    ? [...args, '--allow-dangerously-skip-permissions']
    : args;
}

/**
 * How long Claude Code waits for an MCP tool, which is how long a prompt can wait for
 * the designer (TRU-5.3).
 */
const PROMPT_WAIT_MS = 24 * 60 * 60 * 1000;

/** Keeps a session on the person's own login, and not nested in another. */
const DROPPED_ENV = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SSE_PORT',
] as const;

/**
 * Where a designer's own rules may go in any project (TRU-17.2): they change every
 * later session, so the design PR flags them for a developer. Claude may write them
 * only when the designer says yes each time, as text from a page could otherwise
 * persist (TRU-5.3). The guard passes them, and the ask rules hold the question.
 */
export const DESIGN_CONFIG_PATHS = [
  '.claude/rules/design-*.md',
  '.claude/skills/design-*/**/*.md',
] as const;

/** Claude never commits or pushes: the designer keeps a turn, and TRU-13.2 commits it. */
const DENIED_SHELL = ['git push', 'git push *', 'git commit', 'git commit *'];

/** What may hold a secret: neither read nor edited. */
const SECRET_FILES = [
  '**/.env',
  '**/.env.*',
  '**/.envrc',
  '**/secrets/**',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/id_rsa*',
  '**/id_ed25519*',
  '**/.npmrc',
  '**/.netrc',
  '**/.aws/**',
  '**/.ssh/**',
];

export const DENIED_READS = [
  ...SECRET_FILES.map((glob) => `Read(${glob})`),
  'Read(**/.git/config)',
];

/** Never written, whatever the writable list says: `neverWritten` holds the rest. */
const NEVER_EDITED = [
  ...SECRET_FILES,
  '**/.git/**',
  '.mcp.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
];

/** The environment for a session; `dropEnv` is what the project's config adds. */
export function sessionEnv(
  dropEnv: readonly string[] = [],
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const kept = { ...env };
  for (const name of [...DROPPED_ENV, ...dropEnv]) {
    delete kept[name];
  }
  return kept;
}

type SessionConfig = Pick<
  TruingConfig,
  'app' | 'claude' | 'primitives' | 'tokens' | 'writable'
>;

const projectSettings = z.object({
  permissions: z.object({ allow: z.array(z.string()).optional() }).optional(),
});

/** The shell rules a project allows for its developers. */
async function projectShellRules(root: string): Promise<string[]> {
  const files = ['.claude/settings.json', '.claude/settings.local.json'];
  const rules = await Promise.all(
    files.map(async (file) => {
      const text = await readFile(path.join(root, file), 'utf8').catch(
        () => null,
      );
      if (text === null) return [];
      try {
        const parsed = projectSettings.safeParse(JSON.parse(text));
        return parsed.success ? (parsed.data.permissions?.allow ?? []) : [];
      } catch {
        // Claude Code can't read it either, so it allows nothing.
        return [];
      }
    }),
  );
  // A bare `Bash` allows every command (TRU-5.3).
  return rules.flat().filter((rule) => /^Bash(\(|$)/.test(rule));
}

/**
 * What runs unasked. Claude Code matches a plain rule whole, so a flag, a variable
 * in front or a second command makes it ask (seen on 2.1.318). A wildcard takes all
 * of those, and `eslint *` ran `-c` on a file Claude had written (TRU-5.3).
 */
function plainChecks(config: SessionConfig): string[] {
  return (config.claude?.shell?.allow ?? []).filter(isSafeCheck);
}

export type SessionPermissions = {
  allow: string[];
  ask: string[];
  deny: string[];
};

/**
 * What a design session may do. The project's allow rules are written for its
 * developers: they let tests, builds and branch switches run unasked, and tests
 * run code Claude just wrote. So every shell rule of the project's asks the
 * designer, unless the config lists it, and only what the config lists runs
 * unasked. An `ask` beats an `allow`, and a `deny` beats both.
 *
 * Bypass is the exception. Claude Code still prompts for an `ask` rule there, so
 * these would keep asking in the one mode the designer chose so it wouldn't.
 * Allow rules do nothing in bypass, so the `ask` rules have nothing left to guard.
 */
export function sessionPermissions(
  config: SessionConfig,
  projectShell: readonly string[],
  hasNext: boolean,
  mode: PermissionMode = 'manual',
): SessionPermissions {
  const allowedShell = plainChecks(config).map((rule) => `Bash(${rule})`);
  return {
    allow: [
      ...config.writable.include.map((glob) => `Edit(${glob})`),
      ...allowedShell,
      ...(hasNext ? [`mcp__${NEXT_SERVER}`] : []),
    ],
    ask:
      mode === 'bypassPermissions'
        ? []
        : [
            ...projectShell.filter((rule) => !allowedShell.includes(rule)),
            ...(config.claude?.shell?.ask ?? []).map((rule) => `Bash(${rule})`),
            // An ask, as the allow list may reach them: full access is `**`.
            ...DESIGN_CONFIG_PATHS.map((glob) => `Edit(${glob})`),
          ],
    deny: [
      ...DENIED_SHELL.map((rule) => `Bash(${rule})`),
      ...config.writable.exclude.map((glob) => `Edit(${glob})`),
      ...DENIED_READS,
      ...NEVER_EDITED.map((glob) => `Edit(${glob})`),
    ],
  };
}

/** Whether the project's app is a Next one: it has a `/_next/mcp` to offer. */
async function usesNext(root: string, config: SessionConfig): Promise<boolean> {
  const file = path.join(root, config.app.dir ?? '.', 'package.json');
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null) return false;
  try {
    const parsed = z
      .object({
        dependencies: z.record(z.string(), z.string()).optional(),
        devDependencies: z.record(z.string(), z.string()).optional(),
      })
      .safeParse(JSON.parse(text));
    return Boolean(
      parsed.success &&
      (parsed.data.dependencies?.next ?? parsed.data.devDependencies?.next),
    );
  } catch {
    return false;
  }
}

/** What a session in this project may do, for the session and the configuration view. */
export async function permissionsFor(
  root: string,
  config: SessionConfig,
): Promise<SessionPermissions> {
  return sessionPermissions(
    config,
    await projectShellRules(root),
    await usesNext(root, config),
  );
}

/** The design skill's text, without its frontmatter. */
function skillBody(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

/** What the path guard holds a write to, for the guard and for Undo. */
export function writableRules(
  root: string,
  config: Pick<TruingConfig, 'writable'>,
): { root: string; include: string[]; exclude: string[] } {
  return {
    root,
    include: [...config.writable.include, ...DESIGN_CONFIG_PATHS],
    exclude: config.writable.exclude,
  };
}

/** What every turn is told: the rules, and this project's facts from its config. */
export async function sessionPrompt(
  config: SessionConfig,
  hasNext = false,
  mode: PermissionMode = 'manual',
): Promise<string> {
  const rules = skillBody(await readFile(DESIGN_SKILL, 'utf8'));
  const shell = plainChecks(config);
  return [
    'You are working in Truing, a visual editor, with a designer, on the running app.',
    rules,
    '## This project',
    `- Tokens: ${config.tokens ?? 'none found; match the styling the code already uses'}`,
    `- Primitives: ${config.primitives ?? 'none found; look at the components near the file you change'}`,
    ...(isWholeProject(config.writable)
      ? [
          "- You may write: any file in the project, except tests, secret files, and Git's and Claude Code's settings",
        ]
      : [
          `- You may write: ${config.writable.include.join(', ')}`,
          `- Never: ${config.writable.exclude.join(', ')}`,
        ]),
    `- When the designer asks you to keep a rule or a skill for later: ${DESIGN_CONFIG_PATHS.join(', ')}. Markdown only, each write asks the designer first, and a skill's frontmatter stays to its name and description.`,
    `- Shell commands that run without asking: ${shell.length > 0 ? shell.join(', ') : 'none'}`,
    ...(hasNext
      ? [
          `- This app runs on Next.js: its dev server's tools (mcp__${NEXT_SERVER}__*) report routes and errors, so use them to find a page or a runtime error.`,
        ]
      : []),
    // The guard refuses it, as it's outside the project, and the designer still sees it.
    ...(mode === 'plan'
      ? [
          "- In Plan mode the designer sees your plan as you write it, and its file isn't saved. That's expected, so don't mention it.",
        ]
      : []),
  ].join('\n\n');
}

/** Where a session's MCP server asks the designer; null when nothing can answer. */
export type BridgeAddress = { url: string; token: string };

export type PreparedSession = {
  /** Every flag for `claude`, after `-p`. Reused for each turn. */
  args: string[];
  env: NodeJS.ProcessEnv;
  permissions: SessionPermissions;
  /** The MCP servers it connects, by the name Claude reports. */
  servers: string[];
  /** Removes its files. */
  dispose: () => Promise<void>;
};

/**
 * Writes one session's settings and MCP config to a private folder outside the
 * project, so a developer's own `claude` here is unchanged.
 */
export async function prepareSession(options: {
  root: string;
  config: SessionConfig;
  bridge?: BridgeAddress | null;
  env?: NodeJS.ProcessEnv;
  /** Manual, asking the designer, unless they chose another. */
  mode?: PermissionMode;
}): Promise<PreparedSession> {
  const { root, config, bridge } = options;
  const hasNext = await usesNext(root, config);
  const permissions = sessionPermissions(
    config,
    await projectShellRules(root),
    hasNext,
    options.mode,
  );
  const dropEnv = config.claude?.dropEnv ?? [];
  const dir = await mkdtemp(path.join(os.tmpdir(), 'truing-claude-'));
  const write = async (name: string, value: unknown): Promise<string> => {
    const file = path.join(dir, name);
    await writeFile(file, JSON.stringify(value, null, 2), { mode: 0o600 });
    return file;
  };

  const rules = await write('writable.json', writableRules(root, config));
  const settings = await write('settings.json', {
    // The person's own helper would beat the subscription.
    apiKeyHelper: '',
    env: Object.fromEntries(dropEnv.map((name) => [name, ''])),
    permissions,
    hooks: {
      PreToolUse: [
        {
          matcher: 'Edit|Write|MultiEdit|NotebookEdit',
          hooks: [
            {
              type: 'command',
              // A hook that fails to start isn't a blocking one: this makes it so.
              command: `${JSON.stringify(process.execPath)} ${JSON.stringify(GUARD)} ${JSON.stringify(rules)} || exit 2`,
              timeout: 10,
            },
          ],
        },
      ],
    },
  });
  const mcp = await write('mcp.json', {
    mcpServers: {
      [MCP_SERVER]: {
        type: 'stdio',
        command: process.execPath,
        args: [MCP_SERVER_FILE],
        env: bridge
          ? {
              TRUING_BRIDGE_URL: bridge.url,
              TRUING_BRIDGE_TOKEN: bridge.token,
            }
          : {},
      },
      ...(hasNext
        ? {
            [NEXT_SERVER]: {
              type: 'http',
              url: `http://localhost:${config.app.port}/_next/mcp`,
            },
          }
        : {}),
    },
  });

  return {
    args: [
      ...modeArgs(options.mode ?? 'manual'),
      '--settings',
      settings,
      '--plugin-dir',
      PLUGIN_DIR,
      '--mcp-config',
      mcp,
      '--permission-prompt-tool',
      PROMPT_TOOL,
      '--append-system-prompt',
      await sessionPrompt(config, hasNext, options.mode),
    ],
    env: {
      ...sessionEnv(dropEnv, options.env),
      MCP_TOOL_TIMEOUT: String(PROMPT_WAIT_MS),
    },
    permissions,
    servers: [MCP_SERVER, ...(hasNext ? [NEXT_SERVER] : [])],
    dispose: () => rm(dir, { recursive: true, force: true }),
  };
}
