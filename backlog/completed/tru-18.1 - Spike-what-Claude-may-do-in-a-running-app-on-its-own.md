---
id: TRU-18.1
title: 'Spike: what Claude may do in a running app on its own'
status: Done
assignee: []
created_date: '2026-11-03 11:27'
updated_date: '2026-11-07 11:15'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-12.1
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-18
type: spike
ordinal: 180010
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before Claude drives anything, decide the rules. A click in a real app can send an email or delete a row in a shared dev database. Also work out how a run is shaped: one long Claude session, or one per route, and what that costs on a person's plan. Research: `docs/research/claude-subscription-bridge.md`, and the existing `claude` module.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The note says which actions Claude may take unasked (read, navigate, scroll, hover) and which need a person's yes (submit, delete, anything it can't classify), with evidence from at least two real apps
- [ ] #2 A measured cost per route and per size for a review run on a plan's limits, with a recommended default budget
- [x] #3 An ADR with status `proposed` covers the tool surface and the permission rule, for a human to decide
- [x] #4 The tasks in this epic are updated, or removed, from what was found
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ADR 0007 (accepted: the owner chose "look freely, ask before acting" on 2026-11-07). TRU-18.4 built to it. Not done: #1 sorting two real apps' actions with evidence, and #2 the cost of a review run per route and size; both need real Claude runs (pnpm check-claude), which spend the person's usage. The ADR lists them under More information.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ADR 0007: Claude looks freely and asks before it acts, with a turn budget. Left: sorting two real apps' actions and measuring a review run's cost need real Claude runs.
<!-- SECTION:FINAL_SUMMARY:END -->
