---
id: TRU-10.2
title: Project switcher in the shell
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - zero-config
  - panels
milestone: m-1
dependencies:
  - TRU-6.3
  - TRU-6.7
type: feature
ordinal: 100020
parent_task_id: TRU-10
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Someone working on two projects shouldn't have to quit Truing and start it elsewhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **In the shell.** A menu in Truing's shell lists known projects, most recent first, with Browse for another.
- [ ] #2 **Switching.** Choosing one stops this project's app if Truing started it, leaves one it didn't start alone, and opens the other from its saved profile. Staged changes prompt first, and are never lost silently.
- [ ] #3 **An unknown project.** A folder with no profile goes through setup, with no config.
- [ ] #4 **Nothing to set up.** The list comes from saved profiles, and ports are found fresh.
- [ ] #5 **Tests.** Playwright: switch between two fixture projects and back, with no stale frame or panel.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
