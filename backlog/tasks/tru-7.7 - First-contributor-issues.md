---
id: TRU-7.7
title: First contributor issues
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - docs
milestone: m-1
dependencies:
  - TRU-7.6
type: docs
ordinal: 70070
parent_task_id: TRU-7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A newcomer needs a small task, with enough context to finish it, and nothing that depends on knowing the history.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **A guide.** `CONTRIBUTING.md` covers setup, `make check`, how to write a module (`docs/modules.md`), and how the backlog works.
- [ ] #2 **Five or more issues.** At least five small issues are open on GitHub and labelled, each with what to change, where, and how to prove it.
- [ ] #3 **Zero config stays a rule.** The guide says every feature must work with no config file, and how: read from the profile or ask Claude, and ask the person when Claude can't tell. A reviewer can point at this line.
- [ ] #4 **Works on a fixture.** A contributor can run everything against the repo's fixture app, with no Claude account for most tasks.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
