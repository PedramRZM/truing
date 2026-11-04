---
id: TRU-18.5
title: 'Find layout shifts, and the code behind them'
status: To Do
assignee: []
created_date: '2026-11-03 11:27'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-18.4
  - TRU-17.3
type: feature
ordinal: 180050
parent_task_id: TRU-18
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Layout shifts come from images with no size, late data, fonts, and components that mount late. Record each shift while the app is used, and name what moved and why, so Claude can fix the cause rather than guess. Builds on the performance module's CLS data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A tool returns the layout shifts in a frame since a given moment: score, elements moved, before and after boxes, and the source location of each element
- [ ] #2 Shifts are reported while Claude or a person interacts, not only on load
- [ ] #3 Shifts that follow a person's input within the browser's grace window are marked as expected
- [ ] #4 On the fixture's seeded shifts, it finds each one and reports no shift on a stable page
- [ ] #5 The numbers come with the dev-server caveat the performance module states
- [ ] #6 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
