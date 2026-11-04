---
id: TRU-14
title: 'Epic: pages, frames and takes'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - panels
milestone: m-3
dependencies: []
type: epic
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Refining one page at a time hides inconsistencies, and asking Claude for one attempt hides options. Teams want to see many routes at once, and several takes side by side.

## Outcome

A person lays out a saved board of routes, finds pages from the app's own routes, and compares several versions from Claude, keeping one.

## Scope and non-goals

- In: the cost spikes, the board, the Pages section, side-by-side takes.
- Out: designing new pages from nothing.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

Two spikes come first: what many frames cost, and dev servers across worktrees with sign-in across ports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person builds a board THEN routes stay saved as frames
- [ ] #2 WHEN a person opens Pages THEN the list comes from the app's own routes, with no config
- [ ] #3 WHEN a person asks for several takes THEN they run side by side and the person keeps one
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
