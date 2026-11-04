---
id: TRU-16.5
title: 'Add flex, reading the layout, and layout shortcuts'
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-4.2
type: feature
ordinal: 160050
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In Paper, Shift+A on a frame turned two rectangles 20 px apart, with 40 px around them, into flex with gap 20 and padding 40. It reads what you already see and turns it into structure. On real pages that means turning a stack spaced by margins into a flex with a gap, which is both tidier code and a common design-system cleanup.

Research: `docs/research/paper-design-teardown.md` ("The right panel" and "Other things Paper has"); TRU-4.2's class writes; TRU-12.2 for what goes through Claude.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Add flex.** Shift+A on a pick with block children works out direction from the children's positions, gap from the space between them, and padding from the space around them. Each is the nearest spacing token, with any rounding shown.
- [ ] #2 **Project's scale, no setup.** The tokens it rounds to come from the project's own token table, with no scale assumed or configured. With no spacing tokens, it uses exact values on Tailwind's scale, or asks Claude to write it when the project doesn't use Tailwind.
- [ ] #3 **Staged, not silent.** It stages one change with a before and after, including removing child margins it replaces. Removing margins from other files' components goes through Claude (TRU-12.2), with the reason.
- [ ] #4 **Refuses clearly.** Children that overlap or sit irregularly get a message and no change.
- [ ] #5 **Layout keys.** From TRU-2.3's command list: Remove flex, Alt+W/A/S/D for alignment on the pad, Alt+C for clip. Check these against existing keys first.
- [ ] #6 **Tests.** Unit tests for inference across row, column, uneven and overlapping children. Playwright: Shift+A on a fixture stack and the source diff.
- [ ] #7 **UI checked.** Screens checked against `docs/design-language.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
