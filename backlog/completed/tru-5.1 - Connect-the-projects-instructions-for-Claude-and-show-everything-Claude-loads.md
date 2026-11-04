---
id: TRU-5.1
title: 'Connect the project''s instructions for Claude, and show everything Claude loads'
status: Done
assignee: []
created_date: '2026-10-31 15:30'
updated_date: '2026-11-03 11:10'
labels:
  - claude
dependencies: []
type: chore
ordinal: 50010
parent_task_id: TRU-5
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-1.2 found that AGENTS.md can reach Claude Code only through a personal setting (`pluginConfigs["cc-plugin-agents-md@builtin"].options.instructionFiles`), when a repository has no `CLAUDE.md`. So a teammate's session, and a Truing run that leaves the user settings out, never see the project's conventions. TRU-1.2's bridge worked around it in its per-run settings. This task makes it work for any project, so the workaround can go.

### Added later (2026-11-03)

- What this task builds can't know about any one project.
- TRU-17.2 and later teach Claude design rules through skills and rules, so Truing needs one place that shows everything Claude has loaded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A session that leaves out the user settings loads AGENTS.md, shown from its transcript.
- [x] #2 AGENTS.md isn't loaded twice in a session that also has the personal setting.
- [x] #3 The setup step works on any project: it reads the project's files, and connects AGENTS.md when nothing does yet.
- [x] #4 Truing shows what Claude loads, in one place, as Claude itself reports it.
- [x] #5 No Claude process starts until someone opens that place, and it costs no model call.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Steps

1. Choose between a root `CLAUDE.md` that imports `@AGENTS.md`, and the `pluginConfigs` setting in `.claude/settings.json`. Prefer the one that doesn't depend on a built-in plugin's option.
2. Make the change.
3. Run `claude -p --setting-sources project,local "Reply READY."` in the repository and check the session transcript's `instructions` attachment lists `AGENTS.md`.
4. Remove `pluginConfigs` from Truing's per-run settings once Truing exists (TRU-5.2).


**Measured first (Claude Code 2.1.317):**

- `/context` in `-p` runs with no model call (`num_turns: 0`, `total_cost_usd: 0`, about 2.6 s). Its `system/init` event lists skills, agents, plugins, MCP servers and model, and its answer lists the instruction files. So Claude can say what it loads for free, and Truing doesn't have to guess Claude Code's rules.
- The plan first used `/usage` with an `InstructionsLoaded` hook. Driving the signed-out state showed that doesn't hold: Claude exits without waiting for its hooks, so quick runs logged 3 of 5 files, a different 3 each time, and never caught up. `/context` gave the full list in 8 of 8 runs signed out and 8 of 8 signed in.

**Steps:**

1. Root `CLAUDE.md` holding `@AGENTS.md`, as the setup step writes it. Un-ignore that one file.
2. `src/claude/session.ts`: TRU-1.2's flags and environment for a studio session, in one place for TRU-5.2. Project-specific variables to drop move to the config as `claude.dropEnv`.
3. Module `claude-config` (`src/modules/claude-config/`): reads a project's Claude files, asks Claude what it loaded, and merges the two. Nothing in it names any one project.
4. `truing setup`: connects AGENTS.md if nothing does, and says what Claude loads.
5. A Claude tab in the left panel (Alt+3) lists it all; a row opens the file. It asks Claude only once the tab shows.
6. Unit tests on a temporary project with a fake Claude, as the suite must never start one. The live checks are recorded here.

**How each criterion is proved:** the first two by the session transcripts; setup by unit tests on a temporary project and real runs on scratch projects; the tab by driving it live; the last by the drive's process count and the free run's own result event. (The plan named a unit test on the panel's trigger. Truing's unit suite has no DOM, so the host test proves the `files` op starts no Claude, and the drive proves the tab waits.)
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**`truing setup` connects AGENTS.md for any project through a one-line root `CLAUDE.md`, and Truing's Claude tab (Alt+3) shows everything Claude loads.** Nothing in the module or `src/claude/` names any one project.

**For any project:**

- `src/modules/claude-config/` reads Claude Code's layout, not any one project's. `truing setup` runs without a `truing.config.ts`, so it can be the first step in a new project.
- Setup connects AGENTS.md in the way that needs no plugin option. It writes one file, only when it's missing, and never edits a file the project has: it prints the line to add.
- It trusts what Claude reports over reading the text, so a chained import or a `CLAUDE.md` linked to AGENTS.md isn't "fixed".
- Not built here: detecting the app. TRU-6.4 does that.

**How each criterion was checked**

