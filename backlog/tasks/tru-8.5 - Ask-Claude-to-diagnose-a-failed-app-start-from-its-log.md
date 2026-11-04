---
id: TRU-8.5
title: Ask Claude to diagnose a failed app start from its log
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - zero-config
  - claude
  - onboarding
milestone: m-1
dependencies:
  - TRU-6.6
type: feature
ordinal: 80050
parent_task_id: TRU-8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A dev server that won't start is the most common way to lose someone in the first minute. Its log usually says why, in words a person who doesn't write code can't read.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Reads the log.** When the app exits or never answers, Claude reads the log and the project, read-only, and returns what went wrong in plain words and a proposed fix.
- [ ] #2 **Secrets stay out.** Environment values and `.env` files are not sent, and known secret patterns in the log are removed first. A test proves it.
- [ ] #3 **Fix proposed, never run unasked.** A proposed command is shown and runs only if the person confirms it. A missing environment variable is named, and its value is never asked for or stored by Truing.
- [ ] #4 **No setup.** It needs nothing configured. It uses the same session as the setup, and if Claude isn't available it falls back to showing the log.
- [ ] #5 **Evaluated.** Fixtures cover a missing dependency, a port in use, a missing environment variable and a syntax error, each with a recorded result.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
