---
id: TRU-16.12
title: 'Decide on an inline surface: Truing on the app''s own page'
status: To Do
assignee: []
created_date: '2026-11-01 10:44'
labels:
  - spike
  - inspector
milestone: m-3
dependencies:
  - TRU-2.3
type: spike
ordinal: 160120
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Airship has two surfaces: the canvas of frames, as we built, and **inline**, where the editor sits on the app's own page. TRU-2.3's Fill viewport came first, and this decides on true inline after using it.

**What inline gives:** the real page, with real scroll, `position: fixed`, portals and modals at the true viewport; no iframe; the state you clicked your way to, in one app instance.

**What it costs:** one width only; the app's CSS and keys meet the editor's; z-index fights with the app's top layer (`<dialog>`, popovers); and the editor's nodes have to stay out of hit tests and the layers tree.

ADR 0001 chose the canvas, so building inline means a new ADR that extends it.

Research: Airship's `packages/overlay/src/surface.ts` and `edit-guard.ts`; our overlay's shadow root (`src/modules/selection/overlay.ts`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The same language.** If the inline surface goes ahead, its panels follow `docs/design-language.md`. They live on the app's own page, in a shadow root, so the `--ds-*` tokens have to be delivered there from one source and not copied by hand. The decision records how.
- [ ] #2 **Decided.** After using Fill, record which problems it leaves that inline would solve, if any, with an example screen for each.
- [ ] #3 **If inline goes ahead:** an ADR extends ADR 0001; the docks and overlay mount on the app's page inside a shadow root, behind a Canvas/Inline switch in the toolbar that is remembered; picking never reaches the app; Truing's keys don't fire while the app's fields have focus; the editor never appears in the layers tree; Playwright covers the switch and a pick inside an open dialog, inline.
- [ ] #4 **Nothing added to the app.** Whichever way it goes, inline is injected by Truing's own browser, like the canvas. It adds nothing to the project, reads no config, and works on the same frameworks the canvas does.
- [ ] #5 **If it doesn't:** this task records why and closes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
