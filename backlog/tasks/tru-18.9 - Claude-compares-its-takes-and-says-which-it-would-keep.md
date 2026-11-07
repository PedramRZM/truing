---
id: TRU-18.9
title: Claude compares its takes and says which it would keep
status: To Do
assignee: []
created_date: '2026-11-03 11:27'
updated_date: '2026-11-07 09:06'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-14.5
  - TRU-18.3
  - TRU-18.5
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-18
type: feature
ordinal: 180090
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Side-by-side takes leave the comparing to the person. Claude can do the legwork: capture every take at every size, run the same checks on each, and lay out how they differ. The person still chooses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A comparison shows every take at every size, in one view, from the same route and state
- [ ] #2 Each take gets the same checks: tokens used, layout shifts and performance
- [ ] #3 Claude states a recommendation and why, and the person makes the choice
- [ ] #4 Nothing is kept or thrown away until the person chooses
- [ ] #5 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
