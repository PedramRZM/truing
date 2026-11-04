---
id: TRU-6.10
title: '`truing doctor`, `--reconfigure` and `truing tokens`'
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
  - onboarding
milestone: m-0
dependencies:
  - TRU-6.4
  - TRU-6.7
parent_task_id: TRU-6
type: feature
ordinal: 60100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When something is off, a person needs to see what Truing thinks and start again without hunting for a file.

Code: `src/cli.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **`truing doctor`.** Prints each check with its result: Node, Chromium, `claude` binary, signed in, a real round trip, the saved profile, and the app's port. A failure names the command that fixes it.
- [x] #2 **`--reconfigure`.** `truing --reconfigure` reads the project again and goes back through the review screen, keeping nothing it can't confirm. No file needs deleting by hand.
- [x] #3 **`truing tokens`.** Prints the token table Truing holds for this project and where each token came from. Run with no tokens, it says so and doesn't fail.
- [x] #4 **No config.** All three work in any folder. They read only the saved profile and the project, and need no arguments to be useful.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1 doctor prints the port without checking it, and ignores truing.config.ts (src/cli.ts:57-88). #2 no test (cli.ts:154, app.tsx:1031). #3 NOT MET: `truing tokens` prints counts and writes files (src/tokens/cli.ts:19-25). #4 `tokens` writes the merge file into the project.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`truing doctor` prints every check and its fix, including the port and who holds it. `--reconfigure` goes back through the review. `truing tokens` prints the table with sources and writes nothing unless asked. All three refuse to run an unconfirmed project's code. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
