---
id: TRU-9.6
title: Windows support
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - infra
milestone: m-3
dependencies:
  - TRU-7.5
type: feature
ordinal: 90060
parent_task_id: TRU-9
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paths, shells, process trees and file locks all behave differently on Windows. Decide what works, fix it, and say honestly what doesn't.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Paths.** Source locations, globs, the path guard and the profile's name work with Windows paths. Unit tests run with Windows-style paths.
- [ ] #2 **Processes.** Starting and stopping the app and `claude` works, including killing a process tree. No app or Claude process is left running after Truing quits.
- [ ] #3 **The command runs in the right shell.** A start command that Claude read from a project runs in the shell it was written for. When Claude can't tell, the review screen asks, and no shell is set in a config.
- [ ] #4 **Tests.** The unit tests and the e2e suite run on Windows in CI, with any known failures listed.
- [ ] #5 **Says what's missing.** `truing doctor` and the docs say plainly what doesn't work on Windows yet.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
