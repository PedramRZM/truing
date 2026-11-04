---
id: TRU-9.4
title: Astro adapter
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - adapters
milestone: m-3
dependencies:
  - TRU-9.2
type: feature
ordinal: 90040
parent_task_id: TRU-9
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Astro mixes `.astro` templates with islands from other frameworks. Much of a page has no React behind it at all.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Picked by itself.** The adapter comes from the framework in the profile, with nothing to set and nothing added to the project.
- [ ] #2 **Selection.** React islands resolve as on Vite. Elements from `.astro` files resolve to source, or the inspector says it doesn't know, and never shows a wrong location.
- [ ] #3 **Edits.** Direct class edits work in `.astro` files where the string is static, and otherwise go to Claude.
- [ ] #4 **Tests.** A fixture app with an island and plain markup runs in the e2e suite.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
