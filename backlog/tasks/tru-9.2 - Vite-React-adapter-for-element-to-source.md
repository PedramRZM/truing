---
id: TRU-9.2
title: Vite + React adapter for element-to-source
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - adapters
milestone: m-1
dependencies:
  - TRU-6.4
type: feature
ordinal: 90020
parent_task_id: TRU-9
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vite + React is the most common React setup after Next. React 19's owner stacks work the same, while source maps and dev endpoints differ.

Research: `src/adapters/`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Picked by itself.** The adapter is chosen from the framework in the profile, with nothing to set. Claude's read reports Vite, and that value is checked against the project's dependencies.
- [ ] #2 **Nothing added.** It works with no plugin added to `vite.config`, and nothing else added to the project.
- [ ] #3 **Selection.** Clicking an element gives its component, call site and definition, with an accuracy measured like TRU-1.1's, recorded here.
- [ ] #4 **Instances and edits.** Instances, direct edits, and Claude turns work on a Vite fixture app.
- [ ] #5 **React 18.** On a React 18 project, Truing says what is limited rather than showing wrong locations.
- [ ] #6 **Tests.** A Vite fixture app runs in the e2e suite.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
