---
id: TRU-9.1
title: Say honestly in the UI what works per framework
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - adapters
  - onboarding
milestone: m-1
dependencies:
  - TRU-6.4
type: feature
ordinal: 90010
parent_task_id: TRU-9
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A tool that opens on any project will open on projects where half of it can't work. People should know that at once, rather than find it by clicking.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **On the review screen.** After the read, the screen lists what works on this project's framework (inspect, source locations, direct edits, Claude) and what doesn't. The list comes from one table in the code.
- [ ] #2 **Never silently absent.** A feature that can't work here says why where it would be, instead of being missing or showing wrong data.
- [ ] #3 **Claude still helps.** On an unsupported framework, Truing still opens the app and Claude still works, and it says so.
- [ ] #4 **No setup.** It comes from the framework the read found, with no setting. A wrong framework can be corrected on the review screen.
- [ ] #5 **Docs match.** The docs site's table (TRU-7.6) is generated from the same table.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
