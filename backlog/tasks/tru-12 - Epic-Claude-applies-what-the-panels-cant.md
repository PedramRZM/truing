---
id: TRU-12
title: 'Epic: Claude applies what the panels can''t'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - claude
milestone: m-2
dependencies: []
type: epic
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Most responsive work, classes built at runtime and changes across components need judgement. They should go through the same tray as direct edits, and be checked before they're kept.

## Outcome

Claude has design tools, and takes staged changes the direct engine can't write, with their per-size intent, and the result is checked at every size before the person keeps it.

## Scope and non-goals

- In: Claude's tools over MCP, applying staged changes, checking at every size.
- Out: new screens from nothing.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN Claude works in Truing THEN it can read the selection and tokens, take screenshots and make exact edits through tools
- [ ] #2 WHEN a staged change can't be written exactly THEN it goes to Claude with its intent and screenshots
- [ ] #3 WHEN Claude finishes THEN the result is checked at every size before the person keeps it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
