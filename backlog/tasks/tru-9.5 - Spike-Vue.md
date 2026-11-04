---
id: TRU-9.5
title: 'Spike: Vue'
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - adapters
  - spike
milestone: m-3
dependencies:
  - TRU-9.2
type: spike
ordinal: 90050
parent_task_id: TRU-9
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
What would it take for Truing to work on Vue, where there are no fibers and templates compile differently?

Questions: how does an element map to its source in Vue's dev mode; what replaces bippy; can the direct edit engine work on `.vue` single-file components; how much of the inspector and the panels stays the same.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A note in `docs/research/` with what was measured on a real Vue project, and the commands that produced it.
- [ ] #2 A recommendation with a size: build it, or wait, or leave it to Claude alone.
- [ ] #3 **Zero config assumed.** The note says how the adapter would be picked from the profile with nothing added to the project, or why that can't be done.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
