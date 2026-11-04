---
id: TRU-7.5
title: Verify on macOS
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - infra
milestone: m-1
dependencies:
  - TRU-6.11
type: chore
ordinal: 70050
parent_task_id: TRU-7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Truing has been run mostly on Linux. Most of the people who will want it are on Macs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Verified.** Setup, inspect, a direct edit, a Claude turn and the keys are run by hand on a clean macOS account, and what happened is recorded in the final summary.
- [ ] #2 **Tests.** The unit tests and the e2e suite run on macOS in CI.
- [ ] #3 **Keys.** Option and Cmd combinations work, and every shortcut in the `?` sheet shows the Mac key.
- [ ] #4 **No macOS setup.** It needs nothing beyond Node and `claude`. Chromium installs by itself, and paths come from the system, not from a setting.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
