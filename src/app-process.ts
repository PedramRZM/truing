import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { readlink } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import path from 'node:path';
import { promisify, stripVTControlCharacters } from 'node:util';

const run = promisify(execFile);

export type AppHandle = {
  /** True when Truing started the app, and so stops it on exit. */
  startedByTruing: boolean;
  /** Where the app really answers, which may not be the port it was given. */
  origin: string;
  port: number;
  /** It answers on another port than the one on record, which Truing keeps. */
  moved: boolean;
  /** What a person should hear about how it started: who held the port, say. */
  note: string | null;
  /** Everything the dev server printed lately, for saying why it failed. */
  output: () => string[];
  stop: () => Promise<void>;
  /** Synchronous last resort for `process.on('exit')`, when Truing itself crashes. */
  killNow: () => void;
};

export class AppStartError extends Error {
  constructor(
    message: string,
    readonly output: readonly string[],
  ) {
    super(message);
  }
}

/**
 * Anything listening on the app's port counts as the app running. A TCP
 * connect, not an HTTP request: a dev server busy compiling may not answer
 * HTTP for a while, and starting a second one would fail on the port.
 */
export function isAppUp(origin: string): Promise<boolean> {
  const { hostname, port } = new URL(origin);

  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port: Number(port) });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

/** Any HTTP response at all: a dev server's 404 or redirect still means it's running. */
export async function answersHttp(
  origin: string,
  timeoutMs = 15_000,
): Promise<boolean> {
  try {
    await fetch(origin, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
  } catch {
    return false;
  }
}

/** A free port on loopback, chosen by the system. */
export function systemPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' ? address?.port : null;
      probe.close(() =>
        port ? resolve(port) : reject(new Error('No port from the system.')),
      );
    });
  });
}

/** The first port from `from` up that nothing listens on. */
export async function findFreePort(from: number): Promise<number> {
  for (let port = from; port < from + 200; port += 1) {
    const free = await new Promise<boolean>((resolve) => {
      const probe = createServer();
      probe.once('error', () => resolve(false));
      probe.listen(port, () => probe.close(() => resolve(true)));
    });
    if (free && !(await isAppUp(`http://localhost:${port}`))) return port;
  }
  throw new Error(`No free port between ${from} and ${from + 200}.`);
}

export type PortOwner =
  | { kind: 'free' }
  /** This project's own server, so Truing can use it. */
  | { kind: 'ours' }
  /** Another project's server, on the port this one wants. */
  | { kind: 'other'; cwd: string }
  /** Something listens, and the system won't say what. */
  | { kind: 'unknown' };

async function listenerPid(port: number): Promise<number | null> {
  const parse = (text: string): number | null => {
    const found = /(\d+)/.exec(text);
    return found?.[1] ? Number(found[1]) : null;
  };
  try {
    const { stdout } = await run('lsof', [
      '-nP',
      `-iTCP:${port}`,
      '-sTCP:LISTEN',
      '-t',
    ]);
    return parse(stdout);
  } catch {
    // lsof exits 1 when nothing matches, and may not be installed.
  }
  try {
    const { stdout } = await run('ss', ['-ltnpH', `sport = :${port}`]);
    const found = /pid=(\d+)/.exec(stdout);
    return found?.[1] ? Number(found[1]) : null;
  } catch {
    return null;
  }
}

/** The process group a process is in, which is the command's when Truing started it. */
async function groupOf(pid: number): Promise<number | null> {
  try {
    const { stdout } = await run('ps', ['-o', 'pgid=', '-p', String(pid)]);
    const group = Number(stdout.trim());
    return Number.isInteger(group) && group > 0 ? group : null;
  } catch {
    return null;
  }
}

async function cwdOf(pid: number): Promise<string | null> {
  try {
    return await readlink(`/proc/${pid}/cwd`);
  } catch {
    // Not Linux, or not ours to read.
  }
  try {
    const { stdout } = await run('lsof', [
      '-a',
      '-p',
      String(pid),
      '-d',
      'cwd',
      '-Fn',
    ]);
    const line = stdout.split('\n').find((text) => text.startsWith('n'));
    return line ? line.slice(1) : null;
  } catch {
    return null;
  }
}

function real(dir: string): string {
  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
}

