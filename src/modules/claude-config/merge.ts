// What Claude's configuration view lists: the project's files, with Claude's own word over
// them where it has given one.
import path from 'node:path';

import type { ClaudeAnswer, ClaudeReport } from './ask-claude';
import { isDesignerFile } from './designer-files';
import type { ClaudeConfig, ConfigItem } from './module';
import { type ClaudeFiles, emptyItem } from './project-files';

/** Claude's list against the files: a name with no file is Claude Code's own. */
function listed(
  onDisk: readonly ConfigItem[],
  names: readonly string[],
): ConfigItem[] {
  const said = new Set(names);
  const found = new Set(onDisk.map((item) => item.name));
  return [
    ...onDisk.map((item) => ({ ...item, missing: !said.has(item.name) })),
    ...names
      .filter((name) => !found.has(name))
      .map((name) => emptyItem(name, 'outside')),
  ];
}

function loadedFiles(files: ClaudeFiles, report: ClaudeReport): ConfigItem[] {
  return report.files.map(({ file, autoMemory }): ConfigItem => {
    const rule = file.split(/[\\/]\.claude[\\/]rules[\\/]/)[1];
    const name = autoMemory ? 'Auto memory' : (rule ?? path.basename(file));
    return {
      ...emptyItem(name, files.sourceOf(file)),
      path: files.label(file),
    };
  });
}

const SOURCE_ORDER: Record<ConfigItem['source'], number> = {
  project: 0,
  local: 1,
  personal: 2,
  truing: 3,
  other: 4,
  outside: 5,
};

/** Whose it is, then the root's files before rules. Claude's hooks fire in no set order. */
function byOwner(items: readonly ConfigItem[]): ConfigItem[] {
  const rule = (item: ConfigItem): number =>
    item.path?.includes('/rules/') ? 1 : 0;
  return [...items].sort(
    (a, b) =>
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
      rule(a) - rule(b) ||
      (a.path ?? a.name).localeCompare(b.path ?? b.name),
  );
}

function problemOf(
  answer: ClaudeAnswer | null,
  report: ClaudeReport | null,
  said: boolean,
): string | null {
  if (answer && !answer.ok) return answer.problem;
  if (!report) return null;
  if (report.loggedIn === false) {
    return 'Claude Code is signed out. Run claude in a terminal, then /login.';
  }
  if (report.untrusted) {
    return "Claude ignores this project's allow rules until it's trusted. Run claude here once and accept.";
  }
  return said ? null : "Claude Code didn't list its instruction files.";
}

/** Whichever list it came from, a designer's own file can be changed. */
function marked(items: readonly ConfigItem[]): ConfigItem[] {
  return items.map((item) => ({
    ...item,
    editable: isDesignerFile(item.path),
  }));
}

/** The whole list; `answer` is null until Claude has been asked. */
export function mergeConfig(
  files: ClaudeFiles,
  answer: ClaudeAnswer | null,
): ClaudeConfig {
  const report = answer?.ok ? answer.report : null;
  // No file on disk and none reported agree: there's nothing to load.
  const said = Boolean(
    report && (report.files.length > 0 || files.instructions.length === 0),
  );
  const instructions =
    report && said ? loadedFiles(files, report) : files.instructions;
  const agentsMdLoaded = instructions.some((item) => item.path === 'AGENTS.md');

  return {
    claude: report && {
      version: report.version,
      model: report.model,
      apiKeySource: report.apiKeySource,
      loggedIn: report.loggedIn,
    },
    problem: problemOf(answer, report, said),
    confirmed: said,
    agentsMdMissing: files.hasAgentsMd && !agentsMdLoaded,
    instructions: marked(
      byOwner([...instructions, ...files.truing.instructions]),
    ),
    onDemand: marked(byOwner(files.onDemand)),
    skills: marked(
      report
        ? listed([...files.skills, ...files.truing.skills], report.skills)
        : [...files.skills, ...files.truing.skills],
    ),
    agents: report ? listed(files.agents, report.agents) : files.agents,
    hooks: [...files.hooks, ...files.truing.hooks],
    permissions: [...files.permissions, ...files.truing.permissions],
    mcpServers: (report?.mcpServers ?? []).map((server) => ({
      ...emptyItem(server.name, 'other'),
      note: server.status,
    })),
    plugins: (report?.plugins ?? []).map((name) => emptyItem(name, 'outside')),
    unreadable: files.unreadable,
  };
}
