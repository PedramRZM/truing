---
id: TRU-10.8
title: What the review before the first push left for later
status: To Do
assignee: []
created_date: '2026-11-04 09:01'
labels:
  - claude
  - debt
milestone: m-1
dependencies: []
parent_task_id: TRU-10
type: bug
ordinal: 100080
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A review before the first push proved or read these. None blocks it, and none loses work by itself. Its five blockers are fixed in TRU-5.3 and TRU-10.7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Accept edits writes past the guard.** That mode allows `sed`, `cp`, `mv`, `rm`, `mkdir` and `touch` in the project unasked, and the path guard only sees file tools, so `sed -i` on a test or `cp` into a hook file runs unasked. Those commands ask, or the mode says plainly what it allows. ADR 0006 records today's limit.
- [ ] #2 **Undo gives wrong answers in odd cases.** A symlink a turn created reports `moved` and can never be undone. A tab in a file name truncates the path, so Undo reports `ok` and leaves the file behind. A failed `snapshot` shows "This project isn't in git". A diff over 64 MB throws in `diffOf`, losing the turn's text and its Undo. Each has a test.
- [ ] #3 **A check can run what Claude wrote.** `node run.js`, `sh x.sh` and `make` pass `isSafeCheck`, so they run unasked, and Claude may be able to write those files. A check that runs a file in a writable path asks.
- [ ] #4 **Hidden characters.** A bidi character in a file name survives in `<truing-note>`, `promptSummary` passes prompt text through uncleaned, and U+3000, NBSP, U+061C, NEL and tag characters pass the start command's check. All of them use `isHidden`.
- [ ] #5 **A stopped run leaves its helpers.** Stop kills only `claude`, so a helper it started can keep writing, and a hung run with no Stop has no watchdog.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
