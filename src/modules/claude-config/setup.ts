// `truing setup`: readies any project for Truing's Claude sessions.
// Today it connects AGENTS.md and says what Claude loads. It writes one file,
// only when it's missing, and never edits a file the project already has.
import { execFile } from 'node:child_process';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { ClaudeAnswer } from './ask-claude';
import { mergeConfig } from './merge';
import type { ClaudeConfig } from './module';
import { importsAgents, readClaudeFiles } from './project-files';

const run = promisify(execFile);

export type ConnectResult =
  /** No AGENTS.md, or something already imports it. */
  | { outcome: 'nothing-to-do' }
  /** No CLAUDE.md, so one was written. */
  | { outcome: 'wrote'; ignoredBy: string | null }
  /** CLAUDE.md is the project's own, so it's left for a person to change. */
  | { outcome: 'add-line'; file: string };

/** The `.gitignore` rule that keeps a file out of git, if any. */
async function ignoredBy(root: string, file: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['check-ignore', '-v', file], {
      cwd: root,
    });
    const rule = stdout.split('\t')[0]?.trim() ?? '';
    // `-v` also reports the `!` rule that un-ignores a file.
    return rule && !/:!/.test(rule) ? rule : null;
  } catch {
    // Not ignored, or not a git repository.
    return null;
  }
}

/**
 * Claude Code reads CLAUDE.md, not AGENTS.md, so a project with only AGENTS.md
 * reaches Claude through one person's settings at best. An import reaches
 * everyone and needs no plugin option (TRU-5.1).
 */
export async function connectAgentsMd(
  root: string,
  /** What Claude said, which beats reading the files; null if it couldn't say. */
  loaded: boolean | null = null,
): Promise<ConnectResult> {
  const { hasAgentsMd } = await readClaudeFiles(root);
  if (!hasAgentsMd || loaded === true) {
    return { outcome: 'nothing-to-do' };
  }

  const candidates = ['CLAUDE.md', '.claude/CLAUDE.md'];
  let existing: string | null = null;
  for (const name of candidates) {
    const content = await readFile(path.join(root, name), 'utf8').catch(
      () => null,
    );
    if (content === null) continue;
    if (loaded === null && importsAgents(content)) {
      return { outcome: 'nothing-to-do' };
    }
    existing ??= name;
  }
  if (existing) return { outcome: 'add-line', file: existing };

  await writeFile(path.join(root, 'CLAUDE.md'), '@AGENTS.md\n');
  return { outcome: 'wrote', ignoredBy: await ignoredBy(root, 'CLAUDE.md') };
}

function connectLines(result: ConnectResult): string[] {
  switch (result.outcome) {
    case 'nothing-to-do':
      return [];
    case 'wrote':
      return [
        'Wrote CLAUDE.md, which imports AGENTS.md, so every Claude session here loads it.',
        ...(result.ignoredBy
          ? [
              `Git ignores CLAUDE.md (${result.ignoredBy}). Remove that line and commit the file to share it.`,
            ]
          : []),
      ];
    case 'add-line':
      return [
        `Claude doesn't load AGENTS.md. Add this line to ${result.file}: @AGENTS.md`,
      ];
  }
}

function count(label: string, items: readonly unknown[]): string {
  return `  ${label}: ${items.length}`;
}

/** What setup prints. */
export function setupReport(
  result: ConnectResult,
  config: ClaudeConfig,
): string {
  return [
    ...connectLines(result),
    config.problem ?? null,
    config.confirmed
      ? 'What Claude loads here:'
      : "What the project's files say Claude loads:",
    count('Loaded in every session', config.instructions),
    count('Loaded for matching files', config.onDemand),
    count(
      'Project skills',
      config.skills.filter((item) => item.path),
    ),
    count(
      'Project agents',
      config.agents.filter((item) => item.path),
    ),
    count('Hooks', config.hooks),
    count('Permissions', config.permissions),
    "Claude's Configuration in Truing lists them all.",
  ]
    .filter((line) => line !== null)
    .join('\n');
}

/** Whether Claude listed the root's AGENTS.md; null if it couldn't say. */
function reportsAgentsMd(answer: ClaudeAnswer, real: string): boolean | null {
  if (!answer.ok || answer.report.files.length === 0) return null;
  const agentsMd = path.join(real, 'AGENTS.md');
  return answer.report.files.some(({ file }) => file === agentsMd);
}

/** Runs setup; `ask` is how Claude is asked. Claude is asked again after a write. */
export async function runSetup(
  root: string,
  ask: () => Promise<ClaudeAnswer>,
): Promise<string> {
  const first = await ask();
  const real = await realpath(root);
  const result = await connectAgentsMd(root, reportsAgentsMd(first, real));
  const answer = result.outcome === 'wrote' ? await ask() : first;
  return setupReport(result, mergeConfig(await readClaudeFiles(root), answer));
}
