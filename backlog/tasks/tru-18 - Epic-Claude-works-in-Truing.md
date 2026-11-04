---
id: TRU-18
title: 'Epic: Claude works in Truing'
status: To Do
assignee: []
created_date: '2026-11-03 11:27'
labels:
  - epic
  - claude
milestone: m-3
dependencies: []
type: epic
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Today a person has to look for problems and then ask Claude about each one. Many of the problems that matter most are hard to spot by eye: a component that remounts when it shouldn't, a layout that shifts after data loads, a page that got slower. Claude could find these itself if it could work in Truing the way a person does: open frames, move through the app, look at the layers, take screenshots and measure.

This is an idea to prove, not a settled design. The first task is a spike, and it may change the rest.

## Outcome

A person asks Claude to review a feature. Claude sets up frames, walks the app at each size, and reports what it found, each finding with a screenshot, a source location and a way to hand it on for a fix. It can also make several takes of a change and compare them.

## Scope and non-goals

- In: tools for frames, screenshots and driving the app; finding layout shifts, incorrect mounting, odd layouts and performance regressions; a review run with a report; comparing takes.
- Out: running without a person there, testing server code or data, replacing the project's own test suite, anything against a production environment.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold. Every tool is a module's tool under the module contract, and a run is on the person's own Claude plan, so its cost has to be visible and bounded.

## Risks and open questions

- Driving a real app can have real effects: a click can delete data in a shared dev database. The spike decides what Claude may do unasked.
- Tool descriptions are prompts, so they need the same evaluation as any prompt.
- False findings would quickly cost trust. Each detector needs a measured precision on fixtures before it ships.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person asks Claude to review a route THEN Claude opens the frames it needs, moves through the app at each size, and reports its findings
- [ ] #2 WHEN Claude reports a finding THEN it carries a screenshot, a source location and a way to hand it on for a fix
- [ ] #3 WHEN an action could change data THEN Claude asks the person first, and a run stays inside a stated budget
- [ ] #4 WHEN Claude compares takes THEN each take has screenshots at every size and the person chooses which to keep
- [ ] #5 WHEN Truing runs on a project it has never seen THEN all of this works with no config file
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
