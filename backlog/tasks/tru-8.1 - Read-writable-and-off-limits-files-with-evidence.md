---
id: TRU-8.1
title: Read writable and off-limits files with evidence
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
ordinal: 80010
parent_task_id: TRU-8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Truing and Claude should only touch UI files. Which files those are differs in every project. Today's read gives a first guess. It needs to give its reasons, and be strict about what must never be written.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Both lists.** Claude returns the folders that are safe to write (UI) and those that are off limits (server code, data, config, migrations, generated files), with its evidence for each.
- [ ] #2 **Checked.** Every glob is tested against the folder, and an empty glob is dropped. A file both lists claim is off limits.
- [ ] #3 **Off-limits wins.** Truing's guard and Claude's permissions both enforce the result, and a test proves a write to an off-limits file is refused.
- [ ] #4 **Unsure means ask.** A folder Claude can't classify goes to the person on the review screen, with its contents summarised. Nothing is configured by hand unless the person wants to change a value.
- [ ] #5 **Evaluated.** On at least five real projects, record how many files were classified right, with no server file called writable.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
