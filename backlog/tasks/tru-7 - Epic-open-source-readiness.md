---
id: TRU-7
title: 'Epic: open-source readiness'
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - epic
  - infra
  - docs
milestone: m-1
dependencies: []
type: epic
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Anyone should be able to install Truing with one line, trust what they got, see what it does before trying it, and find a first thing to contribute.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `npx truing` works on Linux and macOS for someone who has never heard of the repository.
- [ ] #2 Every release is reproducible from CI, with provenance and a changelog.
- [ ] #3 The README and docs show what Truing does before anyone installs it.
- [ ] #4 A newcomer can find a small task and get it merged with no private context.
- [ ] #5 **Zero config throughout.** Nothing in the install or the docs asks a person to write a config file before they see Truing work.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
