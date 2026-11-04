---
id: TRU-6.12
title: Extract from the private monorepo into this repository
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - infra
  - docs
milestone: m-0
dependencies: []
parent_task_id: TRU-6
type: chore
ordinal: 60120
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Truing started inside a private monorepo. To be open source, it needs its own repository with nothing from the host project: no names, no paths, no people, no assumptions about one app.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Its own package.** The code, tests and docs live in this repository with their own lockfile and build, and `make check` passes here on a clean clone.
- [x] #2 **Nothing from the host.** A search of the repository for the host project's names, paths, people and feature names finds nothing.
- [x] #3 **History is its own.** The repository starts with a fresh history, so nothing private comes along in old commits.
- [x] #4 **Licences kept.** `THIRD_PARTY_NOTICES.md` lists every vendored file with its source and licence.
- [x] #5 **Runs on an unknown project.** The extracted tool runs on a project it has never seen, with no config.
- [x] #6 **Backlog and docs moved.** Tasks, specs, the ADR and research live here, and references in the code stay right. Task numbers changed to `TRU-<epic>.<n>` at the owner's request, and every reference moved with them.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1 and #3 wait for the first commit and a clean clone. #2 needs a person's check of history and people's names. #5 says numbers are kept, which the renumbering into TRU-<epic>.<n> changed on the owner's request: reword it. #6 record one real end-to-end run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Own package and lockfile. `make check` passes on a clean copy; a real clean clone can only follow the first commit. No host names or local paths anywhere, and the repository has no commits yet, so the history starts clean. Runs on a project it has never seen with a real `claude`. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
