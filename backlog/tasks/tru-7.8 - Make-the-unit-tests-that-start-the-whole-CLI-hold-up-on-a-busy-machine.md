---
id: TRU-7.8
title: Make the unit tests that start the whole CLI hold up on a busy machine
status: To Do
assignee: []
created_date: '2026-11-04 05:31'
updated_date: '2026-11-04 05:43'
labels:
  - testing
milestone: m-1
dependencies: []
parent_task_id: TRU-7
type: bug
ordinal: 70080
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`test/unit/first-run-security.test.ts` runs the real CLI in a subprocess, under Vitest's 5-second limit. Alone, on a machine compiling a large app, 'truing setup stops at an unconfirmed config file' took 2.3s, 2.8s and 4.3s, and in a full `make check` during that load it timed out once. It passed every earlier full run with the machine idle. A contributor or a CI runner under load would see the same. Find what makes starting the CLI take seconds (it imports everything, including Playwright, for commands that need none of it, and goes through tsx), and fix that. Raising the timeout isn't the fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `truing setup`, `truing tokens` and `truing doctor` load only what they use, with the startup time measured before and after
- [ ] #2 `make check` passes while a large app compiles on the same machine
- [ ] #3 No test's timeout was raised
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
Seen again on 2026-11-04 with no app running, only Chrome opening: two tests timed out at 5.4s and 6.0s in `make check`, which blocked a Markdown-only commit. Alone, `truing setup` starts in about 1.4s, so the cost comes from running in parallel on a machine in ordinary use. That's 2 of the 3 gates run that day.
<!-- SECTION:NOTES:END -->
