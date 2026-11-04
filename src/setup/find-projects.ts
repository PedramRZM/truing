// Which folders to offer: this one, the ones Truing knows, the ones Claude Code
// worked in lately. Reads folder names and when a file last changed, and never
// opens a transcript: what people said to Claude is none of Truing's business.
import { existsSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { listProfiles } from './profile';

export type Candidate = {
  root: string;
  name: string;
  source: 'here' | 'known' | 'recent';
  /** Saved already: choosing it opens without reading it again. */
  known: boolean;
};

const MARKERS = ['package.json', '.git'];

function looksLikeProject(dir: string): boolean {
  return MARKERS.some((marker) => existsSync(path.join(dir, marker)));
}

/** The project a folder is in: the nearest one above holding a marker. */
export function projectRootOf(from: string): string | null {
  let dir = path.resolve(from);
  for (;;) {
    if (looksLikeProject(dir) && dir !== os.homedir()) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Claude Code names a project's folder after its path, every other character a dash. */
function encoded(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '-');
}

function subfolders(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * The folder a Claude Code project name stands for. A dash could have been any
 * character, so this walks down from the root, following the folders whose names
 * fit. Null when none does, which is also what a deleted folder looks like.
 */
export function folderFromClaudeName(
  name: string,
  from = path.parse(os.homedir()).root,
): string | null {
  if (name === '') return from;
  for (const folder of subfolders(from)) {
    const piece = `-${encoded(folder)}`;
    if (name !== piece && !name.startsWith(`${piece}-`)) continue;
    const found = folderFromClaudeName(
      name.slice(piece.length),
      path.join(from, folder),
    );
    if (found) return found;
  }
  return null;
}

/** Folders Claude Code worked in, most recent first. */
export function recentClaudeProjects(
  env: NodeJS.ProcessEnv = process.env,
  limit = 12,
): string[] {
  const base = path.join(
    env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'),
    'projects',
  );
  if (!existsSync(base)) return [];

  const newest = readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = path.join(base, entry.name);
      // A transcript can go while this looks: a live Claude Code tidies up after itself.
      const times = readdirSync(dir)
        .filter((name) => name.endsWith('.jsonl'))
        .flatMap((name) => {
          try {
            return [statSync(path.join(dir, name)).mtimeMs];
          } catch {
            return [];
          }
        });
      return times.length > 0
        ? [{ name: entry.name, mtime: Math.max(...times) }]
        : [];
    })
    .sort((a, b) => b.mtime - a.mtime);

  const found: string[] = [];
  for (const { name } of newest) {
    if (found.length >= limit) break;
    const folder = folderFromClaudeName(name);
    if (
      folder &&
      !found.includes(folder) &&
      looksLikeProject(folder) &&
      folder !== os.homedir()
    ) {
      found.push(folder);
    }
  }
  return found;
}

export async function findProjects(
  from: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Candidate[]> {
  const candidates = new Map<string, Candidate>();
  const known = new Map(listProfiles(env).map((p) => [p.root, p.config.name]));
  const add = (root: string, source: Candidate['source']): void => {
    if (candidates.has(root)) return;
    candidates.set(root, {
      root,
      name: known.get(root) ?? path.basename(root),
      source,
      known: known.has(root),
    });
  };

  const here = projectRootOf(from);
  if (here) add(here, 'here');
  for (const root of known.keys()) add(root, 'known');
  for (const root of recentClaudeProjects(env)) add(root, 'recent');
  return [...candidates.values()];
}

export type FolderList = {
  path: string;
  parent: string | null;
  isProject: boolean;
  folders: string[];
};

/** One level of the file system, for choosing a folder by hand. */
export function listFolder(dir: string): FolderList {
  const resolved = path.resolve(dir);
  const parent = path.dirname(resolved);
  return {
    path: resolved,
    parent: parent === resolved ? null : parent,
    isProject: looksLikeProject(resolved),
    folders: readdirSync(resolved, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules',
      )
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b)),
  };
}
