---
id: TRU-7.6
title: Demo GIF and docs site
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - docs
milestone: m-1
dependencies:
  - TRU-6.12
type: docs
ordinal: 70060
parent_task_id: TRU-7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Someone deciding whether to try Truing should see it work in a few seconds, and find the docs without cloning anything.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Demo.** The README opens with a short GIF of a real run: `truing` in a folder, the review screen, picking an element, a change landing in source. It shows no private app.
- [ ] #2 **Docs site.** A small site carries the install line, the guide from TRU-13.3, `docs/modules.md`, and what works per framework (TRU-9.1).
- [ ] #3 **Zero config first.** The first page's first command is the only thing a person needs. Any mention of `truing.config.ts` is marked optional and comes later.
- [ ] #4 **Published from the repo.** The site builds from `docs/` in CI, with no account or token a contributor has to hold.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
