---
id: TRU-10.3
title: Project settings screen that shows and edits the profile
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 07:35'
labels:
  - zero-config
  - panels
milestone: m-1
dependencies:
  - TRU-6.7
  - TRU-6.5
parent_task_id: TRU-10
type: feature
ordinal: 100030
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The profile is what Truing believes about a project. People should be able to see it and correct it inside Truing, without finding a JSON file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Edits it.** Any value can be corrected in place and saved. A corrected value is marked as the person's, and a later re-read doesn't overwrite it without asking.
- [x] #2 **Read again.** Each value has a "Read again" that asks Claude about that value only.
- [x] #3 **Still optional.** Everything shown has a working value without a visit to this screen. It is never a required step, and it never asks anyone to write a config file.
- [x] #4 **A changed command is confirmed.** A new start command needs the same confirmation as the review screen before it runs.
- [x] #5 **Tests.** Unit tests: edit a value, read it back from the saved file, and it is kept. E2E was left out at the owner's request.
- [x] #6 **Shows it.** A settings screen shows every profile value with Claude's evidence, and when the settings were last saved.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `make check` passes and its output is quoted in the final summary
- [x] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [x] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [x] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A built-in `settings` module adds a Settings tab: every value with Claude's reason, editable, with Read again on each. Save marks a changed value as the person's, and a later read keeps it, with what Claude read offered on the review screen. A new start command takes its own Save click, and the server refuses it otherwise. What can't change while running says to reopen Truing. A project with a `truing.config.ts` is sent back to that file. `make check` passes: 993 unit tests, docs check ok. `test/unit/project-settings.test.ts`. Read again ran for real on a throwaway project and returned `npm run start` with its reason. E2E was neither run nor added, at the owner's request, so nothing has clicked through these screens in the suite. A one-off headless look covered both screens in light and dark with no page errors and no overflow. No window has opened through the CLI since this change.
<!-- SECTION:FINAL_SUMMARY:END -->
