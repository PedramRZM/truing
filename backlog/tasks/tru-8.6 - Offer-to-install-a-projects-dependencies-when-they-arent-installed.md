---
id: TRU-8.6
title: Offer to install a project's dependencies when they aren't installed
status: To Do
assignee: []
created_date: '2026-11-03 11:00'
labels:
  - zero-config
milestone: m-1
dependencies: []
type: feature
ordinal: 80060
parent_task_id: TRU-8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A project that hasn't been installed fails at Start with a log, and its token stylesheet can't compile because tailwindcss isn't there. Setup should notice and offer the fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Claude reads which package manager and install command the project uses; nothing is assumed
- [ ] #2 When dependencies are missing, the review screen says so and offers to run the install, which the person confirms like the start command
- [ ] #3 After it finishes, the tokens are checked again and the app starts
- [ ] #4 When Claude can't tell the install command, it asks in the UI
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
