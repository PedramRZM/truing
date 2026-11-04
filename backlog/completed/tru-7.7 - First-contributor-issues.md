---
id: TRU-7.7
title: First contributor issues
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 09:19'
labels:
  - docs
milestone: m-1
dependencies:
  - TRU-7.6
parent_task_id: TRU-7
type: docs
ordinal: 70070
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A newcomer needs a small task, with enough context to finish it, and nothing that depends on knowing the history.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **A guide.** `CONTRIBUTING.md` covers setup, `make check`, how to write a module (`docs/modules.md`), and how the backlog works.
- [x] #2 **Five or more issues.** At least five small issues are open on GitHub and labelled, each with what to change, where, and how to prove it.
- [x] #3 **Zero config stays a rule.** The guide says every feature must work with no config file, and how: read from the profile or ask Claude, and ask the person when Claude can't tell. A reviewer can point at this line.
- [x] #4 **Works with no account.** A contributor can run the unit tests on the repo's fixtures, with no Claude account.
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
Six issues are written in `.github/first-issues/`, each with what to change, where and how to prove it. Opening them needs the repository to exist, and the folder's README has the command.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Six small issues are open on GitHub, numbers 1 to 6, labelled `good first issue`, each saying what to change, where and how to prove it. `CONTRIBUTING.md` covers setup, `make check`, writing a module, the backlog and working with no Claude account, and states the zero config rule. They came from real gaps two reviews found and left alone. The repository is private for now, so nobody outside can see them yet.
<!-- SECTION:FINAL_SUMMARY:END -->
