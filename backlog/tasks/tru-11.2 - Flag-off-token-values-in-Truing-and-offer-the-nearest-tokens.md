---
id: TRU-11.2
title: Flag off-token values in Truing and offer the nearest tokens
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - tokens
  - inspector
milestone: m-2
dependencies:
  - TRU-1.4
  - TRU-2.1
  - TRU-6.4
type: feature
ordinal: 110020
parent_task_id: TRU-11
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People want to see at a glance any value that doesn't use the app's tokens. There are two places to look:

- **Statically:** arbitrary classes (`p-[13px]`, `text-[#333]`) and raw colours in `style={{}}`. TRU-11.6's lint covers this.
- **On the page:** a computed colour, spacing, radius, font size or shadow that matches no token, whatever produced it. This task covers that, and builds on TRU-2.1's inspector.

Every flag comes with the nearest tokens, so fixing it is one click, through TRU-4.1's direct edit.

Research: `docs/research/token-inspection-and-authoring.md` (matching computed values to tokens, OKLCH and `color-mix` for opacity, authored versus inherited values),.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **In the inspector.** A value with no matching token shows a warning style, the raw value, and up to three nearest tokens with their distance: perceptual for colour, px for lengths.
- [ ] #2 **Page list.** An "Off-token" list for the current page groups findings by kind and element. Clicking one selects the element.
- [ ] #3 **One-click fix.** Picking a suggested token applies it through TRU-4.1's direct edit when the value comes from a static class. Otherwise it says why it can't, and offers to hand the fix to Claude.
- [ ] #4 **No noise.** Inherited and browser-default values aren't flagged. Tailwind's internal variables (`--tw-*`) never appear.
- [ ] #5 **Works from the token table alone.** Flags use the table Truing already holds for the project. No config, path or framework setting is added. A project with no token table gets no flags and one quiet line that says why, with a way to run the token read again. Token tables read through Claude (TRU-8.3) work the same.
- [ ] #6 **Tests.** Unit tests cover the matcher (exact, near, opacity-modified, and none). A Playwright test runs on a fixture with `p-[13px]`, `text-[#333]` and an inline style colour.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
