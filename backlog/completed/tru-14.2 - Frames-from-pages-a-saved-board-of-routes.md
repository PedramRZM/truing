---
id: TRU-14.2
title: 'Frames from pages: a saved board of routes'
status: Done
assignee: []
created_date: '2026-11-01 11:30'
updated_date: '2026-11-07 11:15'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-14.1
  - TRU-2.3
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-14
type: feature
ordinal: 140020
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today the canvas shows one route: one frame, or Phone, Tablet and Desktop of it, which follow each other. People want to make frames from pages: three screens side by side, arranged, and still there tomorrow.

The sweep (`docs/research/menus-spacing-frames-takes.md`) points to Airship's frame mechanics on Onlook's data model. A frame becomes a record, and the board is saved. In Airship, each frame navigates on its own, frames are capped, and off-screen ones are lazy. In Onlook, a frame is a row holding its URL and box.

Research: the note above and TRU-14.1's findings; ours in `src/shell/store.ts` (frames, the leader rule) and `src/shell/canvas.tsx`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **A frame is a record:** a name, a route, a size or preset, a position, and an optional follow group. Today's Phone, Tablet and Desktop set becomes one group.
- [x] #2 **Each frame navigates on its own**, unless it is in a follow group.
- [x] #3 **Rename and delete.** Delete can be undone.
- [x] #4 **The board is saved** outside the repository, next to the profile, so Claude's tools (TRU-12.1) can read it, and it is back when Truing restarts. Nothing is added to the project and no file needs ignoring.
- [x] #5 **Limits.** The frame cap and the off-screen policy from TRU-14.1. Reaching the cap says so, with a way forward.
- [x] #6 **The panels follow the active frame.** The layers tree, the inspector and the pick restore all work per frame.
- [x] #7 **Tests.** Unit tests for the board file and the group rule. Playwright: add a frame from the page list, open a link in a new frame, restart, and the board is back.
- [x] #8 **UI checked.** Screens and text checked against `docs/design-language.md`.
- [x] #9 **The selected frame owns the top bar.** Clicking a frame selects it; the route box, the device menu and Side by side then act on that frame only. Side by side turns the selected frame into a Phone, Tablet and Desktop group that follows one route, and back. (The person's decision, 2026-11-07.)
- [x] #10 **Frames already open become records.** Frames opened from a new tab (TRU-14.6) are ordinary frames on the board, and a frame Claude opens is marked as Claude's.
- [x] #11 **Making frames.** From a link (Cmd/Ctrl-click in Select mode, or "Open link in new frame" in the right-click menu), by copying a frame (New frame), and by typing a route into that copy. From the Pages list: TRU-14.3.
- [x] #12 **Measured limits (TRU-14.1).** Up to 12 frames by default, with no setting, also for a saved board, Side by side and Undo; frames off screen stay loaded so they keep their state; the frame count is logged when it changes. Memory is measured with the TRU-14.1 script, not logged: Truing's persistent browser profile gives it no process to read.
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
From TRU-14.1 (docs/research/frame-cost-and-page-list.md): further frames of one app cost 30 to 60 MB each and idle near 0% CPU, one save refreshes every frame within 0.4 s, so cap 12 and keep frames loaded. Follow groups replace the single leader. The board file goes next to the profile. Criterion #9 asks for Playwright; there is no browser suite by the owner's choice, so it is covered by unit tests and a recorded look from a .scratch script.

Rescoped 2026-11-07 after review: the page list (old #2 in part, #3) moved to TRU-14.3, which also gets opening a page as a new frame. Memory logging dropped from the limits criterion, with the reason in its text.

Evidence 2026-11-07: unit tests test/unit/opened-frames.test.ts (records, Side by side and fold, device, group route, link frames), test/unit/board.test.ts (file round trip, broken and unsafe boards refused, state round trip), test/unit/shell-store.test.ts (the store itself through a fake socket: group follow and turn-back, next leader after close, cap, Undo within the cap, debounced save, fresh ids after restart), each guard mutation-checked. Real Chromium scratch scripts: select a new frame, type a route, Side by side, group follows, fold; board survives a restart; New frame, rename, close and Undo, Ctrl-click a link, right-click "Open link in new frame", the cap notice; a pick in a frame drives the panels (frameToShow). UI at 1280 light and 1440 dark: notice with Undo, close and New frame buttons; hit areas 24x24 or more. Code review (fresh context) found ten issues, all fixed in 3d6d61a; copy review found three, fixed. The board file is plain JSON next to the profile, for Claude's tools in TRU-18.2. make check: exit 0, 1235 tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Frames are records: the selected frame owns the top bar, Side by side per frame, groups follow their leader, links and New frame make frames, rename, close with Undo, a cap of 12, and the board saved per project. Page list moved to TRU-14.3.
<!-- SECTION:FINAL_SUMMARY:END -->
