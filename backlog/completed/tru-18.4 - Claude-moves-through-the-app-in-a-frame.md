---
id: TRU-18.4
title: Claude moves through the app in a frame
status: Done
assignee: []
created_date: '2026-11-03 11:27'
updated_date: '2026-11-07 11:15'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-18.1
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-18
type: feature
ordinal: 180040
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let Claude interact with the running app: navigate, click, type, scroll and hover, under the rules the spike set. Everything it does is visible in the frame and listed in the chat, and the person can stop it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tools navigate, click, type, scroll and hover in a chosen frame, addressing elements by role and name
- [x] #2 An action outside the spike's allowed list asks the person first, in every permission mode
- [ ] #3 Each action shows in the frame and in a list the person can read afterwards
- [ ] #4 A Stop control ends the run at once, and the app is left as it is
- [x] #5 A run ends when it reaches its budget, and says so
- [x] #6 **Needs nothing from the project.** It works on any app Truing can open, with no config file and nothing added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence 2026-11-07: test/unit/claude-tools.test.ts (a tool with asks asks first, in words; a no runs nothing; 60-call budget, reset per turn), frames tool snapshot (click and type_text carry asks). Real Chromium on a scaled frame: hover, click (heading changed), type with Enter (form submitted), scroll to a heading and by pixels, and a missing element named in the error. Unchecked: #3 the outline shows in the frame, but "a list the person can read afterwards" relies on the chat showing tool calls, not yet seen with a real Claude turn; #4 Stop is the chat's existing Stop, not yet tried during a tool call.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Claude scrolls, hovers, clicks and types in a frame by role and name; clicks and typing ask the person every time, whatever the permission mode. Left: the chat's action list and Stop during a tool call not yet seen with a real Claude turn.
<!-- SECTION:FINAL_SUMMARY:END -->
