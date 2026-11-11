# 0009. Tasks live in GitHub issues, and the agent harness follows tackroom

Date: 2026-11-11 Status: accepted

## Context

Truing's agent setup had grown its own way: 18 skills synced to six harnesses by `make sync`,
hooks in tools/agent-hooks, Backlog.md for tasks, MADR records in docs/adr, and
learnings, change folders and templates under `docs/`. The owner keeps a researched harness,
tackroom, for all their projects, and asked for this repository to follow it fully.

## Decision

- The harness is tackroom's template: `AGENTS.md`, `CLAUDE.md`, `WORKFLOW.md`, `.claude/`
  (settings, hooks, its eleven skills, reviewer and memory agents), `scripts/agent/`,
  `.agents/memory/`, Codex and OpenCode config. Truing's own skills were removed, domain ones
  included; their knowledge stays in git history.
- Tasks are GitHub issues made from the task and epic forms, with state in labels. The 73 open
  Backlog.md tasks became issues #7 to #79: each epic kept its number (TRU-8 is #8), and every
  issue says which TRU id it came from. The completed tasks were not moved.
- Decisions are short records here; plans are `docs/plans/<issue>-<slug>.md`; learnings are
  memory in `.agents/memory/`, curated by `/dream`.
- `scripts/agent/check` is the gate, and the pre-commit hook runs it.
- Not kept: Gemini, Cursor and VS Code agent config, the project MCP servers, `REVIEW.md`.

## Alternatives rejected

- Keep Backlog.md, as tackroom allows: the owner chose issues, which tackroom recommends for a
  repository with a GitHub remote.
- Task files in `tasks/`: same format, but invisible outside the repository.
- Keep truing's domain skills (ui-design, ux-copy, verify-ui...): the owner chose tackroom's set only.

## Consequences

- A TRU id in a commit, comment or older doc is found by searching the issues for it, or, for a
  completed task, with `git show b95e899:backlog/completed/` (the last commit with the backlog).
- The queue is public on GitHub. What was decided still lives in this repository.
- Only the owner marks an issue `ready`; until then `scripts/agent/next-task --github` picks nothing.
- A `blocked` label stands in for dependencies in task selection; it has to be removed by hand
  when the blocker closes.

## Revisit if

The repository stops being on GitHub, or more than about three agents work in it at once
(tackroom's notes point at Beads for an atomic claim).
