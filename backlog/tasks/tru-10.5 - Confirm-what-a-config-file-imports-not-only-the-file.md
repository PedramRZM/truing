---
id: TRU-10.5
title: 'Confirm what a config file imports, not only the file'
status: To Do
assignee: []
created_date: '2026-11-04 01:01'
labels:
  - zero-config
milestone: m-1
dependencies: []
parent_task_id: TRU-10
type: feature
ordinal: 100050
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Confirming a `truing.config.ts` hashes that one file. A file it imports, or a module it lists, can change afterwards and run with no new question. This isn't a sandbox either way, since the start command runs the project's code on every start, and the screen says imports run too. Covering them would catch a changed config more fully (ADR 0005).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a file a config imports changes THEN Truing asks again before loading it
- [ ] #2 WHEN a module the config lists changes THEN Truing asks again before loading it
- [ ] #3 The confirm screen lists the local files that run
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
