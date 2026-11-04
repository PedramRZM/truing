---
id: TRU-18.2
title: Claude creates and arranges frames
status: To Do
assignee: []
created_date: '2026-11-03 11:27'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-12.1
  - TRU-14.2
type: feature
ordinal: 180020
parent_task_id: TRU-18
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give Claude tools to set up what it needs to see: open a frame at a route and size, move it, resize it, and close it. They use the same board a person uses, so a person sees everything Claude does and can take over.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tools open, move, resize, navigate and close frames, and each shows on the canvas as it happens
- [ ] #2 Frames Claude opened are marked, and closing them leaves a person's frames alone
- [ ] #3 It honours the board's frame cap, and an error says what to do next
- [ ] #4 Tool names, descriptions and schemas are snapshot-tested
- [ ] #5 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
