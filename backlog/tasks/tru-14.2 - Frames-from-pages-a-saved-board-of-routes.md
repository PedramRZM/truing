---
id: TRU-14.2
title: 'Frames from pages: a saved board of routes'
status: To Do
assignee: []
created_date: '2026-11-01 11:30'
updated_date: '2026-11-07 09:39'
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
- [ ] #1 **A frame is a record:** a name, a route, a size or preset, a position, and an optional follow group. Today's Phone, Tablet and Desktop set becomes one group.
- [ ] #2 **Making frames.** From a page list, from a link ("Open in new frame", in the context menu and with Cmd/Ctrl-click in Select mode), by duplicating a frame, or by typing a URL.
- [ ] #3 **The page list needs no setup.** It uses the source TRU-14.1 recommends for the project's framework, or Claude's read of the routes in the profile. A dynamic route offers the URLs already visited for it. If no list can be found, the list says so, and typing a URL still works.
- [ ] #4 **Each frame navigates on its own**, unless it is in a follow group.
- [ ] #5 **Rename and delete.** Delete can be undone.
- [ ] #6 **The board is saved** outside the repository, next to the profile, so Claude's tools (TRU-12.1) can read it, and it is back when Truing restarts. Nothing is added to the project and no file needs ignoring.
- [ ] #7 **Limits.** The frame cap and the off-screen policy from TRU-14.1. Reaching the cap says so, with a way forward.
- [ ] #8 **The panels follow the active frame.** The layers tree, the inspector and the pick restore all work per frame.
- [ ] #9 **Tests.** Unit tests for the board file and the group rule. Playwright: add a frame from the page list, open a link in a new frame, restart, and the board is back.
- [ ] #10 **UI checked.** Screens and text checked against `docs/design-language.md`.
- [ ] #11 **The selected frame owns the top bar.** Clicking a frame selects it; the route box, the device menu and Side by side then act on that frame only. Side by side turns the selected frame into a Phone, Tablet and Desktop group that follows one route, and back. (The person's decision, 2026-11-07.)
- [ ] #12 **Frames already open become records.** Frames opened from a new tab (TRU-14.6) are ordinary frames on the board, and a frame Claude opens is marked as Claude's.
- [ ] #13 **Measured limits (TRU-14.1).** Up to 12 frames by default, with no setting; frames off screen stay loaded so they keep their state; the frame count and memory are logged so the cap can be revisited.
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
<!-- SECTION:NOTES:END -->
