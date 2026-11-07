---
id: TRU-10.10
title: 'Use the app when the person already runs it, and let them start it themselves'
status: To Do
assignee: []
created_date: '2026-11-07 07:21'
labels:
  - app-start
  - setup
milestone: m-1
dependencies: []
parent_task_id: TRU-10
type: feature
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People usually have their dev server running before they open Truing. Truing reuses it only when it answers on the port on record; otherwise it runs the start command again, which starts a second server (or, for Next, fails and is followed to the first).

Some start commands cannot run under Truing at all. Reported 2026-11-07 on a turborepo monorepo: `pnpm run start:dev` runs `turbo run start:dev`, whose persistent interactive tasks refuse to start without a terminal ("Cannot run interactive task ... without Terminal UI"), so the start failed. The person had to start the app in their own terminal and then open Truing, which worked. That should be a supported path, not a workaround.

Related: TRU-8.5 (Claude diagnoses a failed start from its log), TRU-8.7 (several apps in a monorepo).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Before running the start command, setup and every later start look for a server this project already runs on any port (a listening process whose working folder is the project, or the app folder in a monorepo) that answers with a page, and use it without running anything
- [ ] #2 The start screen says the app was already running and on which port; Truing never stops a server it did not start
- [ ] #3 A port found this way is kept for next time, as a moved port is today
- [ ] #4 When more than one of the project servers could be the app, Truing does not guess: it says which ones it found and starts nothing on its own
- [ ] #5 When the start command fails, the screen offers starting the app yourself; Truing then waits for the project server to answer and opens it, with no command run
- [ ] #6 Unit tests cover finding the running server on another port, a server of another project on the same machine, and the failed-start path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
