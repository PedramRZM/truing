---
id: TRU-16.11
title: A Cmd+K command palette
status: To Do
assignee: []
created_date: '2026-11-01 10:44'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-2.3
type: feature
ordinal: 160110
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-2.3 puts every Truing command in one list, for the keys, the `?` sheet and the tooltips. Airship also drives a command palette from that kind of list.

Research: Airship's `packages/overlay/src/keys/palette.ts` and `keys/catalog.ts`; TRU-2.3's command list.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The palette.** Cmd+K or Ctrl+K opens a search field over Truing. It lists only the commands that work right now, each with its shortcut. Typing filters the list; arrows move, Enter runs, Esc closes. Focus stays in the field (`aria-activedescendant`). With focus inside a frame, Cmd+K still opens it and never reaches the app.
- [ ] #2 **Search in the sheet.** The `?` shortcuts sheet gets a search field with the same filter as the palette.
- [ ] #3 **One source.** The palette reads TRU-2.3's command list. A module's commands appear once the module declares them.
- [ ] #4 **Needs nothing from the project.** It is Truing's own chrome, so it reads no config and no project file, and behaves the same on every app. When the app uses Cmd+K itself, Truing's window still takes it first, and the person can reach the app's through Interact mode.
- [ ] #5 **Tests.** Playwright: open, filter, run a command, Esc. An unavailable command is not listed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
