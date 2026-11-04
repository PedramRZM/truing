---
id: TRU-8
title: 'Epic: read everything through Claude'
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - epic
  - zero-config
  - claude
milestone: m-1
dependencies: []
type: epic
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Setup reads a project once, for the essentials. The rest of what Truing needs should come the same way, with no config: tokens in any form, what may be written, when the profile has gone stale, and why an app failed to start. Each read is structured, read-only, checked against the folder, and asks the person when Claude can't tell.

Code to build on: `src/setup/read-project.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every value Truing needs from a project can come from the profile or a read by Claude, and a person is asked only when Claude can't tell.
- [ ] #2 Reads are bounded in cost, cached, and repeated only for what changed.
- [ ] #3 Each read has a test against fixtures, and an evaluation on real projects, recorded with its pass rate.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
