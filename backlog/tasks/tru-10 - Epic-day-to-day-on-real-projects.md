---
id: TRU-10
title: 'Epic: day to day on real projects'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - onboarding
milestone: m-1
dependencies: []
type: epic
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Once Truing is installed, it has to hold up across real work: heavy signed-in screens, more than one project, a profile that needs correcting, and a project's own modules.

## Outcome

A person moves between projects and corrects what Truing believes about one from inside Truing, and the inspector holds up on the heaviest screens.

## Scope and non-goals

- In: heavy screens, a project switcher, a settings screen, adding a module without writing a whole config.
- Out: a shared team profile, which is in the Teams epic.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person works on two projects THEN they can switch from the shell without quitting
- [ ] #2 WHEN the profile is wrong THEN a person can see and correct it in Truing, without finding a JSON file
- [ ] #3 WHEN a signed-in screen is past React's owner-stack cap THEN visible project elements still resolve, or Truing says why not
- [ ] #4 WHEN a person adds their own module THEN they don't have to restate settings Claude already read
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
