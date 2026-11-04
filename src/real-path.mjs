// A plain script, like globs.mjs: the path guard runs it with bare Node, in Claude's
// hook, and the edit engine imports the same function.
import { lstatSync, readlinkSync } from 'node:fs';
import { join, parse, resolve, sep } from 'node:path';

/** Past this many links, a path is a loop, or trying to be one. */
const MAX_LINKS = 40;

function partsOf(path) {
  return path.slice(parse(path).root.length).split(sep).filter(Boolean);
}

/**
 * Where a write to this absolute path would really land, following every link. A link
 * to nothing yet counts as where it points, as a write would create that file there.
 * Throws for a loop or a path it can't look at, which a caller must treat as a refusal.
 *
 * @param {string} path
 * @returns {string}
 */
export function realPath(path) {
  let current = parse(path).root;
  let pending = partsOf(path);
  let links = 0;
  while (pending.length > 0) {
    const [part, ...rest] = pending;
    const next = join(current, part);
    let isLink;
    try {
      isLink = lstatSync(next).isSymbolicLink();
    } catch (error) {
      if (error.code === 'ENOENT') return join(next, ...rest);
      throw error;
    }
    if (!isLink) {
      current = next;
      pending = rest;
      continue;
    }
    links += 1;
    if (links > MAX_LINKS) throw new Error(`Too many links in ${path}.`);
    const target = resolve(current, readlinkSync(next));
    current = parse(target).root;
    pending = [...partsOf(target), ...rest];
  }
  return current;
}
