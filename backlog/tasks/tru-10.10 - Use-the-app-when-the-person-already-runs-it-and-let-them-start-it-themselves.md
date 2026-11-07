---
id: TRU-10.10
title: 'Use the app when the person already runs it, and let them start it themselves'
status: In Progress
assignee: []
created_date: '2026-11-07 07:21'
updated_date: '2026-11-07 08:27'
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
- [x] #1 Before running the start command, setup and every later start look for a server this project already runs on any port (a listening process whose working folder is the project, or the app folder in a monorepo) that answers with a page, and use it without running anything
- [ ] #2 The start screen says the app was already running and on which port; Truing never stops a server it did not start
- [x] #3 A port found this way is kept for next time, as a moved port is today
- [x] #4 When more than one of the project servers could be the app, Truing does not guess: it says which ones it found and starts nothing on its own
- [x] #5 When the start command fails, the screen offers starting the app yourself; Truing then waits for the project server to answer and opens it, with no command run
- [x] #6 Unit tests cover finding the running server on another port, a server of another project on the same machine, and the failed-start path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `runningServers(root, appDir)` in app-process.ts: every TCP listener (lsof and ss merged), whose process works in the project or app folder, not Truing itself, serving a page (HTML or a redirect).
2. `ensureApp` uses the one it finds before running the command; with several, it starts nothing and names them.
3. `waitForApp`: runs nothing, polls until the project server answers; abortable.
4. Setup start routes take `self` to wait instead of run; the start screen offers "Start it yourself" after a failure and "Run the start command" while waiting.
5. Tests with real spawned servers in temp folders; a real Next app on another port; the setup page driven by a scratch script.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision after review: a server is used without asking only when the start command started it (its process or a parent runs those words; `pnpm run dev` = `pnpm dev`) and it serves a page (2xx HTML or a redirect, never a server sending Truing's own `x-truing` header). Without that, Storybook, Prisma Studio, an API's HTML 404 or another Truing would be taken for the app and their port saved. When the person chooses "Start it myself", any server of the project serving a page counts, the port on record first (a container's unnamed listener on it too). In a monorepo the scan counts only the app's own folder. lsof and ss are merged: on this Linux machine lsof left out the Next dev server ss listed (learning recorded).
Evidence: test/unit/running-app.test.ts (12 tests, real spawned servers; the first five behaviours failed before the change; each filter mutation-checked against its test). Real app (Next 16, saved command `pnpm dev`, port 3000 on record): `pnpm dev -p 3005` run by hand -> used in 4 s, nothing started; waitForApp then starting the app by hand -> found. Setup page driven by a scratch script (review -> Start -> failed -> Start it myself -> waiting -> found on another port), screenshots at 1280/1440 light and dark, buttons 36 px, no overflow, no console errors. make check: exit 0, 1204 tests.
Left: AC 2 holds on the setup start screen; a later start (`truing` with a saved project) has no start screen, so "already running" goes to the console only. The "Couldn't open {name}" title for several servers is not seen on screen.
<!-- SECTION:NOTES:END -->
