---
id: TRU-16.2
title: 'One colour for components, another for elements'
status: To Do
assignee: []
created_date: '2026-11-01 10:44'
labels:
  - inspector
milestone: m-3
dependencies:
  - TRU-2.1
type: feature
ordinal: 160020
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Onlook outlines a component instance in purple and a plain element in red, and uses the same two colours in the layers tree. You can then tell at a glance whether a click landed on a component or on an element inside one. It adds a second hue to Truing's one accent, so the colours are a design decision for the task.

Research: Onlook's overlay `rect/base.tsx` and layers `tree-node.tsx`; ours in `src/modules/selection/overlay.ts` and `src/shell/styles.css`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Two kinds.** The hover and pick outlines, their labels and the tree rows use one colour when the element is the root element of a project component, and another for any other element. Both come from new `--ds-*` tokens, repeated in the overlay.
- [ ] #2 **"Project component" is worked out, not configured.** A component counts as the project's when its resolved source file lies inside the project's folder and outside `node_modules`, with no config or list of folders. On an app where source can't be resolved, everything shows as an element.
- [ ] #3 **Readable.** Each colour has 3:1 contrast as an outline, on white and on a dark background, and 4.5:1 for label text.
- [ ] #4 **Tests.** Playwright checks the outline colour for a component's root and for an element inside it.
- [ ] #5 **UI checked.** Screens checked in light and dark against `docs/design-language.md`. The maintainer picks the colours.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
