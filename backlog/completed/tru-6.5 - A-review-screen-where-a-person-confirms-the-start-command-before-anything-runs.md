---
id: TRU-6.5
title: A review screen where a person confirms the start command before anything runs
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
parent_task_id: TRU-6
type: feature
ordinal: 60050
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude's read comes from files anyone could have written. Running a command from them without asking would make Truing a way to run someone else's code. So nothing runs until a person has seen the start command and confirmed it.

Code: `src/setup/ui/`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Nothing runs first.** No command from the project runs before the person confirms it. A test proves it.
- [x] #2 **Shows what it found.** The screen shows each value with Claude's evidence: framework, start command, port, tokens, primitives, writable paths.
- [x] #3 **Editable.** A person can correct any value in place, and the correction wins over Claude's.
- [x] #4 **Unknowns are plain.** A value Claude couldn't find says so. Only the start command is required, and everything else can stay empty and be read later.
- [x] #5 **No config.** Confirming saves the profile. No file is written into the project.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1 PARTIAL, and a decision: src/cli.ts:144-146 runs a truing.config.ts and its command unconfirmed. #2 framework has no evidence, and most values collapse. #3 name, framework, appDir and dropEnv aren't editable. #4 NOT MET: port and writable are required (src/setup/draft.ts:45-50, app.tsx:695). #5 the profile saves after the app answers, not on confirm. Security: `checks` become unasked Bash allow rules (src/claude/session.ts:157) and are collapsed on review, and dropEnv isn't shown, so a hostile README can influence both.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Nothing runs before a person confirms, including a `truing.config.ts`, which is shown first and asked for again if it changes (ADR 0005). Every value shows with its reason and can be edited. Only the start command is required. Checks and dropped variables are shown, and a wildcard or chained check is refused. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
