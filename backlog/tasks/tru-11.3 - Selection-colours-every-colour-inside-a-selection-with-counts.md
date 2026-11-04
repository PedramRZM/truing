---
id: TRU-11.3
title: 'Selection colours: every colour inside a selection, with counts'
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - inspector
  - tokens
milestone: m-2
dependencies:
  - TRU-3.8
  - TRU-1.4
  - TRU-2.1
type: feature
ordinal: 110030
parent_task_id: TRU-11
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper's right panel lists every colour in the selection and everything inside it, each with how many layers use it. Figma has the same section, where changing one changes them all. It fits Truing well because we know which are tokens: select a page, and see at once its two nearly identical greys, the hex nobody tokenised, and where each one is.

Research: `docs/research/paper-design-teardown.md` ("The right panel"); `src/tokens/lookup.ts`, `src/modules/selection/inspect.ts`, `instances.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The list.** With an element selected, a section lists each distinct colour used inside it, across text, background, border and fill, most used first. Each row shows a swatch, the token's name (or the value, flagged off-token per TRU-11.2), and the count.
- [ ] #2 **Scope is honest.** Counts cover what's rendered on the page now, and the section says so. Elements hidden by state aren't counted.
- [ ] #3 **Find them.** Clicking the count outlines every element using that colour on the canvas, and the arrow keys walk through them.
- [ ] #4 **Change them.** Picking another token for a row stages one change per class location, in TRU-4.1's tray, labelled Direct or Claude per element. One that lives in a shared component says how many other instances it reaches (TRU-2.2's reach).
- [ ] #5 **Off-token first aid.** An off-token colour shows its nearest tokens, from TRU-11.2.
- [ ] #6 **Without tokens.** Colours are read from the page, so the list works on any app with no config. A project with no token table shows raw values and counts, and offers nothing to swap to.
- [ ] #7 **Limits.** On a very large selection the list builds without blocking the page, and caps its element walk with a stated limit.
- [ ] #8 **Tests.** Unit tests for colour collection and token matching across light and alpha values. Playwright on the fixture: counts, the outlines, and a staged change.
- [ ] #9 **UI checked.** Screens checked against `docs/design-language.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
