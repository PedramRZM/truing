---
id: TRU-7.8
title: Make the unit tests that start the whole CLI hold up on a busy machine
status: Done
assignee: []
created_date: '2026-11-04 05:31'
updated_date: '2026-11-04 06:12'
labels:
  - testing
milestone: m-1
dependencies: []
parent_task_id: TRU-7
type: bug
ordinal: 70080
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`test/unit/first-run-security.test.ts` runs the real CLI in a subprocess, under Vitest's 5-second limit. Alone, on a machine compiling a large app, 'truing setup stops at an unconfirmed config file' took 2.3s, 2.8s and 4.3s, and in a full `make check` during that load it timed out once. It passed every earlier full run with the machine idle. A contributor or a CI runner under load would see the same. Find what makes starting the CLI take seconds (it imports everything, including Playwright, for commands that need none of it, and goes through tsx), and fix that. Raising the timeout isn't the fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `truing setup`, `truing tokens` and `truing doctor` load only what they use, with the startup time measured before and after
- [x] #2 No test's timeout was raised
- [x] #3 `make check` passes with every core kept busy, standing in for a large app compiling
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `make check` passes and its output is quoted in the final summary
- [x] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [x] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [x] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Measure what each import costs, and reproduce the timeouts with every core busy.
2. A test that walks the imports, watched failing first. It times nothing, so it can't be flaky itself.
3. Each command imports what it uses when it runs. The browser helpers move out of window.ts so doctor doesn't load the setup server.
4. Re-run under the same load, and deal with whatever else is near the limit, without raising any time limit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Seen again on 2026-11-04 with no app running, only Chrome opening: two tests timed out at 5.4s and 6.0s in `make check`, which blocked a Markdown-only commit. Alone, `truing setup` starts in about 1.4s, so the cost comes from running in parallel on a machine in ordinary use. That's 2 of the 3 gates run that day.

Under load the CLI fix exposed one more test near the limit: the token sweep in `test/unit/tokens.test.ts`, 5.3s to 5.8s beside the other files and 1.7s to 2.2s alone. It compiles every utility against every token, so it now runs in its own Vitest group after the rest; the test itself is unchanged. Closest left: two `first-run` tests that wait out a real 3s deadline, 3.8s under load, which passed every run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Each CLI command now imports what it uses when it runs, and the browser helpers moved to `src/setup/browser.ts`. The token sweep runs in its own Vitest group. No test's time limit or assertion changed; `first-run.test.ts` only imports `browserIsComplete` from its new home.

Startup, median of 5: `--help` 1510ms to 280ms, `setup` 1631ms to 278ms, `tokens` 1649ms to 280ms; tsx alone is 92ms. `doctor` takes 4371ms, of which its real Claude check is 3.7s.

With 8 busy processes on 8 cores: before, 4 tests failed on 2 of 2 runs. After, 882 of 882 on 5 of 5 runs, and `make check` exits 0 with 882 passed. Idle: `make check` exits 0 with 882 passed; `pnpm test:e2e` 192 passed. `test/unit/cli-startup.test.ts` failed before the fix and passes now. A throwaway test that starts `claude` still fails the run through the split groups.

Not verified: load came from busy processes rather than a real app compiling, and nothing has run in CI. E2E doesn't go through the CLI. `truing` opening was run with no display, which got through its imports, the browser check and the setup server, and stopped at launching the window, so no window has opened through the CLI since this change.
<!-- SECTION:FINAL_SUMMARY:END -->