/**
 * Who holds a port. Asked before attaching, because a port being busy says
 * nothing about whose server it is: two projects often default to the same one.
 */
export async function portOwner(
  root: string,
  port: number,
  /** In a monorepo, this app's folder: a sibling app's server isn't this one's. */
  appDir?: string,
): Promise<PortOwner> {
  if (!(await isAppUp(`http://localhost:${port}`))) return { kind: 'free' };
  const pid = await listenerPid(port);
  const cwd = pid === null ? null : await cwdOf(pid);
  if (!cwd) return { kind: 'unknown' };
  const there = real(cwd);
  const isIn = (dir: string): boolean => {
    const here = real(dir);
    return there === here || there.startsWith(`${here}${path.sep}`);
  };
  // `next dev apps/web` runs from the root itself, with the app as an argument.
  const ours = appDir ? there === real(root) || isIn(appDir) : isIn(root);
  return ours ? { kind: 'ours' } : { kind: 'other', cwd: there };
}

/** The command with its port changed, for flags and an inline `PORT=`. */
export function commandOnPort(command: string, port: number): string {
  return command
    .replace(/(^|\s)(-p|--port)(\s+|=)\d+/g, `$1$2$3${port}`)
    .replace(/(^|\s)PORT=\d+/g, `$1PORT=${port}`);
}

/** Ports a dev server names in what it prints: `http://localhost:5173/`. */
export function portsInOutput(line: string): number[] {
  const plain = stripVTControlCharacters(line);
  const found = plain.matchAll(
    /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{2,5})/g,
  );
  return [...found].flatMap((match) => (match[1] ? [Number(match[1])] : []));
}

const KEPT_LINES = 200;
const STOP_GRACE_MS = 5000;
/** One try at an answer: a dev server compiling its first page can take a while. */
const HTTP_ATTEMPT_MS = 15_000;

/**
 * Whether what holds a port is the command Truing started: in its process group,
 * or a server running from this project that the command left behind. When the
 * system won't say who holds it, only the port Truing told it to use counts: any
 * other is just a URL it printed, which could be anything's.
 */
async function isOurServer(
  root: string,
  appDir: string | undefined,
  port: number,
  group: number | undefined,
  told: number | undefined,
): Promise<boolean> {
  const pid = await listenerPid(port);
  if (pid === null) return port === told;
  if (group !== undefined && (await groupOf(pid)) === group) return true;
  return (await portOwner(root, port, appDir)).kind === 'ours';
}

/**
 * Starts the app's dev command in the project root unless its own server
 * already answers, then waits until it does. A port is only a hint: one held by
 * another project is left alone, and a server that picks its own port is followed
 * from what it prints. With no port on record, what it prints is all there is.
 * The app counts as running when HTTP answers and the port is really this
 * command's, whatever the command claims.
 */
