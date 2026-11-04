---
id: TRU-6.13
title: Show apps that refuse to be framed
status: Done
assignee: []
created_date: '2026-11-03 11:00'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
milestone: m-0
dependencies: []
parent_task_id: TRU-6
type: feature
ordinal: 60130
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Many apps send X-Frame-Options or a CSP frame-ancestors rule, which left a blank frame stuck on loading. Truing owns its browser, so a small local extension removes those headers from the app's pages inside frames, without a proxy, so streaming still works.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An app sending X-Frame-Options: DENY shows and connects, with nothing changed in the app
- [x] #2 A streamed page that refuses framing still arrives in parts
- [x] #3 The rule covers only this app's origin, inside frames
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
Covered by `test/e2e/real-app.spec.ts` (a page that refuses framing still shows and streams) and the framing rules unit test in `test/unit/setup.test.ts`, passing in the runs above. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
