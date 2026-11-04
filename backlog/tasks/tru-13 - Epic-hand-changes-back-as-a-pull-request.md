---
id: TRU-13
title: 'Epic: hand changes back as a pull request'
status: To Do
assignee: []
created_date: '2026-11-03 11:21'
labels:
  - epic
  - infra
milestone: m-2
dependencies: []
type: epic
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The product's promise ends at a pull request. Until a designer can open a branch and send changes back, the code-first workflow is unproven, and only a pilot on an unseen project can prove it.

## Outcome

A person opens a branch of any project with one command, sends their changes to the developer as a PR following the project's conventions, and a pilot measures the whole loop.

## Scope and non-goals

- In: opening a branch, the hand-back PR, the pilot and its metrics.
- Out: merging, or anything past opening the PR.

## Constraints

Zero config: what this needs from a project comes from the saved profile or from Claude reading it, and Truing asks the person when Claude can't tell. The Claude auth rule and `docs/design-language.md` hold.

## Risks and open questions

The workflow spec is a draft. The pilot ratifies it as an ADR or changes it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WHEN a person names a branch THEN Truing opens it with one command
- [ ] #2 WHEN a person hands back THEN a PR into the feature branch follows the project's own naming and template
- [ ] #3 WHEN someone who has never used Truing refines a feature on an unseen project THEN a developer merges the PR and the product spec's metrics are recorded
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
