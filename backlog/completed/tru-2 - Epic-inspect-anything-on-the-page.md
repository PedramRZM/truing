---
id: TRU-2
title: 'Epic: inspect anything on the page'
status: Done
assignee: []
created_date: '2026-11-03 11:21'
updated_date: '2026-11-03 11:21'
labels:
  - epic
  - inspector
dependencies: []
type: epic
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Before changing anything, a designer needs to know what it is and what else it touches. Developer tools show DOM, not components or tokens.

## Outcome

A person clicks anything and sees its component, variant, source locations, tokens and every other instance.

## Scope and non-goals

- In: selecting, inspecting, instances, keys, spacing overlays, the right-click panel.
- Out: inspecting states and contrast, and heavy signed-in screens, which are later tasks.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WHEN a person clicks an element THEN they see its component, variant, source location and tokens
- [x] #2 WHEN a component is selected THEN every other instance shows, with a count
- [x] #3 WHEN a person right-clicks THEN they can reach the element's ancestors and what lies under the pointer
- [x] #4 WHEN spacing is turned on THEN gaps show with their token names
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
