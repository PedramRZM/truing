---
id: TRU-18.4
title: Claude moves through the app in a frame
status: To Do
assignee: []
created_date: '2026-11-03 11:27'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-18.1
type: feature
ordinal: 180040
parent_task_id: TRU-18
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let Claude interact with the running app: navigate, click, type, scroll and hover, under the rules the spike set. Everything it does is visible in the frame and listed in the chat, and the person can stop it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tools navigate, click, type, scroll and hover in a chosen frame, addressing elements by role and name
- [ ] #2 An action outside the spike's allowed list asks the person first, in every permission mode
- [ ] #3 Each action shows in the frame and in a list the person can read afterwards
- [ ] #4 A Stop control ends the run at once, and the app is left as it is
- [ ] #5 A run ends when it reaches its budget, and says so
- [ ] #6 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
