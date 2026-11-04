// What one Claude turn changed, from git, without touching the project's index,
// branch or history (TRU-5.2). A snapshot is a tree written through a temporary copy
// of the index: nothing refers to it, so git collects it in time. Whatever made
// the change counts: Claude's edit, the formatter after it, a command the
// designer allowed. Files git ignores aren't seen.
import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import type { ChangedFile } from './module';

const exec = promisify(execFile);

const MAX_OUTPUT = 64 * 1024 * 1024;
/** Past this the diff is cut: the panel is for reading, not for reviewing a rewrite. */
const MAX_DIFF_CHARS = 200_000;

async function git(
  root: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  const { stdout } = await exec('git', [...args], {
    cwd: root,
    env: env ? { ...process.env, ...env } : process.env,
    maxBuffer: MAX_OUTPUT,
  });
  return stdout;
}

/** The working tree as a tree id; null outside a git repository. */
export async function snapshot(root: string): Promise<string | null> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'truing-index-'));
  try {
    const real = path.resolve(
      root,
      (await git(root, ['rev-parse', '--git-path', 'index'])).trim(),
    );
    const index = path.join(dir, 'index');
    // The copy keeps git's cached file times, so it hashes only what changed.
    await copyFile(real, index).catch(() => {});
    const env = { GIT_INDEX_FILE: index };
    await git(root, ['add', '-A', '.'], env);
    return (await git(root, ['write-tree'], env)).trim();
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** A count from `--numstat`: `-` for a binary file. */
const counted = (value: string | undefined): number | null =>
  value === undefined || value === '-' ? null : Number(value);

export async function changedFiles(
  root: string,
  before: string,
  after: string,
): Promise<ChangedFile[]> {
  const text = await git(root, [
    'diff-tree',
    '-r',
    '-z',
    // From the project, which may be below the repository's root (TRU-5.3).
    '--relative',
    '--no-renames',
    '--numstat',
    before,
    after,
  ]);
  return text.split('\0').flatMap((entry) => {
    const [added, removed, file] = entry.split('\t');
    return file
      ? [{ path: file, added: counted(added), removed: counted(removed) }]
      : [];
  });
}

export async function diffOf(
  root: string,
  before: string,
  after: string,
): Promise<string> {
  const text = await git(root, [
    'diff-tree',
    '-r',
    '-p',
    '--relative',
    '--no-renames',
    '--no-color',
    before,
    after,
  ]);
  return text.length > MAX_DIFF_CHARS
    ? `${text.slice(0, MAX_DIFF_CHARS)}\n\nThe rest is cut.`
    : text;
}

async function blobAt(
  root: string,
  tree: string,
  file: string,
): Promise<string | null> {
  return git(root, [
    'rev-parse',
    '--verify',
    '--quiet',
    // `./` is from the project; a bare path would be from the repository's root.
    `${tree}:./${file}`,
  ]).then(
    (id) => id.trim(),
    () => null,
  );
}

/** The file's hash now, as git would store it; null if it's gone. */
async function hashNow(root: string, file: string): Promise<string | null> {
  return git(root, ['hash-object', '--', file]).then(
    (id) => id.trim(),
    () => null,
  );
}

export type UndoResult =
  | { ok: true }
  /** These hold someone's later work. */
  | { ok: false; reason: 'moved'; files: readonly string[] }
  /** These couldn't be put back; `rolledBack` says everything else is as it was. */
  | {
      ok: false;
      reason: 'failed';
      files: readonly string[];
      rolledBack: boolean;
    };

async function blobText(root: string, blob: string): Promise<Buffer> {
  const { stdout } = await exec('git', ['cat-file', 'blob', blob], {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: MAX_OUTPUT,
  });
  return stdout;
}

async function putFile(
  full: string,
  text: Buffer | null,
  write: typeof writeFile,
): Promise<void> {
  if (text === null) {
    await rm(full, { force: true });
    return;
  }
  await mkdir(path.dirname(full), { recursive: true });
  await write(full, text);
}

/** Whether every step went back. It tries them all, whatever one of them does. */
async function rollBack(
  steps: readonly { full: string; current: Buffer | null }[],
  write: typeof writeFile,
): Promise<boolean> {
  let whole = true;
  for (const { full, current } of steps.toReversed()) {
    await putFile(full, current, write).catch(() => {
      whole = false;
    });
  }
  return whole;
}

/**
 * Puts the turn's files back as they were before it. All or none (TRU-5.3): a file
 * that has moved on since the turn holds someone's later work, so it stops the undo.
 * Every old text is read before anything is written, and a write that fails puts back
 * what went before it, so nothing is left to block a retry. `write` is for the tests.
 */
export async function undoTurn(
  root: string,
  before: string,
  after: string,
  files: readonly string[],
  write: typeof writeFile = writeFile,
): Promise<UndoResult> {
  const plans = await Promise.all(
    files.map(async (file) => ({
      file,
      was: await blobAt(root, before, file),
      left: await blobAt(root, after, file),
      now: await hashNow(root, file),
    })),
  );
  const moved = plans.filter(({ left, now }) => left !== now);
  if (moved.length > 0) {
    return { ok: false, reason: 'moved', files: moved.map(({ file }) => file) };
  }

  const steps: {
    file: string;
    full: string;
    old: Buffer | null;
    current: Buffer | null;
  }[] = [];
  for (const { file, was, left } of plans) {
    const full = path.join(root, file);
    try {
      steps.push({
        file,
        full,
        old: was === null ? null : await blobText(root, was),
        current: left === null ? null : await readFile(full),
      });
    } catch {
      return { ok: false, reason: 'failed', files: [file], rolledBack: true };
    }
  }

  // Removals first: a turn can swap a file for a folder of that name.
  const ordered = [
    ...steps.filter(({ old }) => old === null),
    ...steps.filter(({ old }) => old !== null),
  ];
  const done: typeof steps = [];
  for (const step of ordered) {
    try {
      await putFile(step.full, step.old, write);
      done.push(step);
    } catch {
      return {
        ok: false,
        reason: 'failed',
        files: [step.file],
        rolledBack: await rollBack(done, write),
      };
    }
  }
  return { ok: true };
}
