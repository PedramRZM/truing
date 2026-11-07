---
id: TRU-14.2
title: 'Frames from pages: a saved board of routes'
status: To Do
assignee: []
created_date: '2026-11-01 11:30'
updated_date: '2026-11-07 09:06'
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
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
