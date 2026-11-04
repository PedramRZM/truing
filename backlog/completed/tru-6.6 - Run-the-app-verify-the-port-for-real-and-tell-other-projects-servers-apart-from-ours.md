---
id: TRU-6.6
title: >-
  Run the app, verify the port for real, and tell other projects' servers apart
  from ours
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
  - onboarding
milestone: m-0
dependencies:
  - TRU-6.5
parent_task_id: TRU-6
type: feature
ordinal: 60060
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A port in a README is a hint. Frameworks move to another port when theirs is taken, and the port may already belong to another project. Truing starts the confirmed command, watches what really happens, and uses the port that really serves this project.

Code: `src/app-process.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Verified for real.** The app counts as running only when an HTTP request to it answers, and the process that holds the port belongs to the command Truing started.
- [x] #2 **Adopts the real port.** If the app takes a different port than expected, Truing uses it, updates the profile and says so.
- [x] #3 **Tells servers apart.** A server already on the port is checked. One from this project is reused. One from another project is left alone, and the person is told what holds the port.
- [x] #4 **Fails usefully.** A command that exits or never answers shows its log, with a way to edit the command and try again.
- [x] #5 **No port set anywhere.** No port is hard-coded or required in a file, and Next's "another dev server is running" case is handled by reusing that server. Tests use a fixture server for each case.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1 NOT MET: a TCP connect only (src/app-process.ts:35-55), no owner check. #2 `moved` is ignored by the UI (app.tsx:949) and false on conflict (app-process.ts:259). #3 `unknown` attaches like ours (:190). #4 never-answers is untested, and a saved profile can't be edited on failure (cli.ts:147). #5 NOT MET: port is required, and an exit beats a followed port (app-process.ts:268).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Running means HTTP answered and the port is really this command's. Adopts and says where it moved, keeps it, tells apart a sibling app in a monorepo, reuses Next's already-running server, and shows the log with a way to edit, including for a saved project. Also fixed: stopping twice hung, and a command killed by a signal looked alive until the timeout. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
