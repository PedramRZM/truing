---
id: TRU-19.2
title: 'Export or commit a shared team profile (optional, never required)'
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - zero-config
milestone: m-3
dependencies:
  - TRU-6.7
  - TRU-10.3
type: feature
ordinal: 190020
parent_task_id: TRU-19
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On a team, one person's corrections to the profile would help everyone. That must stay optional: a project with no shared profile works exactly the same, and nothing asks anyone to commit anything.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Export.** The settings screen can write the profile's non-personal values to a file the person chooses to commit. Absolute paths and anything personal stay out, and a test proves it.
- [ ] #2 **Picked up by itself.** When the file exists in a repository, the next read starts from it, and the review screen says where each value came from. A person still confirms the start command, because a committed file is as untrusted as any other.
- [ ] #3 **Never required.** With no such file, nothing changes and nothing mentions it. The setup never suggests committing one unless the person opens that screen.
- [ ] #4 **Not a config format.** A hand-written file isn't needed. The file is what Truing writes, and `truing.config.ts` stays a separate, optional override.
- [ ] #5 **Tests.** Fixtures cover with and without the file, and a file that disagrees with the project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
