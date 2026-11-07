---
id: TRU-18.3
title: Claude takes screenshots of any frame or element
status: In Progress
assignee: []
created_date: '2026-11-03 11:27'
updated_date: '2026-11-07 10:33'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-12.1
  - TRU-16.6
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-18
type: feature
ordinal: 180030
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude needs to see its work without asking. This shares one capture path with Copy as PNG, so a screenshot means the same thing to a person and to Claude: the real size, with no Truing overlays.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A tool captures a whole frame or one element at the frame's real size, with no Truing overlays
- [ ] #2 It uses the same capture code as Copy as PNG, with one implementation
- [ ] #3 An element out of view is scrolled to, and the page's scroll is put back afterwards
- [x] #4 Images reach Claude within a stated size limit, downscaled if needed
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
Capture brings the frame into view on the canvas for a moment (camera fit, at most 1568 px on the longer side), crops without Truing's marks, and puts the camera back; element captures scroll the element into view in its frame and put the page's scroll back. Real Chromium: frame and element pictures came back clean (752x1003 for a tablet frame on a 1600 px canvas). Not met as written: #1 "the frame's real size" is the size the canvas can show, at most 1568 px, which can be smaller than the frame; #2 Copy as PNG (TRU-16.6) does not exist yet, so capture() is the one implementation it must use; #3 the scroll back is written but not yet seen working on a page that scrolls.
<!-- SECTION:NOTES:END -->
