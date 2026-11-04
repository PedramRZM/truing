---
id: TRU-10.3
title: Project settings screen that shows and edits the profile
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - zero-config
  - panels
milestone: m-1
dependencies:
  - TRU-6.7
  - TRU-6.5
type: feature
ordinal: 100030
parent_task_id: TRU-10
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The profile is what Truing believes about a project. People should be able to see it and correct it inside Truing, without finding a JSON file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Shows it.** A settings screen shows every profile value with Claude's evidence and when it was read.
- [ ] #2 **Edits it.** Any value can be corrected in place and saved. A corrected value is marked as the person's, and a later re-read doesn't overwrite it without asking.
- [ ] #3 **Read again.** Each value has a "Read again" that asks Claude about that value only.
- [ ] #4 **Still optional.** Everything shown has a working value without a visit to this screen. It is never a required step, and it never asks anyone to write a config file.
- [ ] #5 **A changed command is confirmed.** A new start command needs the same confirmation as the review screen before it runs.
- [ ] #6 **Tests.** Playwright: edit a value, restart, and it is kept.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
