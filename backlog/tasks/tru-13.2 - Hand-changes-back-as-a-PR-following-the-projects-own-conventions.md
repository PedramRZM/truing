---
id: TRU-13.2
title: 'Hand changes back as a PR, following the project''s own conventions'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - zero-config
milestone: m-2
dependencies:
  - TRU-13.1
  - TRU-4.1
  - TRU-6.4
type: feature
ordinal: 130020
parent_task_id: TRU-13
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Someone who doesn't use git still has to hand their changes back. Truing commits them to a hand-back branch cut from the branch they started from, and opens a PR into that branch. A developer reviews the diff and CI runs before anything lands. Nothing about this may assume how a project names its branches or what its main branch is called.

The PR is where the product spec's rules become visible to the developer: every new token, every off-token value left in place, every change to a shared component's definition, and before-and-after screenshots.

Research: `docs/design-language.md`, TRU-4.1's change log, TRU-11.5's token changes. `gh pr create --base <feature> --head <hand-back>`, and how a PR body can carry images (uploaded attachments or committed files).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Claude reads the conventions.** Before the first send, Claude reads the branch history, recent merged PRs, contributing docs and any PR template, read-only, and returns the branch naming and PR conventions with its evidence. The result is saved in the profile. Nothing is assumed about `main`, `develop` or a prefix.
- [ ] #2 **It asks when it can't tell.** If Claude can't tell which branch to target or what to name the hand-back branch, the UI asks, offers its best guess, and saves the answer. No config file is needed, and `truing.config.ts` is only an optional override.
- [ ] #3 **One commit per Apply.** Every Apply makes one commit on the hand-back branch. Its message says what changed in plain words, in the project's commit style if Claude found one.
- [ ] #4 **Undo.** Undoing an applied step makes a revert commit, or drops the commit while nothing has been pushed. History stays linear and readable.
- [ ] #5 **Send.** "Send" pushes the hand-back branch and opens a PR into the branch it came from, and never into the project's default branch unless that is where the person started. Sending again updates the same PR.
- [ ] #6 **PR body.** The body follows the project's PR template when there is one, and carries the change list, new tokens with their values, off-token values left in place, shared components whose definition changed with their usage counts, and before and after screenshots at phone and desktop widths for each changed page.
- [ ] #7 **No GitHub assumed.** If the project's remote isn't GitHub, or `gh` is missing or signed out, Send says so and offers to push the branch and show its name, rather than failing silently.
- [ ] #8 **Branch moved.** If the target branch has moved, Send first merges it in. A conflict stops Send and tells the person to ask a developer. Truing never force-pushes.
- [ ] #9 **Dry run.** A dry run against a throwaway branch in a public fixture repository produces the PR above, with a link recorded here.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
