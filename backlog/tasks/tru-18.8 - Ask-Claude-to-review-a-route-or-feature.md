---
id: TRU-18.8
title: Ask Claude to review a route or feature
status: To Do
assignee: []
created_date: '2026-11-03 11:27'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-18.2
  - TRU-18.3
  - TRU-18.5
  - TRU-18.6
type: feature
ordinal: 180080
parent_task_id: TRU-18
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring the tools together. A person asks for a review; Claude sets up frames, walks the routes at each size, runs the checks and writes a report in a panel. A person decides what happens to each finding: it can be staged for a fix or dismissed. Nothing is written until the person says so.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A person starts a review from the shell, for a route or a list of routes, and sees the budget first
- [ ] #2 Findings appear in a panel as they come, each with a screenshot, a source location and the size it was seen at
- [ ] #3 Each finding can be staged in the Changes tray, labelled Claude, or dismissed
- [ ] #4 Claude changes no source during a review
- [ ] #5 The review's prompt is versioned, and evaluated on a fixture with seeded bugs, with its pass rate recorded here
- [ ] #6 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
