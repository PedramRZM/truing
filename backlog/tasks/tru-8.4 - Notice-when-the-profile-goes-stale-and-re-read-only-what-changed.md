---
id: TRU-8.4
title: 'Notice when the profile goes stale, and re-read only what changed'
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - zero-config
  - claude
milestone: m-1
dependencies:
  - TRU-6.4
  - TRU-6.7
type: feature
ordinal: 80040
parent_task_id: TRU-8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A profile is a snapshot. The dev command changes, the port moves, the token file is renamed. Truing should notice and fix just that part, with no `--reconfigure` and no re-reading of everything.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Notices.** A start that fails on the saved command, an app on a different port, or a named file that no longer exists marks that value stale. The check needs no settings, and costs no model call when nothing changed.
- [ ] #2 **Re-reads only that part.** Only the stale values go to Claude, with the old value and why it looks wrong. Nothing else in the profile is touched.
- [ ] #3 **A person confirms a new command.** A changed start command goes back through the review screen before it runs. Other values update and say so.
- [ ] #4 **It asks when it can't tell.** If Claude can't tell, the UI asks the person.
- [ ] #5 **Tests.** Fixtures cover a changed dev command, a changed port and a moved token file. Each proves that only that value was re-read.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