| Criterion                              | Evidence                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loads without the user settings        | Before: `--setting-sources project,local` listed `~/.claude/CLAUDE.md`, `nextjs-docs.md` and `working-here.md`, with no AGENTS.md. After: `claude -p --setting-sources project,local "Reply READY."` on Haiku (session `03021cee`). Its transcript's `instructions` attachment lists `CLAUDE.md`, `AGENTS.md`, both rules, the personal file and auto memory. |
| Not loaded twice                       | A plain `claude -p` with the personal `pluginConfigs` setting (session `29d7e2be`): `AGENTS.md` appears once in the same attachment, and the text's heading occurs as often in the transcript as in the other session.                                                                                                                                        |
| Setup on any project                   | 21 tests in `test/unit/claude-config.test.ts` on temporary projects. Real runs: a folder with only AGENTS.md and no config got `CLAUDE.md` holding `@AGENTS.md`, and a second run changed nothing.                                                                                                                                                            |
| Shows what Claude reports              | Driven headless on a real app: Claude Code 2.1.317, 6 files in every session, 23 for matching files, 36 skills (17 the project's), 10 agents (5), 3 hooks, 39 permissions, no MCP servers, 4 plugins. Stable over repeated runs. A row opens its file beside the panel.                                                                                          |
| No process until opened, no model call | 0 `claude` processes before the tab shows, 0 left after. `num_turns: 0`, `total_cost_usd: 0`. The list shows in about 1 s and Claude's answer in about 3.8 s. A session file isn't written (`--no-session-persistence`).                                                                                                                                      |

**Commands, last run:** package `tsc` clean; `vitest run` 663/663 (40 files), under the guard that fails if a test starts Claude; root `pnpm typecheck` clean; ESLint 0 errors on the changed files, 2 `no-console` warnings for `cli.ts`'s output;  No e2e spec ran. Nothing changed under the app's `src/`.

**What the reviewers flagged, and what was done**

- **Task reviewer** (not ready). Fixed, each with a test:
  - signed out looked fine, as `apiKeySource` is `none` either way: it now asks `claude auth status`, reading only `loggedIn`, because the rest holds the person's email;
  - a malformed settings file could be opened raw, `env` and all: it's now shown by name only. Tokens in a hook's command or a rule are masked;
  - an empty project showed a false failure, and an untrusted folder's ignored allow rules weren't mentioned;
  - setup failed without a config, and misread a linked `CLAUDE.md`, a chained import and a fenced `@AGENTS.md`;
  - plugin skills were called "Built into Claude Code", now "Outside this project";
  - frontmatter (a list at no indent, a byte-order mark, a comma in braces), non-ASCII paths, a project reached by a link, and an open stdin that cost 3 s.
  - It also caught that removing the `.gitignore` line would expose `evals/CLAUDE.md`.
- **Design reviewer** (not ready). Fixed: group titles now follow the Section pattern (chevron at the end, weight 500, lines between, one left edge); the open row is marked; globs and paths are mono; failures use the Failure pattern; the facts hold their place while asking, so the list doesn't jump; Check again dims while it runs; "Allow" no longer truncates.
- **Copy reviewer** (not ready). Fixed: raw process errors no longer reach the panel, and its other rewrites went in. Its question on "Claude" and "Claude Code" is below.
- **Found by driving it:** a panel that calls as it mounts, before the socket opens, got "Not connected" with no way back, so a reload with this tab open broke it. The shell now holds such a call until the socket opens or closes, for every module. The hook race above came from the same drive.

The reviewers haven't re-read the fixes. The screens were retaken and read by hand.

**Left open**

- **Try it:** `truing`, then the Claude tab. Taste and density are yours, as are the words "Yours", "This computer" and "Outside this project".
- **"Claude" and "Claude Code"** are both used, and the left tab and TRU-5.2's right-panel switch would both be called Claude. The left one may need another name.
- **Reading a project's `SessionStart` hooks:** the free check runs them, as any Claude session in that project would. the real app has none. In the standalone tool, a project with a slow or noisy one will feel it each time the tab opens.
- **`/context` is text for people.** If its table changes, the tab says it couldn't confirm the list and falls back to the project's files. It doesn't show a wrong list as confirmed. The unit tests hold the shape seen on 2.1.317.
- **Personal files load in design sessions.** As TRU-1.2 found, `~/.claude/CLAUDE.md`, personal rules and auto memory load even with the user settings left out, and the tab now shows them as "Yours". Whether design sessions should keep them is TRU-5.2's call.
- **e2e:** by your request none ran and none was added or skipped. From reading them, `shell.spec.ts`'s tab test and `modules.spec.ts` should still hold with a third tab, but that's unproved.
- **Not checked:** A browser check as a tool, since Truing only runs in its own browser. Light and dark at 1280 and 1440 were driven and read by hand, without the craft script. `pnpm typecheck` once failed on a half-written `.next/dev/types/validator.ts` after a dev-server restart, and a fresh restart cleared it.
<!-- SECTION:FINAL_SUMMARY:END -->
