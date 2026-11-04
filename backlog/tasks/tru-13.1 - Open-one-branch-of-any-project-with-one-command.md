---
id: TRU-13.1
title: Open one branch of any project with one command
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - zero-config
  - onboarding
milestone: m-2
dependencies:
  - TRU-6.4
  - TRU-6.6
type: feature
ordinal: 130010
parent_task_id: TRU-13
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
To refine a feature someone else built, you first have to get that branch running: fetch it, install what changed, set up its environment, start it. That is fine for a developer and impossible for someone who doesn't use git. One command should do all of it, in any project, and say what it is doing in plain words.

The hand-back branch this creates is the one TRU-13.2 sends back.

Research: `docs/research/claude-subscription-bridge.md` (workspace trust and first runs).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **One command.** `truing <branch>` checks the prerequisites (git, `claude` signed in, `gh` only if the project uses GitHub), fetches the branch, creates or updates a hand-back branch from it, installs dependencies and starts the app. Each step prints in plain words. A missing prerequisite stops with the exact fix to run.
- [ ] #2 **No config.** It needs no config file, script or path set up by anyone. The package manager, install command and dev command come from the saved profile. If there is no profile yet, the setup runs first and the branch opens after it.
- [ ] #3 **The branch name comes from the project.** Claude reads the branch's history and any contributing docs and proposes a name for the hand-back branch, with its evidence. If it can't tell, the person is asked once and the answer is saved in the profile.
- [ ] #4 **Environment.** Claude lists which environment variables the branch needs, by name only, from example files and code. It never reads `.env` files or values. If something is missing, the UI says which name is missing and asks the person what to do, and the app isn't started with a guess.
- [ ] #5 **No secrets written.** Nothing is written to a tracked file or printed in the terminal. Proof: `git status` after a run, and a search of the run's output.
- [ ] #6 **Branch moved.** Running it again on a branch that has moved brings the new commits into the hand-back branch. A conflict stops and says so, and nothing is force-pushed.
- [ ] #7 **Timed.** Timed once from a clean user account on Linux and once on macOS, with the time recorded here.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
