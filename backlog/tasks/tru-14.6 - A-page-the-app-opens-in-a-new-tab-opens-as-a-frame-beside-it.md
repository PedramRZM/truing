---
id: TRU-14.6
title: A page the app opens in a new tab opens as a frame beside it
status: In Progress
assignee: []
created_date: '2026-11-07 08:44'
updated_date: '2026-11-07 08:58'
labels:
  - frames
milestone: m-1
dependencies: []
parent_task_id: TRU-14
type: feature
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported 2026-11-07 on a real app: signed in, clicking an item on a list page opens it in a new tab (`target="_blank"` or `window.open`). In Truing that tab opens in the browser window outside the shell, where nothing can be inspected or changed. The person wants it as a new frame on the canvas instead. A page on another site, which Truing cannot inspect anyway, may still open as a tab.

This is the first slice of TRU-14.2 (frames as records, each navigating on its own): an opened frame has its own route and follows no one. The saved board, the page list and the frame cap stay in TRU-14.2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A page of the app opened in a new tab by a frame (a link with a target, or window.open) opens as a new frame on the canvas, beside the others, at the size of the frame that opened it; no tab stays open
- [x] #2 The new frame navigates on its own: it neither follows the other frames nor moves them, and typing a route in the route box leaves it where it is
- [x] #3 A new frame can be closed; switching between one frame and side by side keeps it
- [x] #4 A page on another site opened in a new tab still opens as a tab, and Truing's own sign-in window (TRU-10.9) is never taken for one
- [ ] #5 Unit tests cover the decision and adding, laying out and closing a new frame; the real app's new-tab link checked in Truing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. away-window.ts owns every popup of the shell page: Truing's sign-in window claims its own; any other is a page a frame opened. On the app origin it becomes `open-frame {route}` and the tab closes; another site's stays a tab.
2. The shell store derives opened frames from `frames` (any frame not the layout's own), so no new state field: they lay out after the others at the opener's size, never lead or follow, the route box leaves them, layout switches and Fill keep them, and a close button removes one.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: test/unit/away-window.test.ts (21, four new: app page -> open-frame and tab closed; blank tab sent somewhere in script; another site stays a tab; Truing's own sign-in window landing on the app is not taken for one) and test/unit/opened-frames.test.ts (3: placement and size, leader size, close). Real Chromium scratch run with a fake app: target=_blank and window.open became frames tab-1 and tab-2, no tab left; an outside link stayed a tab; the main frame navigating and a typed route moved neither new frame; side by side and back kept them; Close removed one. make check: exit 0, 1215 tests. A first version added an `opened` field to the shell state, which broke two existing tests' partial state fixtures; rather than edit those tests, the opened frames are derived from `frames`. Left: the real app's research-space link in Truing (AC 5, second half), and the page loads once in the tab before it closes, so a page that does something on load does it twice.
<!-- SECTION:NOTES:END -->
