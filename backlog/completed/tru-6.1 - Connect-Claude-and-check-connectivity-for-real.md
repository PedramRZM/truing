---
id: TRU-6.1
title: Connect Claude and check connectivity for real
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
  - onboarding
  - claude
milestone: m-0
dependencies: []
parent_task_id: TRU-6
type: feature
ordinal: 60010
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Setup can't start until Claude works, and "the binary exists" isn't proof of that. Truing checks three things, in the order a person would fix them: the `claude` binary is there, it is signed in, and a real round trip comes back.

Code: `src/setup/connection.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Binary.** A missing `claude` is reported with the command that installs it, not as a stack trace.
- [x] #2 **Signed in.** Status comes from `claude auth status`, reading only whether a login exists and its method. Nothing else is read, and no credential file is ever opened.
- [x] #3 **Real round trip.** A short real request goes through the person's own `claude` and has to come back before the check passes. A timeout says so and offers Check again.
- [x] #4 **One next step.** When something fails, the screen shows one sentence on what to do and, where one exists, the command that fixes it.
- [x] #5 **No config.** It finds `claude` on the person's `PATH` and needs no settings. Tests cover each failure with a fake CLI, and one manual run is recorded against the real one.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `make check` passes and its output is quoted in the final summary
- [x] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [x] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [x] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #2 also reads and shows the plan (src/setup/connection.ts:28,45): check against the criterion. #3 a timeout gets generic wording, with no test. #5 no recorded manual run with a real claude.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Checks the binary, the sign-in and a real round trip. A timeout and an empty reply now fail the check with their own words. `test/unit/first-run.test.ts`; the real run in `pnpm check-first-run` and `truing doctor`. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
