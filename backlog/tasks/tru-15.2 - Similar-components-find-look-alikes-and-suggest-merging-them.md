---
id: TRU-15.2
title: 'Similar components: find look-alikes and suggest merging them'
status: To Do
assignee: []
created_date: '2026-11-01 21:45'
labels:
  - inspector
  - claude
milestone: m-3
dependencies:
  - TRU-2.2
  - TRU-15.1
type: feature
ordinal: 150020
parent_task_id: TRU-15
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Projects grow their own copies of the same thing: a card, a chip, an empty state, a header row, each a little different. In the component gallery (TRU-15.1), someone picks a folder and sees groups of components that look or behave alike. Each group comes with a suggestion: merge them into one component, or make them variants of a shared one.

TRU-2.2 already gives most of the inputs, for any component and not only the pick: `src/modules/selection/usages.ts` has every use of a component in the code, with file, line, static variant props and whether it sits in a `.map()`, and the run-time instances on a page are grouped by resolved type.

Research: how to measure similarity without a model first: JSX structure (tag tree), classes as tokens (TRU-1.4), props, and the primitives each one composes. Then decide whether a model helps rank or explain the groups. If it does, use an evaluation set and no word lists, since a UI can be in any language.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Groups in a folder.** For a chosen folder, the gallery shows groups of components that look alike. Each group says why its members match, from measured signals: the same primitives composed, a near-identical JSX tree, overlapping token classes, similar props, the same kind of use.
- [ ] #2 **Folders come from the project.** The folders on offer come from Claude's read of how the project is organised, in the profile. No folder pattern is hard-coded. If Claude can't tell, the person picks a folder.
- [ ] #3 **Suggestion.** Each group suggests one of three things, with the uses it would touch: merge into one component; make them variants of one component; leave them, when they only look alike.
- [ ] #4 **Side by side.** The group's members render side by side in the gallery.
- [ ] #5 **Hand-off.** "Unify these" stages one change for Claude (TRU-12.2) carrying the members, their uses and the suggestion. It is a shared-component change (TRU-2.2's `reach`), so TRU-13.2's PR says so.
- [ ] #6 **No false merges.** A labelled set of look-alike and different pairs from fixture components gives the grouping's precision and recall, recorded in the task.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
