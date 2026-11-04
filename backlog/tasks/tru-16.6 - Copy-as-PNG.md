---
id: TRU-16.6
title: Copy as PNG
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - inspector
milestone: m-3
dependencies:
  - TRU-2.4
type: feature
ordinal: 160060
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper's Copy as menu puts a shot of the selection on the clipboard with one key. People paste shots into chats and reviews all day, and today that means a screen capture and a crop. Truing's own browser can shoot exactly the picked element.

Paper's other Copy as entries, Tailwind and React CSS, generate code from a canvas. We have the real source, and `Copy classes` already exists, so they aren't needed.

Research: `src/modules/selection/module.ts` (the `copy` menu), `server.ts`; Playwright's element screenshot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The command.** Copy as PNG, in the right-click panel's Copy group and TRU-2.3's command list, Ctrl+Shift+C where free. The toast from TRU-16.8 confirms it.
- [ ] #2 **The image.** Exactly the element, at the frame's real size (not the canvas's zoom), at 2×, with no Truing overlays, transparency kept.
- [ ] #3 **Any frame.** Works for a pick in any viewport frame, and for an element partly out of view.
- [ ] #4 **Needs nothing from the project.** It works from the running page on any app Truing can open, framework or not, with no config.
- [ ] #5 **Failure.** Clipboard refused: the message says so, and offers to save the file.
- [ ] #6 **Tests.** Playwright on the fixture: the image's dimensions, and that a pick's outline colour isn't in it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