export async function ensureApp(options: {
  root: string;
  /** The app's own folder, in a monorepo: another app's server isn't this one's. */
  appDir?: string;
  command: string;
  port?: number | undefined;
  timeoutMs?: number;
  log?: (line: string) => void;
}): Promise<AppHandle> {
  const { root, port: recorded } = options;
  const { appDir } = options;
  const log = options.log ?? ((line) => console.log(line));
  const output: string[] = [];
  const originOf = (port: number): string => `http://localhost:${port}`;
  const timeoutMs = options.timeoutMs ?? 240_000;

  const reused = (port: number): AppHandle => {
    log(`[truing] the app is already running at ${originOf(port)}`);
    return {
      startedByTruing: false,
      origin: originOf(port),
      port,
      moved: recorded !== undefined && port !== recorded,
      note: null,
      output: () => output,
      stop: async () => {},
      killNow: () => {},
    };
  };

  const owner: PortOwner =
    recorded === undefined
      ? { kind: 'free' }
      : await portOwner(root, recorded, appDir);
  if (owner.kind === 'ours' && recorded !== undefined) {
    if (await answersHttp(originOf(recorded), timeoutMs)) {
      return reused(recorded);
    }
    throw new AppStartError(
      `This project's server holds port ${recorded}, but it isn't answering. Stop it and try again.`,
      output,
    );
  }

  let wanted = recorded;
  let note: string | null = null;
  if (recorded !== undefined && owner.kind !== 'free') {
    wanted = await findFreePort(recorded + 1);
    const holder =
      owner.kind === 'other' ? owner.cwd : "something Truing can't identify";
    note = `Port ${recorded} is held by ${holder}, so this project started on another one.`;
    log(
      `[truing] port ${recorded} is held by ${holder}, so this project starts on ${wanted}`,
    );
  }
  // The port on record wins over one still written in the command: a server that
  // moved last time has to start in the same place this time.
  const command =
    wanted === undefined
      ? options.command
      : commandOnPort(options.command, wanted);

  log(`[truing] starting the app: ${command}`);
  // Its own process group, so stopping it also stops what it spawned.
  const child = spawn(command, {
    cwd: root,
    shell: true,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Most dev servers read PORT; for the rest, what they print says where they went.
    env:
      wanted === undefined
        ? process.env
        : { ...process.env, PORT: String(wanted) },
  });
  const named = new Set<number>();
  const collect = (chunk: Buffer): void => {
    for (const line of chunk.toString().split('\n')) {
      if (!line.trim()) continue;
      output.push(line);
      if (output.length > KEPT_LINES) output.shift();
      for (const port of portsInOutput(line)) named.add(port);
      log(`[app] ${line}`);
    }
  };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);

  const stop = (): Promise<void> => stopGroup(child);
  const killNow = (): void => {
    try {
      if (child.pid !== undefined) {
        process.kill(-child.pid, 'SIGTERM');
      }
    } catch {
      // Already gone.
    }
  };
  // However Truing's process ends (a crash, a failed test), the dev server
  // it started goes with it: without its parent reading its output, it hangs.
  process.once('exit', killNow);

  const answered = (port: number): AppHandle => {
    log(`[truing] the app is up at ${originOf(port)}`);
    const moved = recorded !== undefined && port !== recorded;
    return {
      startedByTruing: true,
      origin: originOf(port),
      port,
      moved,
      note:
        note ??
        (moved
          ? `It opened on port ${port}, not ${recorded}. Truing uses that from now on.`
          : null),
      output: () => output,
      stop,
      killNow,
    };
  };

  const candidates = (): number[] =>
    wanted === undefined ? [...named] : [wanted, ...named];
  const deadline = Date.now() + timeoutMs;
  const answersInTime = (port: number): Promise<boolean> =>
    answersHttp(
      originOf(port),
      Math.max(1, Math.min(HTTP_ATTEMPT_MS, deadline - Date.now())),
    );
  const verified = async (port: number): Promise<boolean> =>
    (await isAppUp(originOf(port))) &&
    (await isOurServer(root, appDir, port, child.pid, wanted)) &&
    (await answersInTime(port));

  while (Date.now() < deadline) {
    // A shell that ended may have left its server running: only an empty group is over.
    if (hasEnded(child) && !(child.pid && groupIsAlive(child.pid))) {
      // Next refuses to start a second dev server, and says where the first one is.
      for (const port of named) {
        if (
          (await portOwner(root, port, appDir)).kind === 'ours' &&
          (await answersInTime(port))
        ) {
          return reused(port);
        }
      }
      throw new AppStartError(
        child.signalCode
          ? `The start command was stopped by ${child.signalCode}.`
          : `The start command stopped with code ${child.exitCode}.`,
        output,
      );
    }
    for (const port of candidates()) {
      if (await verified(port)) return answered(port);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await stop();
  throw new AppStartError(
    wanted === undefined
      ? "The app didn't say which port it opened on. Add the port to the settings and try again."
      : `The app didn't answer on port ${wanted} in time.`,
    output,
  );
}

/** A process ended by a signal has a `signalCode`, and its `exitCode` stays null. */
function hasEnded(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function groupIsAlive(group: number): boolean {
  try {
    process.kill(-group, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stops the command's whole process group. The shell may be long gone while
 * what it started runs on, so the group is what's waited for, not the shell.
 */
async function stopGroup(child: ChildProcess): Promise<void> {
  const group = child.pid;
  if (group === undefined || !groupIsAlive(group)) return;
  try {
    process.kill(-group, 'SIGTERM');
  } catch {
    return;
  }
  const deadline = Date.now() + STOP_GRACE_MS;
  while (groupIsAlive(group) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  try {
    if (groupIsAlive(group)) process.kill(-group, 'SIGKILL');
  } catch {
    // Already gone.
  }
}
