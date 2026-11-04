---
id: TRU-16.9
title: 'Drag to reorder sibling elements, written to source'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-4.1
  - TRU-12.2
type: feature
ordinal: 160090
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People want to change things by dragging. In a code-backed editor, a safe drag means reordering siblings written one after another in the same JSX parent: cards in a row, fields in a form, items in a toolbar. Each drop becomes a move of JSX elements in one file, done with no model call.

Some moves can't be done this way: across parents, into another file, inside a `.map()` over data, or within conditionally rendered children. Those are still allowed. The drop is previewed and staged as a Claude change with its intent recorded: "move X after Y", at which viewport. A drag in the Phone or Tablet frame that should apply only at that size is staged the same way.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Drag preview.** In Select mode, dragging a selected element among its static siblings shows a drop indicator and a live preview of the new order.
- [ ] #2 **Drop.** Dropping moves the JSX element in the source, comments included, via TRU-4.1's engine. The rest of the file's diff is formatting only.
- [ ] #3 **Moves that need Claude.** A drag where a direct move is impossible, or that applies to one viewport only, is still previewed and is staged as a Claude change with its intent and reason, applied by TRU-12.2.
- [ ] #4 **Keyboard.** Alt+Up and Alt+Down reorder a selected element.
- [ ] #5 **Nothing to set up.** It works from the source locations Truing already resolves, with no config, path or project setting. Whether a move stays inside writable files comes from the profile, and a move outside them says so and offers Claude.
- [ ] #6 **Tests.** Unit tests on fixture files cover a flex row, a form, siblings with comments, and a refused `.map()`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
