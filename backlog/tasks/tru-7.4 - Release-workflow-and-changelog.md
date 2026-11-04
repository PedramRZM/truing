---
id: TRU-7.4
title: Release workflow and changelog
status: In Progress
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 09:10'
labels:
  - infra
  - docs
milestone: m-1
dependencies:
  - TRU-7.3
parent_task_id: TRU-7
type: chore
ordinal: 70040
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Releases should be one reviewed step, the same every time, and a person upgrading should be able to read what changed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **One step.** A release is cut from CI by a tagged commit or a release PR, never from a laptop.
- [x] #2 **Changelog.** Each release has an entry, in plain words, saying what changed for a person using Truing.
- [x] #3 **Profiles survive upgrades.** A release that changes the profile format migrates it or reads the project again, with no manual step and no config edit. A test covers an old profile.
- [ ] #4 **Checks first.** `make check` passes before a release can publish.
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
How to build it, and the decisions it needs from the owner: docs/research/open-source-repo-setup.md (Recommended release flow), ADR 0004 (proposed), the release skill and docs/maintaining.md. CHANGELOG.md and the release skill exist; the release workflow itself doesn't, because the first-publish option and direct or staged publishing are still open.

`release.yml` is written and reviewed, and `scripts/check-release.mjs` is tested, but no workflow can run until the repository exists on GitHub. So One step and Checks first stay open until a release has actually gone through. The `release` environment has to be created with a required reviewer first: GitHub makes a missing one unprotected.
<!-- SECTION:NOTES:END -->
