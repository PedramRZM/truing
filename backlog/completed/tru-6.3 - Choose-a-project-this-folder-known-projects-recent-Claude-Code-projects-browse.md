---
id: TRU-6.3
title: >-
  Choose a project: this folder, known projects, recent Claude Code projects,
  browse
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
  - onboarding
milestone: m-0
dependencies:
  - TRU-6.1
parent_task_id: TRU-6
type: feature
ordinal: 60030
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`truing` can be started anywhere. If the folder is a project, that is the obvious choice. If it isn't, Truing helps find one without asking the person to type a path.

Code: `src/setup/find-projects.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **This folder first.** When started in a folder that looks like a project, that is the first choice offered.
- [x] #2 **Known projects.** Projects with a saved profile are listed, most recent first.
- [x] #3 **Recent Claude Code projects.** Recent folders Claude Code has worked in are offered, skipping any that no longer exist. Only the folder paths are read, never the transcripts.
- [x] #4 **Browse.** A folder picker covers everything else. Choosing a folder with no recognisable project says so and still lets the person go on.
- [x] #5 **No config.** It needs no list of projects or settings, and works on a machine with nothing saved. Tests cover each source on its own.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #2 source and order of known projects are untested (src/setup/profile.ts:103). #3 NOT MET: src/setup/find-projects.ts:40-49 reads 64 KB of each newest transcript: change the source, or reword the criterion. #4 no test of the non-project message. #5 known and browse only partly tested.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
This folder, known projects newest first, recent Claude Code projects and browse, each tested alone. Recent folders now come from the folder names under Claude Code's projects, and no transcript is opened. Two races in browse fixed: a slow listing no longer replaces what's typed. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
