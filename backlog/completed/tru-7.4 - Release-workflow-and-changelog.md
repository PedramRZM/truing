---
id: TRU-7.4
title: Release workflow and changelog
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 10:01'
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
- [x] #1 **Changelog.** Each release has an entry, in plain words, saying what changed for a person using Truing.
- [x] #2 **Profiles survive upgrades.** A release that changes the profile format migrates it or reads the project again, with no manual step and no config edit. A test covers an old profile.
- [x] #3 **One step.** A release is one reviewed pull request, then one `npm publish` from a clean clone. Nobody stores a token, and it takes the person's two-factor code.
- [x] #4 **Checks first.** `npm publish` refuses unless `make check` passes and the version has a changelog entry.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `make check` passes and its output is quoted in the final summary
- [x] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [x] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [x] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
How to build it, and the decisions it needs from the owner: docs/research/open-source-repo-setup.md (Recommended release flow), ADR 0004 (proposed), the release skill and docs/maintaining.md. CHANGELOG.md and the release skill exist; the release workflow itself doesn't, because the first-publish option and direct or staged publishing are still open.

`release.yml` is written and reviewed, and `scripts/check-release.mjs` is tested, but no workflow can run until the repository exists on GitHub. So One step and Checks first stay open until a release has actually gone through. The `release` environment has to be created with a required reviewer first: GitHub makes a missing one unprotected.

CI removed on 2026-11-04. `prepublishOnly` runs `make check` and `scripts/check-release.mjs`: `npm run prepublishOnly` passed three times in a row, and the check refuses a version with no entry (`test/unit/release.test.ts`). One step stays open until a real release has gone through it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One real release went through: a commit CI-free but gated, `npm publish` from a clean clone running `make check` (1175 unit tests) and `scripts/check-release.mjs`, the person's two-factor approval, and the `v0.1.0` tag at `9db2962`. `CHANGELOG.md` has the entry. `docs/maintaining.md` has the steps.
<!-- SECTION:FINAL_SUMMARY:END -->
