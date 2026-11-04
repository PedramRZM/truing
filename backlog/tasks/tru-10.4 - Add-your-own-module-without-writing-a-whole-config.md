---
id: TRU-10.4
title: Add your own module without writing a whole config
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - zero-config
milestone: m-1
dependencies:
  - TRU-1.6
  - TRU-6.7
type: feature
ordinal: 100040
parent_task_id: TRU-10
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A project's own module is the one thing Truing can't work out by reading the project, so it goes in `truing.config.ts`. But that file replaces the saved profile instead of adding to it, so listing one module means restating the name, start command, port and writable files that Claude already read. Plugging in a module should take one line.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a `truing.config.ts` holds only `modules` THEN the rest comes from the saved profile, and Truing starts
- [ ] #2 WHEN the file also sets other fields THEN those fields win over the profile, as they do today
- [ ] #3 WHEN a project has no `truing.config.ts` THEN nothing changes, and no file is asked for
- [ ] #4 README and `docs/modules.md` show the one-line form
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
