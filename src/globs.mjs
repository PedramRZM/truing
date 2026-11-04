// A plain script: the path guard runs it with bare Node, in Claude's hook, and
// the edit engine imports the same function.

const TESTS = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)__tests__\//,
  /(^|\/)__snapshots__\//,
  /\.snap$/,
  /(^|\/)e2e\//,
  /_test\.[a-z]+$/,
  /(^|\/)test_[^/]*$/,
  /(^|\/)(playwright|vitest|jest|cypress)\.config\.[a-z]+$/,
];

/** A folder a list may name on purpose, but that full access doesn't hand over. */
const TEST_FOLDERS = /(^|\/)tests?\//;

const SECRETS = [
  /(^|\/)\.env(\.[^/]*)?$/,
  /(^|\/)\.envrc$/,
  /(^|\/)secrets\//,
  /\.(pem|key|p12|pfx)$/,
  /(^|\/)id_(rsa|ed25519)[^/]*$/,
  /(^|\/)\.(npmrc|netrc)$/,
  /(^|\/)\.(aws|ssh)\//,
];

/**
 * What runs later with no prompt, so editing it would undo every other limit: Git's
 * own files and hook managers, the servers Claude connects, and Claude Code's settings,
 * hooks, agents and skills. A designer's own rules and skills are the one exception,
 * and only their Markdown: a script beside a skill would run later too (TRU-5.3).
 */
const RUNS_LATER = [
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.claude\/(?!rules\/design-[^/]*\.md$|skills\/design-[^/]*\/(?:[^/]+\/)*[^/]*\.md$)/,
  /(^|\/)\.mcp\.json$/,
  /(^|\/)\.(husky|githooks)\//,
  /(^|\/)lefthook(-local)?\.ya?ml$/,
  /(^|\/)\.pre-commit-config\.ya?ml$/,
  // Instructions every later session loads, and what other tools run by themselves.
  /(^|\/)(claude|claude\.local|agents|gemini)\.md$/,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)\.(cursor|codex|gemini|vscode)\//,
];

/**
 * Why a project path is never written, whatever the writable list says: full
 * access included (TRU-10.7). Null for any other file. Forbidden paths ignore
 * case: src/Server is src/server on a Mac.
 *
 * @param {string} file relative to the project's root, with forward slashes
 * @param {boolean} [wholeProject] full access, rather than lists someone wrote
 * @returns {string | null}
 */
export function neverWritten(file, wholeProject = false) {
  const lower = file.toLowerCase();
  if (
    TESTS.some((pattern) => pattern.test(lower)) ||
    (wholeProject && TEST_FOLDERS.test(lower))
  ) {
    return `${file} is a test.`;
  }
  if (SECRETS.some((pattern) => pattern.test(lower))) {
    return `${file} may hold secrets.`;
  }
  if (RUNS_LATER.some((pattern) => pattern.test(lower))) {
    return `${file} is Git's or Claude Code's own.`;
  }
  return null;
}

/**
 * A project path against a config glob: `**` is any number of folders, `*`
 * anything but `/`. All the config's globs need.
 *
 * @param {string} file
 * @param {string} glob
 * @returns {boolean}
 */
export function matchesGlob(file, glob) {
  let pattern = '';
  for (let at = 0; at < glob.length; at += 1) {
    const character = glob.charAt(at);
    if (glob.startsWith('**/', at)) {
      pattern += '(?:.*/)?';
      at += 2;
    } else if (glob.startsWith('**', at)) {
      pattern += '.*';
      at += 1;
    } else if (character === '*') {
      pattern += '[^/]*';
    } else {
      pattern += character.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`).test(file);
}
