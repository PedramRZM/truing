---
id: TRU-6.8
title: A free port for Truing's own server
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
milestone: m-0
dependencies: []
parent_task_id: TRU-6
type: feature
ordinal: 60080
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Truing's own server must never fight with the app or with another copy of Truing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **No port set anywhere.** No port is hard-coded, and no setting is needed for it.
- [x] #2 **Two at once.** Two copies of Truing, on two projects, run side by side. A test proves it.
- [x] #3 **Loopback only.** The server listens only on the machine, and keeps its origin check and session token.
- [x] #4 **Finds its own.** Truing's server gets a free port on loopback from the system, and keeps using it while it stays free, because panels and zoom are remembered per origin.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1, #2, #3 NOT MET: scans from fixed ports (src/truing.ts:118, src/setup/server.ts:148), with defaults in src/config.ts:97 (4100) and src/setup/server.ts:57 (4090), and no test of two copies. Setup's Host check is untested.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Port from the system, kept while free so panels and zoom survive. `test/e2e/two-copies.spec.ts` runs two copies at once. Setup's Host check now has a test. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
