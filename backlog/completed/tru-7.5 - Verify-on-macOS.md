---
id: TRU-7.5
title: Verify on macOS
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-07 07:09'
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

CI on macOS dropped on 2026-11-04: the owner removed CI. The hand run on a clean macOS account is what remains, including `make check` there.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed by the owner on 2026-11-07 without a run on a Mac. Keys (#2) and no macOS setup (#3) were checked from the code and `test/unit/commands.test.ts`, not on a Mac. #1, the hand run on a clean macOS account, was not done and stays unchecked, so macOS is still unverified.
<!-- SECTION:FINAL_SUMMARY:END -->
