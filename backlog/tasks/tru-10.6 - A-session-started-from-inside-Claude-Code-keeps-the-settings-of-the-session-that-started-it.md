---
id: TRU-10.6
title: >-
  A session started from inside Claude Code keeps the settings of the session
  that started it
status: To Do
assignee: []
created_date: '2026-11-04 05:38'
labels:
  - claude
  - onboarding
milestone: m-1
dependencies: []
parent_task_id: TRU-10
type: bug
ordinal: 100060
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude Code adds the `env` block of the person's own settings to everything it starts. Truing started from a Claude Code session inherits those values, and passes them to every design session, because it only drops a fixed list of names. Truing's sessions leave the person's settings out on purpose, so these values arrive with none of the settings they belong to. Seen on a real project: its hooks skip themselves when a variable from personal settings is set, so that variable switched them off, while personal hooks weren't loaded either. Neither set of hooks ran, and the configuration view still listed the project's. Started from a plain terminal, this doesn't happen. The project's dev server inherits the same values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Same as a terminal.** WHEN Truing starts from inside a Claude Code session THEN a design session's environment holds nothing that session's personal settings added, with no variable's name hard-coded in Truing
- [ ] #2 **Project hooks run.** WHEN a project's hook skips itself on a variable from personal settings THEN it still runs in a design session started from inside Claude Code, proven with a real `claude`
- [ ] #3 **The view is honest.** What Claude's configuration view lists as loaded matches what a session started this way really runs
- [ ] #4 **Setup too.** The project read and the connection check get the same clean environment
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
