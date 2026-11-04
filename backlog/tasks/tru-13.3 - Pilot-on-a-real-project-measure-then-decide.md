---
id: TRU-13.3
title: 'Pilot on a real project, measure, then decide'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - docs
  - zero-config
milestone: m-2
dependencies:
  - TRU-5.3
  - TRU-13.1
  - TRU-1.5
  - TRU-2.1
  - TRU-2.2
  - TRU-11.2
  - TRU-4.1
  - TRU-4.2
  - TRU-11.5
  - TRU-4.3
  - TRU-5.2
  - TRU-13.2
type: chore
ordinal: 130030
parent_task_id: TRU-13
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Until someone has used Truing on a project it has never seen, end to end, it's a proposal. This task runs that pilot on a real project, chosen because nobody on the project has used Truing and nothing about it was prepared. It measures the result against the product spec's metrics, and turns the code-first workflow spec into an ADR or changes it.

Two other things come out of the pilot: the user guide, written from what the person actually stumbled on; and the design skill's rules for how Claude behaves in Truing, corrected from what went wrong.

Research: `docs/specs/product.md` (Metrics), `docs/specs/code-first-workflow.md`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **A project Truing hasn't seen.** The pilot runs on a real project that isn't the one Truing was built on, with no config file written and no code changed to help it. Every question the setup asked, and every value that had to be corrected, is recorded here. Each becomes a new task, because a correction means the read fell short.
- [ ] #2 **Pilot run.** One person refines one real feature end to end: setup, inspect, edit, at least one new token, at least one Claude request, then Send. A developer on that project merges the PR.
- [ ] #3 **Measured.** Recorded here: time from nothing installed to the app in Truing; how changes were applied, direct or through Claude (recorded, not targeted); Claude-applied changes kept after the per-viewport check (target at least 80%); off-token count before and after for the touched files; developer review time.
- [ ] #4 **User guide.** `docs/` gains a guide covering setup, the modes, tokens, asking Claude and sending. It's written from the pilot, and the pilot's user has reviewed it.
- [ ] #5 **Decision.** `docs/specs/code-first-workflow.md` becomes an ADR, accepted or revised, recorded in `docs/adr/` and `docs/roadmap.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
