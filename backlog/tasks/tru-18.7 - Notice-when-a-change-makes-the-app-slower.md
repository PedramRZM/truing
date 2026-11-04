---
id: TRU-18.7
title: Notice when a change makes the app slower
status: To Do
assignee: []
created_date: '2026-11-03 11:27'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-18.4
  - TRU-17.4
type: feature
ordinal: 180070
parent_task_id: TRU-18
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude can already measure before and after one fix. This watches for regressions: repeat the same walk through the app on the base branch's numbers and after the changes, and say what got slower, by how much, and which components rendered more.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A tool records a walk through the app and can repeat it, with the same steps and frame size
- [ ] #2 A comparison gives metrics, long tasks and render counts for both runs
- [ ] #3 A difference smaller than the run-to-run noise on that machine is not called a regression
- [ ] #4 The report states that the numbers come from the dev server and are for comparison
- [ ] #5 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
