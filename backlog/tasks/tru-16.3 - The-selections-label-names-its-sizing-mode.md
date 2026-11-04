---
id: TRU-16.3
title: 'The selection''s label names its sizing mode'
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - inspector
milestone: m-3
dependencies:
  - TRU-2.1
  - TRU-3.1
type: feature
ordinal: 160030
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper's pill under the selection reads `Fill 288 × Fit 56`, in mono on the accent: it says why the element is that size as well as how big. Ours says `button · Button · 80×36`. People need to know that an element is filling its parent before they try to resize it.

Research: `docs/research/paper-design-teardown.md` ("The right panel"); `src/modules/selection/overlay.ts`, `measure.ts`, `describe.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The pill.** Under the pick's outline, mono type at screen size (TRU-2.5's rule): `Fill 288 × Fit 56`. Modes in plain words: Fill, Fit, Fixed.
- [ ] #2 **How it's decided.** From the element's classes first (`w-full`, `flex-1`, `w-fit`, `h-10`), then computed style and the parent's layout. Where it can't be sure, it shows the size alone rather than guess. Unit-tested over those cases.
- [ ] #3 **No Tailwind needed.** On a project with no utility classes, the mode comes from computed style and the parent's layout alone. It reads nothing from the project beyond the page, and needs no config.
- [ ] #4 **Identity stays.** The component's name keeps its label above the outline. TRU-2.1's and TRU-2.5's labels don't collide with the pill, even on an element at the frame's edge.
- [ ] #5 **The same words.** TRU-3.8's Layout section and TRU-4.2's dropdown use the same three modes.
- [ ] #6 **Tests.** Playwright on the fixture: Fill, Fit and Fixed elements.
- [ ] #7 **UI checked.** Screens checked against `docs/design-language.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
