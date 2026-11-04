---
id: TRU-12.2
title: 'Apply visual changes through Claude: responsive work and anything the direct engine can''t write'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - claude
milestone: m-2
dependencies:
  - TRU-4.1
  - TRU-5.2
  - TRU-12.1
type: feature
ordinal: 120020
parent_task_id: TRU-12
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Not every change someone makes can be applied without Claude, and responsiveness is the clearest case. Truing supports both paths from the same panel:

- **Direct.** TRU-4.1 writes the mechanical changes exactly, with no model call.
- **Through Claude.** This task. It covers everything TRU-4.1 stages as "Claude": responsive restructuring, classes or text built at runtime, elements generated from data, new variants or props, changes spread across components, and anything handed to Claude on purpose.

Responsive refinement is mostly this path. Someone working in the Phone frame shows the intent: drags the second column under the first, hides a column, shrinks a heading, moves a button below the text. The right code ranges from a breakpoint class, through an order change or a different structure, to a component swap. Choosing among those is a judgement call. It must follow how the codebase already does responsive layout, and use its tokens and components.

Figma Make sends every staged edit to its agent as a structured message, and its agent checks its work in a browser (`docs/research/figma-make-teardown.md`). We do the same for the changes that need it, with three differences: the request carries per-viewport intent and screenshots; the result is checked at Phone, Tablet and Desktop before it is kept; and Claude's part can be undone without losing the direct edits made in the same Apply.

Research: `docs/research/claude-subscription-bridge.md` (streaming, sessions, limits), `docs/research/figma-make-teardown.md`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **One request.** On Apply, the Claude-labelled changes go to Claude as one request. Each change carries the element's source locations, its component and variant, the property, the before and intended values per viewport with tokens, and the person's note if any. Screenshots of each affected frame (cropped, Truing's overlays hidden) are attached, before and with the staged preview. A test checks the exact payload.
- [ ] #2 **The rules travel with it.** Every request says to use existing tokens and components, breakpoint classes before restructuring, restructure only when classes can't express the intent, leave existing copy as it is, and touch only writable files. Claude can call TRU-12.1's tools.
- [ ] #3 **The project's way, read not configured.** How the project does responsive layout comes from Claude reading the project at the start of the session, not from a config or a list of breakpoints. Breakpoints and writable paths come from the profile. Where the profile has no writable paths, Truing asks before the first Apply and doesn't guess.
- [ ] #4 **Progress in the tray.** Each Claude change shows pending, then applied, or not applied with Claude's reason.
- [ ] #5 **Per-viewport check.** After Claude finishes, Truing reloads the route and captures Phone, Tablet and Desktop, and shows before and after for each size next to Claude's diff. The person keeps or undoes Claude's part, and direct edits from the same Apply stay. A kept Apply becomes one commit (TRU-13.2).
- [ ] #6 **Automatic checks on Claude's diff.** Off-token values are sent back to Claude once to fix before the person sees the result, and any that remain are flagged. The touched files must still pass the project's own typecheck and lint where Claude found those commands, and the page must still compile.
- [ ] #7 **Responsive fixtures.** A scripted, replayable Claude session covers: a two-column row that stacks on Phone; a table column hidden below Tablet; a toolbar that collapses into an overflow menu on Phone; a heading that uses a smaller text style on Phone; a button that moves below the text on Phone only.
- [ ] #8 **Live run.** One live run on a real page with a real Claude session is recorded here: the request, the diff, the screenshots, the time taken, and whether it was kept.
- [ ] #9 **Limits and failures.** If Claude's usage limit is reached or the session fails, the Claude changes stay staged, the direct ones stay applied, and the tray says why. Nothing is half-written.
- [ ] #10 **Permissions.** Claude's edits stay inside the writable paths. A denied write outside them is reported in the tray, never silently skipped.
- [ ] #11 **Reviewed.** The prompt and its checks get a review against `docs/design-language.md` and the prompt tests before this closes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
