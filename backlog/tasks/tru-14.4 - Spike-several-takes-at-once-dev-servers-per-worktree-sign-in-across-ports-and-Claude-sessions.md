---
id: TRU-14.4
title: >-
  Spike: several takes at once: dev servers per worktree, sign-in across ports,
  and Claude sessions
status: In Progress
assignee: []
created_date: '2026-11-01 11:30'
updated_date: '2026-11-07 11:02'
labels:
  - spike
milestone: m-3
dependencies:
  - TRU-1.2
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-14
type: spike
ordinal: 140040
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-14.5 wants to ask the assistant for several implementations of a change, see them side by side, and choose one later. The sweep (`docs/research/menus-spacing-frames-takes.md`, "AI takes side by side") found that only Onlook shows takes side by side, each on its own sandbox and dev server.

Next 16 locks a folder to one `next dev`. So each take needs its own git worktree, its own dev server and its own port. Several things decide whether that is usable on an ordinary machine, and TRU-14.5 can't be planned until they are known.

Questions to answer, with measurements:

1. Three worktrees of a real project, each running its dev server on its own port: memory, cold start, the first compile of a heavy route.
2. Does the dev server work in a worktree that reuses the main checkout's `node_modules`, through a package manager's store, a hardlink or a symlink? Or does each worktree need its own install, and how long does that take?
3. Does a session carry from one port to another? Cookies ignore the port, so do sessions collide? Does a typical identity provider accept the redirects?
4. Three Claude sessions at once, one per worktree, through TRU-1.2's bridge: does it hold up, and what does a round of three takes cost against a plan's limits?
5. A lighter path for small takes, "three versions of one card": sibling components behind a temporary switch in one tree. What would the clean-up cost, and is it worth breaking ADR 0001 for?

Research: the note above; Claude Code worktrees (`--worktree`, `.worktreeinclude`, subagents with `isolation: worktree`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A note in `docs/research/` with the numbers and the commands that produced them.
- [x] #2 A recommendation, worktrees or a switch, with a cap on takes.
- [x] #3 **No per-project setup assumed.** The note says how a take's install and start commands come from the profile, how ports are found rather than configured, and what Truing tells the person when a project can't run twice.
- [x] #4 TRU-14.5's criteria are updated from the answers.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done 2026-11-07 on the reported app with the owner's agreement; all worktrees, branches and servers removed after, checkout clean. Open: environment files in a take (owner decision), warming the first compile, sign-in end to end in a take, one machine only.
<!-- SECTION:NOTES:END -->
