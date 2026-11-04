---
id: TRU-7.2
title: Run the e2e suite in CI
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-03 20:32'
labels:
  - infra
milestone: m-1
dependencies:
  - TRU-7.1
parent_task_id: TRU-7
type: chore
ordinal: 70020
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Playwright suite exists, but much of the later work closed without running it. It has to run on every PR before anyone else's changes can be trusted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Runs on every PR.** The e2e suite runs in CI on Linux and passes. Specs that were never run after their task closed are fixed, with no test weakened or skipped.
- [ ] #2 **No secrets needed.** It runs on fixtures only, with a scripted fake Claude, so a fork's PR passes with no secrets, no account and no config.
- [ ] #3 **Failures explain themselves.** A failure uploads its trace and screenshots.
- [ ] #4 **Runtime stated.** The suite's time is recorded here, and stays under a limit named in the task.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
