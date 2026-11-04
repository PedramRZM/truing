---
id: TRU-7.5
title: Verify on macOS
status: In Progress
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 09:10'
labels:
  - infra
milestone: m-1
dependencies:
  - TRU-6.11
parent_task_id: TRU-7
type: chore
ordinal: 70050
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Truing has been run mostly on Linux. Most of the people who will want it are on Macs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Verified.** Setup, inspect, a direct edit, a Claude turn and the keys are run by hand on a clean macOS account, and what happened is recorded in the final summary.
- [x] #2 **Keys.** Option and Cmd combinations work, and every shortcut in the `?` sheet shows the Mac key.
- [x] #3 **No macOS setup.** It needs nothing beyond Node and `claude`. Chromium installs by itself, and paths come from the system, not from a setting.
- [ ] #4 **Tests.** The unit tests run on macOS in CI.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Keys: `test/unit/commands.test.ts` covers the Mac labels, and the code handles Option through key codes. No setup: `lsof` stands in where `/proc` and `ss` don't exist, and Chromium installs by itself. Read from the code, not run on a Mac. CI needs the repository to exist, and a run on a clean macOS account needs a person with a Mac.
<!-- SECTION:NOTES:END -->
