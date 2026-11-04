---
id: TRU-6
title: 'Epic: zero-config setup and onboarding'
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - epic
  - zero-config
  - onboarding
milestone: m-0
dependencies: []
type: epic
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Truing runs in any folder. Nobody writes a config file, sets a port or names a token location. It checks Claude for real, lets you choose a project, asks Claude to read that project into a profile, shows you what it found, and runs nothing until a person has confirmed the start command. When Claude can't tell, it asks in the UI.

`truing.config.ts` stays optional, for anyone who wants settings in git.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a project Truing has never seen, `truing` goes from nothing to the app in Truing's window with no config file written and no file added to the project.
- [x] #2 The only things a person has to do are confirm the start command and answer questions Claude couldn't answer.
- [x] #3 Every child task is done, and each failure along the way says what happened and the next thing to do.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `make check` passes and its output is quoted in the final summary
- [x] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [x] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [x] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every child is done. On a project it has never seen, `truing` reaches the app in its window with no config file and nothing added, and the only things a person does are confirm the start command and answer what Claude couldn't tell. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
