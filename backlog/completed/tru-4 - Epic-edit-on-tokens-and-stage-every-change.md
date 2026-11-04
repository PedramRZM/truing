---
id: TRU-4
title: 'Epic: edit on tokens, and stage every change'
status: Done
assignee: []
created_date: '2026-11-03 11:21'
updated_date: '2026-11-03 11:21'
labels:
  - epic
  - panels
  - tokens
dependencies: []
type: epic
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Visual tools usually write raw values and leave the system behind. Edits here have to stay on the project's tokens and arrive as exact source changes a developer can review.

## Outcome

A person edits layout, spacing, type, colour, effects and more from panels that offer the project's tokens, and each change waits in a tray until it's written to source.

## Scope and non-goals

- In: the Changes tray, the direct edit engine, the properties panels, changing every element alike.
- Out: changes needing judgement, which go to Claude; creating tokens.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WHEN a person changes a value THEN it waits in the Changes tray with its own undo
- [x] #2 WHEN a token swap, text or variant change is applied THEN it's written to source exactly, with no model call
- [x] #3 WHEN a typed number is off the scale THEN it snaps to the nearest step and says so
- [x] #4 WHEN a shared component is changed THEN the person can see and choose whether it's one use or every use
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
