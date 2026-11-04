// Asks Claude Code what it loads, so Truing never has to copy its rules.
// `/context` runs without a model call. Its init event lists the skills, agents,
// plugins and servers, and its answer lists the files. An InstructionsLoaded hook
// can't: Claude exits without waiting for its hooks, so a quick run reported 3 of
// its 5 files (TRU-5.1).
import { z } from 'zod';

import { isLoggedIn, type RunClaude, runClaude } from '../../claude/cli';
import {
  prepareSession,
  type PreparedSession,
  SESSION_ARGS,
  sessionEnv,
} from '../../claude/session';

const initSchema = z.object({
  type: z.literal('system'),
  subtype: z.literal('init'),
  claude_code_version: z.string().optional(),
  model: z.string().optional(),
  apiKeySource: z.string().optional(),
  skills: z.array(z.string()).optional(),
  agents: z.array(z.string()).optional(),
  plugins: z.array(z.object({ name: z.string() })).optional(),
  mcp_servers: z
    .array(z.object({ name: z.string(), status: z.string().optional() }))
    .optional(),
});

const resultSchema = z.object({
  type: z.literal('result'),
  result: z.string(),
});

export type LoadedFile = {
  file: string;
  /** Claude Code's own memory for this project, not a file of the project's. */
  autoMemory: boolean;
};

export type ClaudeReport = {
  version: string;
  model: string;
  apiKeySource: string;
  skills: string[];
  agents: string[];
  plugins: string[];
  mcpServers: { name: string; status: string | null }[];
  /** From `claude auth status`; null when it couldn't say. */
  loggedIn: boolean | null;
  /** Claude ignores the project's allow rules until the folder is trusted. */
  untrusted: boolean;
  /** The files it loads at the start. Empty if its answer didn't list them. */
  files: LoadedFile[];
};

export type ClaudeAnswer =
  { ok: true; report: ClaudeReport } | { ok: false; problem: string };

function jsonLines(text: string): unknown[] {
  return text.split('\n').flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as unknown];
    } catch {
      return [];
    }
  });
}

/**
 * The rows of `/context`'s Memory Files table: `| Type | Path | Tokens |`. Text
 * meant for people, so a change in its shape gives no rows, and the tab falls
 * back to the project's files and says so.
 */
export function memoryFiles(context: string): LoadedFile[] {
  const section = /^#+\s*Memory Files\s*$([\s\S]*?)(?=^#+\s|(?![\s\S]))/m.exec(
    context,
  )?.[1];
  if (section === undefined) return [];
  return section.split('\n').flatMap((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    const [type, file] = [cells[1], cells[2]];
    if (!type || !file?.startsWith('/')) return [];
    return [{ file, autoMemory: type === 'AutoMem' }];
  });
}

/** Reads a run's output. */
export function parseAnswer(
  stdout: string,
  stderr = '',
  loggedIn: boolean | null = null,
): ClaudeAnswer {
  const lines = jsonLines(stdout);
  const init = lines.flatMap((line) => {
    const parsed = initSchema.safeParse(line);
    return parsed.success ? [parsed.data] : [];
  })[0];
  if (!init) {
    return { ok: false, problem: "Claude Code didn't say what it loaded." };
  }
  const context = lines.flatMap((line) => {
    const parsed = resultSchema.safeParse(line);
    return parsed.success ? [parsed.data.result] : [];
  })[0];

  return {
    ok: true,
    report: {
      version: init.claude_code_version ?? 'unknown',
      model: init.model ?? 'unknown',
      apiKeySource: init.apiKeySource ?? 'unknown',
      skills: init.skills ?? [],
      agents: init.agents ?? [],
      plugins: (init.plugins ?? []).map((plugin) => plugin.name),
      mcpServers: (init.mcp_servers ?? []).map((server) => ({
        name: server.name,
        status: server.status ?? null,
      })),
      loggedIn,
      untrusted: /has not been trusted/.test(stderr),
      files: memoryFiles(context ?? ''),
    },
  };
}

function problemOf(error: unknown): string {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    return "Couldn't find Claude Code on this computer. Install it or add it to your PATH.";
  }
  if (error instanceof Error && 'killed' in error && error.killed) {
    return "Claude Code didn't answer in time.";
  }
  return 'Claude Code stopped before answering. Run claude in a terminal to see why.';
}

/**
 * Starts Claude Code the way a session would, for one free command. With the
 * config it takes a design session's own flags, so the configuration view reports what
 * a session loads. Setup can run before a project has a config, and then
 * there's no design session to speak of, only Claude Code in that folder.
 */
export async function askClaude(
  root: string,
  options: {
    config?: Parameters<typeof prepareSession>[0]['config'];
    dropEnv?: readonly string[];
    run?: RunClaude;
  } = {},
): Promise<ClaudeAnswer> {
  const run = options.run ?? runClaude;
  let session: PreparedSession | null = null;
  try {
    session = options.config
      ? await prepareSession({ root, config: options.config })
      : null;
    const launch = {
      cwd: root,
      env: session?.env ?? sessionEnv(options.dropEnv),
    };
    const [{ stdout, stderr }, loggedIn] = await Promise.all([
      run(
        [
          '-p',
          ...(session?.args ?? SESSION_ARGS),
          '--no-session-persistence',
          '--output-format',
          'stream-json',
          '--verbose',
          '/context',
        ],
        launch,
      ),
      isLoggedIn(run, launch),
    ]);
    return parseAnswer(stdout, stderr, loggedIn);
  } catch (error) {
    return { ok: false, problem: problemOf(error) };
  } finally {
    await session?.dispose();
  }
}
