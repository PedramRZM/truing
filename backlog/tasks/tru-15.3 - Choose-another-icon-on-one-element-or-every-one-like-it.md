---
id: TRU-15.3
title: 'Choose another icon, on one element or every one like it'
status: To Do
assignee: []
created_date: '2026-11-02 23:16'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-4.5
type: feature
ordinal: 150030
parent_task_id: TRU-15
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-4.5 spreads an icon's colour, fill, lines and size across every element like it. Choosing another icon is a different write: a JSX tag and an import, not classes.

Research: `src/edits/engine.ts`, `src/modules/selection/similar-plan.ts`; how to list icons without bundling them all in the shell.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Which icon library, found not set.** The icon library comes from the project's own dependencies and imports, read by Claude and stored in the profile. lucide-react is the first one supported. No library is assumed or configured. For a library Truing can't list yet, the panel says so and offers to hand the swap to Claude.
- [ ] #2 **Choosing.** A pick that's an icon from a supported library offers a searchable menu of icons from the version the project has installed, and pointing at one shows it on the page.
- [ ] #3 **Writing.** A new edit kind renames the tag and adds the import, removing the old import when nothing else uses it. Anything else goes to Claude with the reason.
- [ ] #4 **Every one like it.** TRU-4.5's prompt spreads it.
- [ ] #5 **Tests.** Unit tests on the edit: one place, a `.map()`, an import kept and an import dropped.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
