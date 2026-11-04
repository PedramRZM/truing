// One Claude Code process: one designer turn, streaming JSON out (TRU-1.2).
import { spawn } from 'node:child_process';

export type RunOptions = {
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** The one line it reads on stdin. */
  input: string;
  onEvent: (event: unknown) => void;
};

export type RunEnd = {
  code: number | null;
  /** Why it never ran: `ENOENT` when Claude Code isn't installed. */
  startError: string | null;
};

export type Run = {
  done: Promise<RunEnd>;
  /** Ends the turn cleanly, as Ctrl-C would. */
  interrupt: () => void;
};

export type StartRun = (options: RunOptions) => Run;

/** How long a turn gets to end by itself once it's asked to. */
const INTERRUPT_MS = 5000;

/** Splits a stream into its lines, and leaves a half line for next time. */
export function lineSplitter(onLine: (line: string) => void) {
  let buffer = '';
  return (chunk: string): void => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.trim()) onLine(line);
    }
  };
}

export const startRun: StartRun = ({ args, cwd, env, input, onEvent }) => {
  const child = spawn('claude', [...args], {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const split = lineSplitter((line) => {
    try {
      onEvent(JSON.parse(line));
    } catch {
      // Not an event: the stream's readers ignore what they don't know.
    }
  });
  child.stdout.setEncoding('utf8').on('data', split);
  // A process that died early closes stdin under the write.
  child.stdin.on('error', () => {});
  child.stdin.end(input);

  let killer: ReturnType<typeof setTimeout> | null = null;
  const done = new Promise<RunEnd>((resolve) => {
    child.once('error', (error: NodeJS.ErrnoException) => {
      resolve({ code: null, startError: error.code ?? error.message });
    });
    child.once('close', (code) => {
      if (killer) clearTimeout(killer);
      resolve({ code, startError: null });
    });
  });

  return {
    done,
    interrupt: () => {
      child.kill('SIGINT');
      killer ??= setTimeout(() => child.kill('SIGTERM'), INTERRUPT_MS);
    },
  };
};
