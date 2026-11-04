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

/** How long a turn gets at each step of being stopped. */
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

/** One process; the tests start one that isn't Claude, with a short `graceMs`. */
export function startProcess(
  command: string,
  graceMs: number,
  { args, cwd, env, input, onEvent }: RunOptions,
): Run {
  const child = spawn(command, [...args], {
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

  let killers: ReturnType<typeof setTimeout>[] = [];
  const done = new Promise<RunEnd>((resolve) => {
    child.once('error', (error: NodeJS.ErrnoException) => {
      resolve({ code: null, startError: error.code ?? error.message });
    });
    child.once('close', (code) => {
      killers.forEach(clearTimeout);
      resolve({ code, startError: null });
    });
  });

  return {
    done,
    interrupt: () => {
      child.kill('SIGINT');
      if (killers.length > 0) return;
      // Each step asks harder, as a hung run holds every direct edit behind it
      // (TRU-5.3). A dead process's helper can still hold its output, and only the
      // end of that ends the run, so the last step lets go of it.
      killers = [
        () => child.kill('SIGTERM'),
        () => child.kill('SIGKILL'),
        () => child.stdout.destroy(),
      ].map((step, at) => setTimeout(step, graceMs * (at + 1)));
    },
  };
}

export const startRun: StartRun = (options) =>
  startProcess('claude', INTERRUPT_MS, options);
