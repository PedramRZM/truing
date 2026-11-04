---
id: TRU-9
title: 'Epic: more frameworks and platforms'
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-03 11:23'
labels:
  - epic
  - adapters
milestone: m-1
dependencies: []
type: epic
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Element-to-source is the part of Truing that depends most on a framework. Today it is built on Next, React 19 owner stacks and Turbopack, behind an adapter. Other frameworks need their own, and the UI should say honestly what works.

Research: `docs/research/element-to-source-react19.md`.

Windows sits here too: reaching a new platform and reaching a new framework are the same promise, and the UI says honestly what works on each.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 At least one framework beyond Next runs end to end: inspect, direct edit, Claude turn.
- [ ] #2 The UI and the docs say what works per framework, and no feature fails silently because of one.
- [ ] #3 **Zero config throughout.** The right adapter comes from the framework in the profile. A person never names an adapter or edits a config, and nothing is added to the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
