---
id: TRU-16
title: 'Epic: everyday editing'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - panels
  - inspector
milestone: m-3
dependencies: []
type: epic
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

What makes a tool pleasant is the long tail of daily moves: states, contrast, drag handles, copying styles, reordering, a command palette.

## Outcome

A person does common refinements directly on the canvas, with the keys and menus they'd expect from a design tool.

## Scope and non-goals

- In: states and contrast, colours, sizing labels, drag handles, flex, copying, view menu, reorder, insert, command palette, the inline-surface decision.
- Out: anything needing a new data source from the project beyond the profile.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person inspects an element THEN they can see its states and its text contrast
- [ ] #2 WHEN a person drags a gap or padding on the canvas THEN it's staged like any other change
- [ ] #3 WHEN a person drags siblings into a new order THEN the reorder is written to source
- [ ] #4 WHEN a person presses Cmd+K THEN they can run any command from one palette
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
