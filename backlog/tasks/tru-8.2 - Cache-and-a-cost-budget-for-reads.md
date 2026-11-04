---
id: TRU-8.2
title: Cache and a cost budget for reads
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - zero-config
  - claude
milestone: m-1
dependencies:
  - TRU-6.4
type: feature
ordinal: 80020
parent_task_id: TRU-8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every read uses the person's own Claude plan. Truing has to keep that small, say what it costs, and never read twice for the same answer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Cached.** A read's result is kept in the profile with a hash of the files it used. The same question on unchanged files makes no model call, and a test proves it.
- [ ] #2 **A budget.** Each read has a cap on turns and a timeout. Reaching it stops the read and shows what it found so far, and the person can go on or answer themselves.
- [ ] #3 **Shown.** The UI says when Claude is reading and why, and shows what each read used when Claude reports it.
- [ ] #4 **Sensible defaults, no settings.** The model and limits are chosen by Truing for each kind of read. The person needn't set anything, and limits on their plan are shown in plain words.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
