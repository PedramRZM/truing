---
id: TRU-14.5
title: >-
  Explore takes side by side: the assistant prototypes several versions, the
  person keeps one
status: To Do
assignee: []
created_date: '2026-11-01 11:30'
updated_date: '2026-11-07 11:02'
labels:
  - claude
  - panels
milestone: m-3
dependencies:
  - TRU-14.4
  - TRU-14.2
  - TRU-5.2
  - TRU-12.1
  - TRU-4.1
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-14
type: feature
ordinal: 140050
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ask the assistant for several implementations of a change, see them side by side on the canvas, compare them and choose one. The assistant must know it is prototyping. Edits pile up across several takes, nothing is final until one is chosen, and the rest are thrown away.

The sweep (`docs/research/menus-spacing-frames-takes.md`) found this side by side only in Onlook (a sandbox per branch) and in Subframe and Figma's agent (variations on the canvas). None of them tells the model it is exploring. The plan below assumes TRU-14.4 confirms worktrees; TRU-14.4 may change it.

Research: the note above and TRU-14.4's findings; Onlook's `components/store/editor/branch/manager.ts`; TRU-4.1, TRU-5.2, TRU-12.1, TRU-13.2, TRU-16.12.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Ask for takes.** In the assistant, the person asks for N takes, capped from TRU-14.4's numbers, with an optional line per take on what should differ ("one dense, one airy").
- [ ] #2 **Each take is real.** It gets its own worktree and branch off the hand-back branch, its own dev server, and its own Claude session.
- [ ] #3 **Taken from the profile.** Install and start commands come from the profile, ports are found free, and branch names follow the conventions read in TRU-13.2. Nothing is configured for takes. A project that can't run twice gets a plain message and a smaller option from TRU-14.4.
- [ ] #4 **On the canvas.** Each take is a frame group from TRU-14.2, labelled "Take 2 of 3". The takes follow each other's route.
- [ ] #5 **The assistant knows it is prototyping.** A shared block in the prompt says so: the takes must differ along the stated axis, nothing is final, and nothing is committed outside its branch or opened as a PR. The prompt is versioned and evaluated.
- [ ] #6 **Tools know the take.** Every TRU-12.1 tool takes a take id, and the selection says which frame and take it is in.
- [ ] #7 **Changes per take.** Each take has its own change set in TRU-4.1's tray, marked as a prototype until it is chosen.
- [ ] #8 **Choose one.** "Keep this take" merges the take into the hand-back branch. The other takes' worktrees, servers and branches are removed. "Discard all" removes every take. Neither can lose the hand-back branch's own work.
- [ ] #9 **Only the kept take reaches the PR** (TRU-13.2).
- [ ] #10 **Tests.** Unit tests for the take lifecycle. Playwright: two takes on the fixture, keep one, the other is gone. An evaluation run for the prompt.
- [ ] #11 **UI checked.** Screens and text checked against `docs/design-language.md`.
- [ ] #12 **Environment files decided first.** How a take gets the project's untracked environment files (link, copy what `.worktreeinclude` lists, or ask) is an ADR the owner accepts before this is built; Truing never reads them (TRU-14.4).
- [ ] #13 **Measured limits (TRU-14.4).** At most 3 takes by default, with no setting; each take's first compile is shown as it happens (it took 45 to 49 s on a heavy page), and the frame says it is compiling rather than looking broken.
- [ ] #14 **Takes that differ.** The prototyping block holds each take to its stated direction, and Truing notes when two takes made the same change (two of three converged in TRU-14.4).
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
From TRU-14.4 (docs/research/takes-worktrees-and-sessions.md): worktrees, cap 3, install from the package manager's store per take (8 to 9 s; a symlinked node_modules stops Turbopack), about 2.3 GB per take server, three concurrent Claude takes about $0.55 each and 25 to 35 s. Environment files need an owner decision before building.
<!-- SECTION:NOTES:END -->
