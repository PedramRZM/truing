---
id: TRU-19.1
title: 'API-key and cloud-provider sign-in, honouring Claude Code''s own auth'
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - claude
  - onboarding
milestone: m-3
dependencies:
  - TRU-6.1
  - TRU-6.2
type: feature
ordinal: 190010
parent_task_id: TRU-19
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today Truing removes `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `apiKeyHelper` from Claude's environment, so a run stays on the person's subscription. That is right when a login exists. Someone with no subscription, on an API key, or on Bedrock or Vertex, is shut out by it.

Truing should do what Claude Code itself does, instead of dropping those variables when there is no login.

Research: `docs/research/claude-subscription-bridge.md`, `src/claude/session.ts`, Claude Code's authentication docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Follows Claude Code.** `claude auth status` decides. With a login, the behaviour stays as it is. With no login, the variables Claude Code honours are left in place, so its own auth applies.
- [ ] #2 **Cloud providers.** Bedrock and Vertex work through Claude Code's own environment settings, and a manual run on each is recorded.
- [ ] #3 **Truing holds nothing.** Truing still has no field for a key or token, never reads or stores one, and never passes one on the command line. The person sets it the way Claude Code documents.
- [ ] #4 **Nothing to set in Truing.** No Truing setting or config is added. The connection check reports which method is in use, and the real round trip proves it works.
- [ ] #5 **Says what it costs.** When the method bills by usage, the UI says so before the first run. A person on an API key sees that clearly.
- [ ] #6 **Tests.** Unit tests cover the environment for each case.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
