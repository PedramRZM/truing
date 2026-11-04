---
id: TRU-6.7
title: Save the profile outside the repository
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
milestone: m-0
dependencies:
  - TRU-6.4
parent_task_id: TRU-6
type: feature
ordinal: 60070
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Zero config has to mean no file added to the project. What Truing learned goes in the person's own config folder, one JSON file per project, so a repository is never dirtied by trying the tool.

Code: `src/setup/profile.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Outside the project.** The profile lives under the person's config folder (`XDG_CONFIG_HOME` or `~/.config`), named by the folder's short name and a hash of its path, so two folders called `web` stay apart. `git status` in the project stays clean after a full setup.
- [x] #2 **Validated.** A profile that doesn't match the schema, or was written by another version, is treated as missing and read again, never used half-way.
- [x] #3 **An override, not a requirement.** `truing.config.ts` in a project still wins for anyone who wants settings in git, and nothing needs it. A test covers both.
- [x] #4 **No secrets.** A profile holds no environment values or credentials.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1 `git status` is never checked. #3 src/cli.ts:144 has no test. #4 devCommand and evidence are unscrubbed free text.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Outside the project, with `git status` proven clean in e2e. `truing.config.ts` wins once confirmed. Secrets are scrubbed from the command, checks and evidence, and the file is readable only by its owner. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
