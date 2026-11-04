---
id: TRU-8.8
title: 'Setup leaves out UI folders without saying so, and they can''t be edited'
status: To Do
assignee: []
created_date: '2026-11-04 05:38'
labels:
  - zero-config
  - claude
milestone: m-1
dependencies:
  - TRU-6.4
parent_task_id: TRU-8
type: bug
ordinal: 80080
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On a real project with 279 `.tsx` files under `src/features` and 116 under `src/shared`, the read proposed only `src/components/**`, `src/app/**/*.tsx` and the stylesheet. Nothing on the review screen pointed out what was left out, so the person confirmed it, and most of the app's UI would refuse edits. The globs each passed the check against the folder, since that check only asks whether they match something, not what they miss. TRU-8.1 covers giving reasons and asking about folders Claude can't classify. This task is about the folders Claude never mentions, and what the person sees when an edit is refused.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Measured against the folder.** The review screen says how many component files sit outside what's writable and outside what's off limits, and in which folders, without a model call
- [ ] #2 **One step to add.** The person can add a folder it names to the writable list from the review screen, and off-limits still wins
- [ ] #3 **Better first guess.** On a project whose UI lives in feature folders, a real `claude` read proposes them, or names them as unsure
- [ ] #4 **A refused edit explains itself.** WHEN an edit is refused because its file isn't writable THEN the person sees which file and how to allow it, for direct edits and for Claude's
- [ ] #5 **Saved projects too.** A project that was already confirmed can get to the same screen with `truing --reconfigure`
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
