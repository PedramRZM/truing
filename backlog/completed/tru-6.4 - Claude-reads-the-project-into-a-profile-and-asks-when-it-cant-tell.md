---
id: TRU-6.4
title: 'Claude reads the project into a profile, and asks when it can''t tell'
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
  - onboarding
  - claude
milestone: m-0
dependencies:
  - TRU-6.1
  - TRU-6.3
parent_task_id: TRU-6
type: feature
ordinal: 60040
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This is the heart of zero config. Truing asks Claude to read the folder with read-only tools and return structured JSON: the name, framework, app folder, dev command and port, start route, source folder, primitives, token location and writable paths, each with its evidence.

Nothing Claude says is trusted as it stands. Every value is tested against the folder, and a person confirms the start command before anything runs.

Code: `src/setup/read-project.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Read-only.** The run allows only read tools, with no project settings or hooks. A test proves a write or a shell command is refused.
- [x] #2 **Secrets denied.** `.env` files and other secret files are denied, and a test proves a read of one fails.
- [x] #3 **Structured.** The answer must match a schema. An answer that doesn't is retried once and then reported, never half-used.
- [x] #4 **Evidence.** Each value carries Claude's reason in its own words, shown on the review screen.
- [x] #5 **Text from the project is data.** Nothing in a README or source file can change what the read does, and a test plants instructions in a fixture to prove it.
- [x] #6 **It asks when it can't tell.** When Claude can't tell, it returns a question with options, and the UI asks. The answer goes into the profile, and the read isn't run again for it. The one exception is which app a monorepo means, since everything else depends on it: that reads again, keeping earlier answers.
- [x] #7 **Checked against the folder.** Every path Claude names must exist, and every value is tested before it is shown. A value that fails the check is treated as unknown. A token stylesheet is compiled only after a person confirms, because compiling runs the project's own Tailwind (ADR 0005).
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1, #2, #7 need a real-Claude probe; `pnpm check-claude` doesn't cover the reader (scripts/check-claude-session.ts:21 needs a truing.config.ts). #2 deny rules (read-project.ts:69) are never asserted. #3 NOT MET: a wrong answer is reported, with no automatic retry. #4 only five evidence fields (read-project.ts:40-52): no framework, route or source. #5 tokens compile only at Start (src/setup/server.ts:258). #6 answering `project` re-reads and drops earlier answers (app.tsx:735,1099).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Read-only, with a new hook (`src/setup/read-guard.mjs`) that keeps reads inside the project, and a wider deny list. A wrong-shape answer is asked for once more. Every value has a reason. Planted instructions, a secret, a write, a shell command and an outside read are all refused in `pnpm check-first-run`. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
