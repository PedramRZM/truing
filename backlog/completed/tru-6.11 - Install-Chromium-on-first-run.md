---
id: TRU-6.11
title: Install Chromium on first run
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
  - onboarding
  - infra
milestone: m-0
dependencies: []
parent_task_id: TRU-6
type: feature
ordinal: 60110
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Truing opens the app in its own Chromium window. Someone who just ran `truing` shouldn't need a separate install step, or to know what Playwright is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **On first run.** If Truing's Chromium is missing, it installs it, with progress in plain words.
- [x] #2 **Only once.** A later run finds it and starts straight away.
- [x] #3 **Fails usefully.** A failed download says what failed and how to retry, and doesn't leave a half-installed browser that the next run trusts.
- [x] #4 **No config.** It needs no settings or environment variables, and uses the normal Playwright cache location.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1 src/setup/window.ts:20-38 is untested. #3 existsSync ignores Playwright's INSTALLATION_COMPLETE marker, so a half-finished download looks complete.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Checks Playwright's completion marker, so a half-finished download isn't trusted. Proven with a real install into an empty folder: not ready before, ready after. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
