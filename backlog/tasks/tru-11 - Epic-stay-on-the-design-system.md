---
id: TRU-11
title: 'Epic: stay on the design system'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - tokens
milestone: m-2
dependencies: []
type: epic
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

A team's tokens only hold if people can see them, see what's off them, and add one when none fits. Today Truing can offer tokens, but can't flag drift or grow the system.

## Outcome

A person sees every token, sees what's off-token on the page and in source, samples a colour and gets a token back, and creates a token where the project defines them.

## Scope and non-goals

- In: the Tokens module, flagging, selection colours, the eyedropper, creating tokens, the source lint with a baseline.
- Out: changing a project's token format; two-way Figma sync.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person opens the Tokens module THEN they see every token in the project
- [ ] #2 WHEN a value on the page isn't on a token THEN it's flagged, with the nearest tokens offered
- [ ] #3 WHEN no token fits THEN a person can create one, written where the project defines them, and apply it in one step
- [ ] #4 WHEN the lint runs in a project THEN it reports only what's new against a recorded baseline
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
