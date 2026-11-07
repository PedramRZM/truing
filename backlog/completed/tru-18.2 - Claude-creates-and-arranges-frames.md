---
id: TRU-18.2
title: Claude creates and arranges frames
status: Done
assignee: []
created_date: '2026-11-03 11:27'
updated_date: '2026-11-07 11:15'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-12.1
  - TRU-14.2
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-18
type: feature
ordinal: 180020
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give Claude tools to set up what it needs to see: open a frame at a route and size, move it, resize it, and close it. They use the same board a person uses, so a person sees everything Claude does and can take over.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tools open, move, resize, navigate and close frames, and each shows on the canvas as it happens
- [x] #2 Frames Claude opened are marked, and closing them leaves a person's frames alone
- [x] #3 It honours the board's frame cap, and an error says what to do next
- [x] #4 Tool names, descriptions and schemas are snapshot-tested
- [x] #5 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence 2026-11-07: test/unit/frames-tools.test.ts (tool list snapshot; list; open waits for the page; cap with what to do; close refuses a person's frame; unknown frames and unsafe routes refused; navigate, resize, move ops) and test/unit/shell-store.test.ts (Claude's ops applied without moving the person's selection; a person's frame not closed). Real Chromium: every tool called through the module host on a fake app; the frame showed with its name and Claude mark, moved, resized; close refused main and closed claude-1. On by default (DEFAULT_MODULES; a saved project gets it too). make check: exit 0, 1245 tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A frames module gives Claude tools to list, open, move, resize, navigate and close frames on the person's board; Claude's frames are marked and a person's are never closed.
<!-- SECTION:FINAL_SUMMARY:END -->
