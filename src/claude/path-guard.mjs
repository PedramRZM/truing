#!/usr/bin/env node
// A PreToolUse hook for Truing's Claude sessions (TRU-5.2, from TRU-1.2). It backs
// up the Edit(...) allow rules: a file tool may touch only what the project's
// config lists, and never a test. Exit 2 blocks the call before the permission
// rules run, and Claude reads the reason on stderr. Any error blocks too. The
// rules come from the file named in argv, so nothing here knows one project.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import { matchesGlob } from '../globs.mjs';

const TESTS = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)__tests__\//,
  /(^|\/)e2e\//,
];

/**
 * Resolves links through the deepest part of the path that exists, so a link
 * inside an allowed folder can't point the write somewhere else.
 */
function realPath(path) {
  let existing = path;
  const rest = [];
  while (!existsSync(existing)) {
    rest.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(realpathSync(existing), ...rest);
}

/**
 * Why a write isn't allowed, or null if it is.
 *
 * @param {{ root: string, include: string[], exclude: string[] }} rules
 * @param {string} target the tool's path, absolute or from `cwd`
 * @param {string} cwd
 * @returns {string | null}
 */
export function refusal(rules, target, cwd) {
  const root = realpathSync(rules.root);
  const path = relative(root, realPath(resolve(cwd, target)))
    .split(sep)
    .join('/');
  if (path === '..' || path.startsWith('../') || isAbsolute(path)) {
    return `${target} is outside the project.`;
  }
  // Forbidden paths ignore case: src/Server is src/server on a Mac.
  const lower = path.toLowerCase();
  if (TESTS.some((pattern) => pattern.test(lower))) {
    return `${path} is a test.`;
  }
  if (rules.exclude.some((glob) => matchesGlob(lower, glob.toLowerCase()))) {
    return `${path} is off limits.`;
  }
  if (!rules.include.some((glob) => matchesGlob(path, glob))) {
    return `${path} isn't one of them.`;
  }
  return null;
}

function run() {
  const rules = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (typeof target !== 'string' || target === '') {
    return 'The call names no file.';
  }
  return refusal(rules, target, input.cwd ?? rules.root);
}

function block(reason) {
  process.stderr.write(
    `Truing may change only the project's UI files. ${reason}\n`,
  );
  process.exit(2);
}

// Imported by the tests; run by Claude's hook.
if (process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename) {
  try {
    const reason = run();
    if (reason) block(reason);
  } catch (error) {
    block(
      `The path guard failed (${error.message}), so the change was blocked.`,
    );
  }
}
