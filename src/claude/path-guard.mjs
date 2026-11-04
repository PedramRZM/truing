#!/usr/bin/env node
// A PreToolUse hook for Truing's Claude sessions (TRU-5.2, from TRU-1.2). It backs
// up the Edit(...) allow rules: a file tool may touch only what the project's
// config lists, and never a test or a secret. Exit 2 blocks the call before the permission
// rules run, and Claude reads the reason on stderr. Any error blocks too. The
// rules come from the file named in argv, so nothing here knows one project.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { matchesGlob, neverWritten } from '../globs.mjs';
import { realPath } from '../real-path.mjs';

/** Where a write would really land, from the project's root. */
function pathInProject(rules, target, cwd) {
  return relative(realpathSync(rules.root), realPath(resolve(cwd, target)))
    .split(sep)
    .join('/');
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
  const path = pathInProject(rules, target, cwd);
  if (path === '..' || path.startsWith('../') || isAbsolute(path)) {
    return `${target} is outside the project.`;
  }
  // Forbidden paths ignore case: src/Server is src/server on a Mac.
  const lower = path.toLowerCase();
  const never = neverWritten(path, rules.include.includes('**'));
  if (never) return never;
  if (rules.exclude.some((glob) => matchesGlob(lower, glob.toLowerCase()))) {
    return `${path} is off limits.`;
  }
  if (!rules.include.some((glob) => matchesGlob(path, glob))) {
    return `${path} isn't one of them.`;
  }
  return null;
}

/**
 * What a skill's frontmatter may say when Claude writes it. A skill grants itself the
 * rest once it runs: `allowed-tools` and `hooks` ran commands with no prompt on Claude
 * Code 2.1.318 (TRU-5.3). So this names what grants nothing, and a new key stays out.
 */
const PLAIN_KEYS = new Set([
  'name',
  'description',
  'when_to_use',
  'argument-hint',
  'disable-model-invocation',
  'user-invocable',
  'paths',
  'version',
]);

/** The frontmatter key that isn't plain, if any. An unclosed block counts whole. */
function grantingKey(text) {
  const lines = text.trimStart().split(/\r?\n/);
  if (lines[0]?.trimEnd() !== '---') return null;
  for (const line of lines.slice(1)) {
    if (line === '---') return null;
    if (line.trim() === '' || /^(\s|#)/.test(line)) continue;
    const key = line.split(':')[0] ?? '';
    if (!line.includes(':') || !PLAIN_KEYS.has(key)) return key;
  }
  return null;
}

/** The file as this call would leave it; null if the call doesn't say. */
function textAfter(input, file) {
  if (typeof input.content === 'string') return input.content;
  const edits = Array.isArray(input.edits) ? input.edits : [input];
  if (edits.some(({ old_string: from, new_string: to }) => !isText(from, to))) {
    return null;
  }
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  for (const { old_string: from, new_string: to, replace_all: all } of edits) {
    text = all ? text.split(from).join(to) : text.replace(from, () => to);
  }
  return text;
}

function isText(...values) {
  return values.every((value) => typeof value === 'string');
}

/** Why this call can't leave a designer's own file as it would. */
function instructionsRefusal(rules, input, target, cwd) {
  if (!/(^|\/)\.claude\//i.test(pathInProject(rules, target, cwd))) return null;
  const text = textAfter(input, realPath(resolve(cwd, target)));
  if (text === null) return `Can't tell what ${target} would say.`;
  const key = grantingKey(text);
  return key === null
    ? null
    : `${target} can't set "${key}": it could grant commands that nobody approved. A developer has to add it.`;
}

let wholeProject = false;

function run() {
  const rules = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  wholeProject = rules.include.includes('**');
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (typeof target !== 'string' || target === '') {
    return 'The call names no file.';
  }
  const cwd = input.cwd ?? rules.root;
  return (
    refusal(rules, target, cwd) ??
    instructionsRefusal(rules, input.tool_input, target, cwd)
  );
}

function block(reason) {
  const rule = wholeProject
    ? "Truing won't change this file."
    : "Truing may change only the project's UI files.";
  process.stderr.write(`${rule} ${reason}\n`);
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
