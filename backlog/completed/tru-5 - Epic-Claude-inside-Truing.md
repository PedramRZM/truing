---
id: TRU-5
title: 'Epic: Claude inside Truing'
status: Done
assignee: []
created_date: '2026-11-03 11:21'
updated_date: '2026-11-04 09:10'
labels:
  - epic
  - claude
milestone: m-0
dependencies: []
type: epic
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Panels can't do everything. A person needs to ask Claude from inside Truing, on their own subscription, with the selection attached, and be able to undo what comes back. The reviews of the first version found problems to fix before anyone else relies on it.

## Outcome

A person chats with Claude in Truing, keeps or undoes each answer as one step, and sees everything Claude loads. Review findings are fixed.

## Scope and non-goals

- In: the chat, the project's instructions, UI-only permissions, the review findings.
- Out: Claude's design tools and applying staged changes, which come in v0.3.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

The review findings are unfixed, and should be fixed before anyone else uses Truing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WHEN a person asks Claude something with elements selected THEN the answer knows those elements
- [x] #2 WHEN Claude changes files THEN each answer can be kept or undone as one step
- [x] #3 WHEN Claude tries to write outside the allowed files THEN it's blocked, in every permission mode
- [x] #4 WHEN a person opens Claude's configuration THEN they see everything Claude loads for this project
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `make check` passes and its output is quoted in the final summary
- [x] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [x] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [x] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every child is done. `make check` passes: 1173 unit tests. `pnpm check-first-run` on a real `claude`: 16 of 16. A real `claude` was told which page and elements it was looking at, and each turn can be kept or undone. Writing outside the allowed files is refused for file tools in every mode, proven on a real `claude`. A shell command Claude is allowed to run isn't checked against those limits, and Accept edits allows `sed` and `cp` unasked: ADR 0006 records it, and TRU-10.8 tracks it.
<!-- SECTION:FINAL_SUMMARY:END -->
