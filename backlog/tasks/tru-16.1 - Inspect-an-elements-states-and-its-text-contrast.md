---
id: TRU-16.1
title: 'Inspect an element''s states, and its text contrast'
status: To Do
assignee: []
created_date: '2026-11-01 10:44'
labels:
  - inspector
milestone: m-3
dependencies:
  - TRU-2.1
type: feature
ordinal: 160010
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-2.1's inspector shows each class's token as the page draws it now. People also need the hover, focus and active states, which are hard to hold while picking. Cortex and Airship both force a state on the pick. Neither checks contrast.

Research: Cortex's `state-detector.ts`, `panel-style-snapshot.ts` and `components/PanelHeader.tsx`; Airship's `packages/overlay/src/inspector/forced-state.ts`; ours in `src/modules/selection/inspect.ts` (`stylesOf`) and `src/tokens/`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **States.** A row above the styles offers Default and each of `:hover`, `:focus-visible`, `:active` and `:disabled` that the pick's classes style. Choosing one forces that state in the frame, and the style rows show that state's tokens. Rows that differ from Default are marked. Leaving the pick, or choosing Default, removes the forced state.
- [ ] #2 **Contrast.** For an element with text, the inspector shows the WCAG contrast ratio of its text colour on its effective background, in light and dark where the project has both. Each ratio is marked against 4.5:1, or 3:1 for large text. Where the background can't be known (an image, a gradient), it says so instead of showing a number.
- [ ] #3 **Read from the page.** States and contrast come from the running page, so they work on any app with no config or token location. Token names appear only where the project has a token table, and otherwise the raw values show. How dark mode is switched is learned from the profile, and with no dark mode only one ratio shows.
- [ ] #4 **Tests.** Unit tests for the ratio and the background walk. Playwright on a fixture button with hover and focus styles, and on a text pair that fails 4.5:1.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
