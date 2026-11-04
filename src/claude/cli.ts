// Running `claude` for a quick answer: what it loaded, whether it's signed in.
// A chat turn streams, so it has its own runner (modules/claude/run.ts).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { z } from 'zod';

const exec = promisify(execFile);

const TIMEOUT_MS = 30_000;

export type RunClaude = (
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string }>;

export const runClaude: RunClaude = async (args, { cwd, env }) => {
  const running = exec('claude', [...args], {
    cwd,
    env,
    timeout: TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });
  // It waits three seconds for input on an open stdin.
  running.child.stdin?.end();
  const { stdout, stderr } = await running;
  return { stdout, stderr };
};

const authSchema = z.object({ loggedIn: z.boolean() });

/**
 * Whether Claude Code is signed in. Its init event reports `apiKeySource: none`
 * either way. `auth status` exits 1 when signed out, and still prints its answer.
 * Only this one field is read: the rest holds the person's email.
 */
export async function isLoggedIn(
  run: RunClaude,
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<boolean | null> {
  const stdout = await run(['auth', 'status', '--json'], options).then(
    (result) => result.stdout,
    (error: unknown) =>
      error instanceof Error && 'stdout' in error ? String(error.stdout) : '',
  );
  try {
    const parsed = authSchema.safeParse(JSON.parse(stdout));
    return parsed.success ? parsed.data.loggedIn : null;
  } catch {
    return null;
  }
}

const initModel = z.object({
  type: z.literal('system'),
  subtype: z.literal('init'),
  model: z.string(),
});

/** `claude-opus-5-5` as a person says it, `Opus 5.5`; null if it isn't that shape. */
export function modelName(id: string): string | null {
  const match = /^claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(
    id,
  );
  const [, family, major, minor] = match ?? [];
  if (!family || !major) return null;
  const name = `${family.charAt(0).toUpperCase()}${family.slice(1)}`;
  return `${name} ${minor ? `${major}.${minor}` : major}`;
}

/**
 * What each model alias means today, in Claude Code's own word, so the menu never
 * goes out of date. `/context` costs no model call. One it can't name keeps its
 * alias in the menu.
 */
export async function askModels<M extends string>(
  run: RunClaude,
  models: readonly M[],
  options: { args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv },
): Promise<Partial<Record<M, string>>> {
  const named = await Promise.all(
    models.map(async (model) => {
      const stdout = await run(
        [
          '-p',
          ...options.args,
          '--no-session-persistence',
          '--output-format',
          'stream-json',
          '--verbose',
          '--model',
          model,
          '/context',
        ],
        options,
      ).then(
        (result) => result.stdout,
        () => '',
      );
      for (const line of stdout.split('\n')) {
        try {
          const init = initModel.safeParse(JSON.parse(line));
          if (init.success) {
            const name = modelName(init.data.model);
            return name ? [[model, name] as const] : [];
          }
        } catch {
          // Not an event.
        }
      }
      return [];
    }),
  );
  return Object.fromEntries(named.flat()) as Partial<Record<M, string>>;
}
