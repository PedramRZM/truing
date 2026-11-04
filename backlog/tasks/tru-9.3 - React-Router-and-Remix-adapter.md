---
id: TRU-9.3
title: React Router and Remix adapter
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - adapters
milestone: m-3
dependencies:
  - TRU-9.2
type: feature
ordinal: 90030
parent_task_id: TRU-9
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
React Router's framework mode and Remix run on Vite, with server rendering and their own routes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Picked by itself.** The adapter comes from the framework in the profile, with nothing to set and nothing added to the project.
- [ ] #2 **Selection.** Elements rendered on the server and on the client both resolve to source, with accuracy recorded here.
- [ ] #3 **Routes.** The page list (TRU-14.3) comes from the project's routes, found by the framework's own files or Claude's read, without config.
- [ ] #4 **Tests.** A fixture app runs in the e2e suite.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
