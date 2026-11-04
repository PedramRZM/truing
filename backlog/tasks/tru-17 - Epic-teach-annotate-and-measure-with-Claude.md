---
id: TRU-17
title: 'Epic: teach, annotate and measure with Claude'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - claude
milestone: m-3
dependencies: []
type: epic
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

A chat box is a narrow way to work. Designers point and draw, teams have rules to pass on, and performance needs before-and-after numbers rather than opinion.

## Outcome

A person draws and numbers notes for Claude, teaches it design rules by conversation, sees how the page performs, and hands a finding to Claude to fix and measure.

## Scope and non-goals

- In: annotations, teaching rules, the performance module, handing it findings.
- Out: hosted analytics; anything measured outside the person's machine.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person annotates the page THEN numbered notes and markup reach Claude as one request
- [ ] #2 WHEN a person teaches Claude a rule THEN it's written to the project's own rules and applies to later work
- [ ] #3 WHEN a person opens the performance module THEN they see Web Vitals, long tasks and React renders for the frame
- [ ] #4 WHEN a finding goes to Claude THEN it measures before and after its fix
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
