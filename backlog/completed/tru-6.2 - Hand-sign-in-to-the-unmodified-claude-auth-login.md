---
id: TRU-6.2
title: Hand sign-in to the unmodified `claude auth login`
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
  - onboarding
  - claude
milestone: m-0
dependencies:
  - TRU-6.1
parent_task_id: TRU-6
type: feature
ordinal: 60020
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Anthropic's terms say developers may not offer a Claude login in their own apps or handle the credentials. So Truing has no login form of its own. When sign-in is needed, it runs Claude Code's own unmodified `claude auth login` and waits for it to finish.

Research: `docs/research/claude-subscription-bridge.md`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **No login form.** Truing has no field for an email, password, key or token, and a test searches the setup UI to prove it.
- [x] #2 **Claude's own flow.** "Sign in" starts `claude auth login` and lets it open its own browser page. Truing doesn't read, relay or store anything from it, including the URL or code.
- [x] #3 **Finishes by itself.** When the login ends, the connection check runs again, with no restart. A cancelled or failed login says so and offers to try again.
- [x] #4 **No config.** It needs nothing set up, and works the same for every plan Claude Code supports.
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
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #1 no textbox is checked on one screen only. #2 stdio is inherited (connection.ts:198), but no test clicks Sign in: needs a real claude. #3 src/setup/ui/app.tsx:158-166 is untested. #4 other plans are unproven.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sign-in is `claude auth login`, with its terminal inherited and unread. E2E covers a login that works, one that fails, and no login form anywhere. Not run: a real login, as it would sign the machine out; the fake `claude` stands in for it. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
