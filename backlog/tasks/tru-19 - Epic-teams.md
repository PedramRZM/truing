---
id: TRU-19
title: 'Epic: teams'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - zero-config
milestone: m-3
dependencies: []
type: epic
ordinal: 190000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Some teams need another sign-in route, shared settings and a Figma file that follows the code. None of these may become a requirement for anyone else.

## Outcome

Teams can use API-key or cloud-provider sign-in through Claude Code, optionally share a profile, and keep a Figma file following the code one way.

## Scope and non-goals

- In: sign-in through Claude Code's own auth, an optional shared profile, a one-way token export.
- Out: a Truing account, a server of Truing's own, two-way Figma sync.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person's Claude Code uses an API key or cloud provider THEN Truing works with it, holding no credential itself
- [ ] #2 WHEN a team shares a profile THEN it's optional, and nobody else has to write one
- [ ] #3 WHEN tokens change THEN a Figma file can follow without API writes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
