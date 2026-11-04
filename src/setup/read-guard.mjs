#!/usr/bin/env node
// A PreToolUse hook for Claude's read of a project. Read-only tools still reach
// the whole disk, so text planted in a repository could ask for ~/.ssh and put a
// key in the evidence that gets saved. Exit 2 blocks the call, and any error
// blocks too. The project's folder comes in argv, so nothing here knows one project.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';

/** Follows links through the deepest part of the path that exists. */
function realPath(path) {
  let existing = path;
  const rest = [];
  while (!existsSync(existing)) {
    rest.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(realpathSync(existing), ...rest);
}

function inside(root, target, cwd) {
  const real = realPath(resolve(cwd, target));
  return real === root || real.startsWith(`${root}${sep}`);
}

/** The folder a glob starts from: what comes before its first wildcard. */
function globStart(pattern) {
  const wild = pattern.search(/[*?[{]/);
  const literal = wild === -1 ? pattern : pattern.slice(0, wild);
  return literal.slice(0, literal.lastIndexOf('/') + 1) || '.';
}

/** Why a read isn't allowed, or null if it is. */
export function refusal(rootGiven, input, cwd) {
  const root = realpathSync(rootGiven);
  const paths = [input.file_path, input.path].filter(
    (value) => typeof value === 'string' && value !== '',
  );
  // `pattern` is a search for Grep, and a path for Glob.
  if (input.tool === 'Glob' && typeof input.pattern === 'string') {
    if (isAbsolute(input.pattern) || input.pattern.split('/').includes('..')) {
      paths.push(globStart(input.pattern));
    }
  }
  for (const target of paths) {
    if (!inside(root, target, cwd)) {
      return `${target} is outside the project being read.`;
    }
  }
  return null;
}

function main() {
  const root = process.argv[2];
  const event = JSON.parse(readFileSync(0, 'utf8'));
  const reason = refusal(
    root,
    { ...event.tool_input, tool: event.tool_name },
    event.cwd ?? root,
  );
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Couldn't check that read: ${String(error)}\n`);
    process.exit(2);
  }
}
