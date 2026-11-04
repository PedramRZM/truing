---
id: TRU-10.7
title: >-
  Let people change project access and settings later, and tell Claude what's on
  screen
status: To Do
assignee: []
created_date: '2026-11-04 06:53'
labels:
  - claude
  - onboarding
milestone: m-1
dependencies: []
parent_task_id: TRU-10
type: feature
ordinal: 100070
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three things that came up using Truing on a real project.

**Access.** Setup only offers a list of writable folders. Some people want Claude and direct edits to reach all of the project's code, and that should be their choice, in setup or later.

**Changing settings later.** What setup confirms has to stay changeable for each project. Today the only way back is `truing --reconfigure`, which goes through the whole read again. TRU-10.3 describes a settings screen that shows and edits the profile, so this should build on it or close it rather than add a second one. TRU-8.8 covers telling people which UI folders the writable list misses.

**What Claude knows about the screen.** The starter prompt 'Check this page against the design rules and list what looks off.' gets the answer that Claude doesn't know which page. A message carries only its text and any picked elements, and nothing else tells Claude what's on the canvas, so with nothing picked 'this page' means nothing. The second starter prompt has the same problem. It has to keep working once several frames are open, on different pages or sizes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Full access in setup.** The review screen offers a choice between the proposed folders and the whole project, with the proposed folders as the default, and says plainly what full access lets Claude and direct edits change
- [ ] #2 **Full access is enforced.** With it on, Truing's path guard and Claude's permissions both allow any file in the project, and a test proves it
- [ ] #3 **Limits that stay.** With full access on, secret files stay denied, files outside the project stay refused, and Claude still never commits or pushes. A test proves each. What happens to test files, which are always refused today, is decided and written down before this is built
- [ ] #4 **Everything can be changed later.** Every value setup confirms, access included, can be changed for one project from inside Truing, without running the project read again and without editing a file
- [ ] #5 **Changes hold.** A changed value is kept after a restart and takes effect in the next Claude message without restarting Truing, or the screen says a restart is needed. A changed start command is confirmed before it runs, as in setup
- [ ] #6 **Claude knows the page.** WHEN a person sends a message with nothing picked and one frame open THEN Claude is told that frame's page and size, and 'Check this page against the design rules' works with no follow-up question
- [ ] #7 **Several frames.** WHEN several frames are open THEN Claude is told each one's page and size and which one the person is working in, and 'this page' means that one. If nothing marks one out, Claude says which it looked at or asks
- [ ] #8 **Always current.** What Claude is told comes from the frames open when the message is sent, so moving to another page or closing a frame changes the next message's answer, and nothing about it is configured
- [ ] #9 **Tested.** E2E covers one frame, several frames and a frame that moved to another page, using the fake `claude` to read what was sent. A real `claude` run proves the starter prompt works with nothing picked
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
