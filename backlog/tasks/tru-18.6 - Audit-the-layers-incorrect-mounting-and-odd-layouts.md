---
id: TRU-18.6
title: 'Audit the layers: incorrect mounting and odd layouts'
status: To Do
assignee: []
created_date: '2026-11-03 11:27'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-12.1
  - TRU-2.1
type: feature
ordinal: 180060
parent_task_id: TRU-18
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Some bugs show in the tree and not on the screen: a component that remounts on every render because it's defined inside another, a list with unstable keys that loses state, a scroll inside a scroll, content overflowing its parent, an element positioned over a gap. A tool walks the React tree and the layout and reports these with where they are in the code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A tool reports components that remount during an interaction, with the parent and source location
- [ ] #2 It reports lists whose keys change or repeat
- [ ] #3 It reports layout oddities: overflow past a parent, nested scroll regions, zero-size elements with content, and fixed sizes that break at another frame width
- [ ] #4 Each detector has seeded cases in the fixture, and its precision on them is recorded here
- [ ] #5 In a project without React, the React checks say so and the layout checks still work
- [ ] #6 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
