---
id: TRU-16.8
title: 'A view menu, zoom to selection, and a toast for keys'
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-3.5
type: feature
ordinal: 160080
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper's zoom percentage opens one menu for everything about how you view the canvas. TRU-3.5 leaves ours as a percentage, and a growing set of toggles has no home. Paper also confirms each command run by key with a short toast at the canvas's foot ("Zoom to selection"), which teaches shortcuts and reassures. We have no zoom to selection, which people use constantly.

Research: `docs/research/paper-design-teardown.md` ("Other things Paper has"); `src/shell/camera.ts`, `commands.ts`, `command-views.tsx` (`Notice`), `src/commands.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The menu.** Opens from the zoom percentage. Zoom in, Zoom out, Zoom to 100%, Zoom to fit, Zoom to selection, with keys. Then the toggles: Spacing, the theme (Light, Dark, System), and anything later tasks add, each with a tick. All from TRU-2.3's command list.
- [ ] #2 **Zoom to selection.** Shift+2 fits the pick in the canvas. Without a pick, it says so.
- [ ] #3 **The toast.** A short message at the canvas's foot names a command run by key, for about 1.5 seconds. It doesn't fire for moves or picks, it replaces itself rather than stacking, and it respects reduced motion.
- [ ] #4 **Settings persist** across restarts, in Truing's own settings outside the project. Nothing is written to the project, and no config entry is involved.
- [ ] #5 **Tests.** Playwright: the menu's commands, Shift+2's zoom, the toast's text and that it clears.
- [ ] #6 **UI checked.** Screens and text checked against `docs/design-language.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
