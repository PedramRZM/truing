---
id: TRU-16.7
title: Copy and paste styles between elements
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-4.3
type: feature
ordinal: 160070
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper has Copy styles and Paste styles (Ctrl+Alt+C and V). For us this is an ordinary design-system fix: make these three cards match that one, with tokens and without retyping. Because it copies classes, it can't introduce a new value.

Research: `docs/research/paper-design-teardown.md` ("Other things Paper has"); TRU-4.3's class writes, TRU-2.2's reach, TRU-4.1's change set; `src/edits/`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Copy.** Takes the pick's visual classes: colour, type, radius, border, shadow, spacing. Layout position and sizes stay out, with a choice to include them.
- [ ] #2 **Paste.** Stages one change per target, using `tailwind-merge` so conflicting classes are replaced, and the tray shows a before and after for each.
- [ ] #3 **The project's merge rules, found not set.** Custom merge groups come from the project's own helper when Claude's read found one, and otherwise from the defaults. On a project that doesn't use utility classes, the paste goes to Claude with the reason. Nothing is configured.
- [ ] #4 **The same two paths.** Direct where the class string is static; Claude with the reason otherwise; a shared component says what else it reaches.
- [ ] #5 **Off-token values** copied from the source show flagged on paste, per TRU-11.2.
- [ ] #6 **Keys.** Ctrl+Alt+C and V, and both in the right-click panel, in TRU-2.3's command list.
- [ ] #7 **Tests.** Unit tests for class filtering and merging. Playwright: copy from one fixture card to another and check the source diff.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
