---
id: TRU-1
title: 'Epic: open the real app in Truing'
status: Done
assignee: []
created_date: '2026-11-03 11:21'
updated_date: '2026-11-03 11:21'
labels:
  - epic
  - infra
dependencies: []
type: epic
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

A design tool that works on a mockup drifts from the product. To work on the real thing, Truing had to attach to a running app without changing it, know what each element is, and let features plug in.

## Outcome

Truing opens a project's running app in its own Chromium window, framed at real screen widths, with nothing added to the app, and every feature is a module.

## Scope and non-goals

- In: the spikes behind ADR 0001, the token table, the shell package and browser, the module contract.
- Out: the panels and inspector built on top, hosting, a proxy.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

None open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WHEN a person starts Truing on a running app THEN it appears in Truing's own window, framed at phone, tablet and desktop widths, with no proxy
- [x] #2 WHEN an app is built after using Truing THEN the build holds none of Truing's code
- [x] #3 WHEN a feature is added to Truing THEN it plugs in as a module with no change to the core
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed when the backlog was reshaped into epics: every child task was already Done. The acceptance scenarios restate what those tasks delivered and proved; they were not re-verified at that point.
<!-- SECTION:FINAL_SUMMARY:END -->
