---
id: TRU-16.4
title: Drag gap and padding on the canvas
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - inspector
  - panels
milestone: m-3
dependencies:
  - TRU-2.5
  - TRU-4.2
type: feature
ordinal: 160040
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper shows small ticks at each gap and padding of a flex frame, and hovering one fills the area in light purple with its value. TRU-2.5 already draws our gaps and token labels, read-only. Making them draggable is the fastest way to adjust spacing, and because a drag only steps through the project's scale, it can't produce an off-token value.

Paper's handles were only hovered, not dragged, so the drag's feel needs a look when this starts.

Research: TRU-2.5's outcome, TRU-4.2's writes and its Direct or Claude split; `src/modules/selection/overlay.ts`, `measure.ts`, `spacing-tokens.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Handles.** With a pick that has padding or a gap, a small tick shows at each. Hovering fills that area and shows the token and its px value, and hit areas stay at least 16 px even at low zoom.
- [ ] #2 **Drag.** Dragging steps through the project's spacing scale, with the preview live. Release stages one change through TRU-4.2's writes. Alt or Shift applies padding to the opposite side or to all sides.
- [ ] #3 **The scale is the project's.** Steps come from the project's own token table. No scale is hard-coded and nothing is configured. A project with no spacing tokens steps through Tailwind's defaults, or whole pixels without Tailwind, and the handle says which.
- [ ] #4 **Not in the way.** Handles don't appear in Interact mode, and don't block picking what's underneath except on the tick.
- [ ] #5 **Same path.** A drag produces the same staged change as the panel: Direct or Claude, with the reason, and breakpoint scope from TRU-4.2.
- [ ] #6 **Off-token start.** A gap holding an off-token value snaps to the nearest step on the first move, and the change says so.
- [ ] #7 **Tests.** Playwright on the fixture: a drag staged as the right class change, at two zoom levels.
- [ ] #8 **UI checked.** Screens checked against `docs/design-language.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
