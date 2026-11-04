---
id: TRU-8.7
title: Read several apps in a monorepo
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - zero-config
  - claude
milestone: m-3
dependencies:
  - TRU-6.4
  - TRU-6.7
type: feature
ordinal: 80070
parent_task_id: TRU-8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A monorepo can hold several apps, each with its own command, port and tokens. Truing should see that and let the person pick, instead of assuming the root is the app.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Finds the apps.** Claude lists each app in the repository with its folder, framework, command and port, with its evidence.
- [ ] #2 **The person picks.** With more than one app, the UI lists them and asks. The choice is remembered, and starting inside one app's folder picks that app.
- [ ] #3 **One profile each.** Each app keeps its own profile. Shared packages are read as sources for that app.
- [ ] #4 **No workspace config.** It works with pnpm, npm, yarn, Bun and Turborepo layouts, read not configured, and a project can be run with no file added to it.
- [ ] #5 **Tests.** Fixtures cover a two-app repository in at least two layouts.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
