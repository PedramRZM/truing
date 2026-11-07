---
id: TRU-14.1
title: 'Spike: what many frames of the app cost, and where a page list comes from'
status: To Do
assignee: []
created_date: '2026-11-01 11:30'
updated_date: '2026-11-07 09:06'
labels:
  - spike
milestone: m-3
dependencies:
  - TRU-1.5
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-14
type: spike
ordinal: 140010
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-14.2 wants several routes of the app on the canvas at once, each its own frame, kept between sessions. Every frame is a full app instance, with its React tree, its hot-reload socket, its timers and its requests. Airship caps its frames at 8 and loads only those near the view for that reason. Before TRU-14.2 is planned in detail, we need numbers.

Questions to answer, with measurements:

1. Memory and CPU of 1, 4 and 8 frames of a heavy route and a light one, idle and during a hot reload, on two machines.
2. Does one file save hot-reload every frame at once? How long until all are settled?
3. Can a frame far off screen be unloaded, or swapped for a screenshot, and come back with its state? Or does it reload?
4. Does Next's `get_routes` give every page pattern, the dynamic ones included? Which visited URLs fill in `[id]`?
5. Do frames of different routes break TRU-2.1's pick restore, or the leader-follow rule?
6. On a project that isn't Next, what does Claude find when asked for the routes, and how often is it right?

Research: `docs/research/menus-spacing-frames-takes.md` ("Frames from pages").
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A note in `docs/research/` with the numbers and the commands that produced them.
- [ ] #2 A recommended frame cap and an off-screen policy, as defaults that need no setting.
- [ ] #3 **A page list for any project.** The note recommends where the route list comes from for each framework Truing supports and for those it doesn't: a framework's own API where one exists, and otherwise Claude reading the routes into the profile. It needs no config, and says what to do when neither works.
- [ ] #4 TRU-14.2's criteria are updated from the answers.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
