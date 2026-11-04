---
id: TRU-3
title: 'Epic: a shell that works like a design tool'
status: Done
assignee: []
created_date: '2026-11-03 11:21'
updated_date: '2026-11-03 11:21'
labels:
  - epic
  - panels
dependencies: []
type: epic
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Designers should recognise the workbench: panels beside the canvas, layers written for them, controls with numbers and swatches. A devtools look would keep them out.

## Outcome

Truing's own screens follow `docs/design-language.md`: fixed panels, a tool rail, layers with a Code view, and shared controls.

## Scope and non-goals

- In: theme, fonts, panels, tabs, rail, layers, sections by selection, the shared controls.
- Out: what the controls edit, which is the next epic.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WHEN Truing opens THEN the panels stay open beside the canvas, with Design and Theme tabs and a vertical tool rail
- [x] #2 WHEN a person selects an element THEN the design panel's sections follow the selection
- [x] #3 WHEN a person opens layers THEN rows read as design layers, with a Code view behind them
- [x] #4 WHEN Truing is run offline THEN it shows its own fonts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed when the backlog was reshaped into epics: every child task was already Done. The acceptance scenarios restate what those tasks delivered and proved; they were not re-verified at that point.
<!-- SECTION:FINAL_SUMMARY:END -->
