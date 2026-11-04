---
id: TRU-15
title: 'Epic: components across the app'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - inspector
milestone: m-3
dependencies: []
type: epic
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Drift hides in near-duplicates and one-off icons, and it's hard to see a project's components when they're scattered across pages.

## Outcome

A person browses a gallery of whatever components the project has, finds look-alikes to merge, and swaps an icon on one element or all like it.

## Scope and non-goals

- In: the gallery, similar components, swapping icons.
- Out: building new components from nothing.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person opens the gallery THEN it shows what the project has, with no story files needed
- [ ] #2 WHEN components look alike THEN Truing says so and suggests merging them
- [ ] #3 WHEN a person swaps an icon THEN they choose one element or every one like it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
