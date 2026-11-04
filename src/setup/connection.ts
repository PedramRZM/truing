// Is Claude Code ready? Three real checks, in the order a person would fix
// them. Truing only ever runs the person's own unmodified `claude`: it never
// reads a credential, never asks for one, and sign-in is Claude Code's own.
import { spawn } from 'node:child_process';
import os from 'node:os';

import { z } from 'zod';

import { type RunClaude, runClaude } from '../claude/cli';
import { sessionEnv } from '../claude/session';

export type Check = { ok: boolean; detail: string | null };

export type Connection = {
  installed: Check;
  signedIn: Check;
  responds: Check;
  ok: boolean;
  /** The next thing to do, in a sentence, when something failed. */
  problem: string | null;
  /** The command that fixes it, when one does. */
  command: string | null;
};

const statusSchema = z.object({
  loggedIn: z.boolean(),
  authMethod: z.string().optional(),
  subscriptionType: z.string().optional(),
});

const resultSchema = z.object({
  is_error: z.boolean().optional(),
  result: z.string().optional(),
});

const INSTALL = 'npm install -g @anthropic-ai/claude-code';
const SIGN_IN = 'claude auth login';

function capitalised(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/** How you're signed in, without the email `auth status` also prints. */
function signedInAs(status: z.infer<typeof statusSchema>): string {
  if (status.subscriptionType) {
    return `Claude ${capitalised(status.subscriptionType)} plan`;
  }
  return status.authMethod
    ? `Signed in with ${status.authMethod}`
    : 'Signed in';
}

function outputOf(error: unknown): string {
  return error instanceof Error && 'stdout' in error
    ? String(error.stdout)
    : '';
}

/** Words for a failed round trip. Claude Code's own message when it's clear. */
export function roundTripProblem(text: string): {
  problem: string;
  command: string | null;
} {
  if (/organi[sz]ation has disabled/i.test(text)) {
    return {
      problem:
        'Your organisation has turned off Claude Code on subscriptions. Ask its admin to allow it.',
      command: null,
    };
  }
  if (/login|log in|authenticat|not logged/i.test(text)) {
    return { problem: 'Your Claude sign-in has expired.', command: SIGN_IN };
  }
  if (/rate limit|usage limit|limit reached|quota/i.test(text)) {
    return {
      problem:
        "You've reached your Claude usage limit. Try again when it resets.",
      command: null,
    };
  }
  return {
    problem:
      "Claude Code didn't answer. Run claude in a terminal to see what it says.",
    command: 'claude',
  };
}

export async function checkConnection(
  run: RunClaude = runClaude,
  options: { dropEnv?: readonly string[] } = {},
): Promise<Connection> {
  // A neutral folder: this says nothing about any project's settings.
  const launch = { cwd: os.tmpdir(), env: sessionEnv(options.dropEnv) };
  const notRun: Check = { ok: false, detail: null };

  let version: string;
  try {
    const { stdout } = await run(['--version'], launch);
    version = stdout.trim().split(' ')[0] ?? stdout.trim();
  } catch {
    return {
      installed: { ok: false, detail: null },
      signedIn: notRun,
      responds: notRun,
      ok: false,
      problem: "Claude Code isn't installed on this computer.",
      command: INSTALL,
    };
  }
  const installed: Check = { ok: true, detail: version };

  // `auth status` exits 1 when signed out, and still prints its answer.
  const statusText = await run(['auth', 'status', '--json'], launch).then(
    (result) => result.stdout,
    outputOf,
  );
  let status: z.infer<typeof statusSchema> | null = null;
  try {
    const parsed = statusSchema.safeParse(JSON.parse(statusText));
    status = parsed.success ? parsed.data : null;
  } catch {
    status = null;
  }
  if (!status?.loggedIn) {
    return {
      installed,
      signedIn: { ok: false, detail: null },
      responds: notRun,
      ok: false,
      problem: "You're not signed in to Claude Code yet.",
      command: SIGN_IN,
    };
  }
  const signedIn: Check = { ok: true, detail: signedInAs(status) };

  const started = Date.now();
  // What comes back when the wait runs out: execFile's `killed`.
  const timedOut = (error: unknown): boolean =>
    error instanceof Error && 'killed' in error && Boolean(error.killed);
  const answer = await run(
    [
      '-p',
      '--model',
      'haiku',
      '--tools',
      '',
      '--setting-sources',
      'user',
      '--strict-mcp-config',
      '--no-session-persistence',
      '--output-format',
      'json',
      'Reply with the single word: ready',
    ],
    launch,
  ).then(
    (result) => ({ ok: true as const, text: result.stdout }),
    (error: unknown) => ({
      ok: false as const,
      timedOut: timedOut(error),
      text: `${outputOf(error)} ${error instanceof Error ? error.message : ''}`,
    }),
  );
  if (!answer.ok && answer.timedOut) {
    return {
      installed,
      signedIn,
      responds: { ok: false, detail: null },
      ok: false,
      problem: "Claude Code didn't answer in time. Check again in a moment.",
      command: null,
    };
  }

  let reply: z.infer<typeof resultSchema> | null = null;
  if (answer.ok) {
    try {
      const parsed = resultSchema.safeParse(JSON.parse(answer.text));
      reply = parsed.success ? parsed.data : null;
    } catch {
      reply = null;
    }
  }
  if (!reply || reply.is_error || !reply.result?.trim()) {
    const { problem, command } = roundTripProblem(reply?.result ?? answer.text);
    return {
      installed,
      signedIn,
      responds: { ok: false, detail: null },
      ok: false,
      problem,
      command,
    };
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  return {
    installed,
    signedIn,
    responds: { ok: true, detail: `Answered in ${seconds} s` },
    ok: true,
    problem: null,
    command: null,
  };
}

/**
 * Hands sign-in to Claude Code in the terminal Truing runs in. The browser it
 * opens and anything it asks for are between the person and Claude Code: this
 * process sees none of it, which is why stdio is inherited and never read.
 */
export function startSignIn(dropEnv?: readonly string[]): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['auth', 'login'], {
      stdio: 'inherit',
      env: sessionEnv(dropEnv),
    });
    // No binary: the connection check says so with the install command.
    child.once('error', () => resolve());
    // Finished or cancelled, the connection check is what says which.
    child.once('close', () => resolve());
  });
}
