---
id: TRU-16.10
title: Insert a text or a frame into the page
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-3.5
  - TRU-4.1
  - TRU-12.2
type: feature
ordinal: 160100
parent_task_id: TRU-16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper's rail has Frame (F) and Text (T), and clicking drops one where you point. Someone refining a real screen often needs one more label or wrapper, and asking Claude for it is slow.

The product spec rules out designing brand-new screens from nothing. This task isn't that, since it adds an element to a page that exists, though it does take Truing from refining to adding. Paper's Rectangle and Pen stay out: a codebase has no use for loose shapes.

Research: TRU-4.1's direct edits on static JSX; TRU-12.2's Claude path; TRU-16.9's drop positions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Tools.** Text and Frame on the rail. With one active, hovering shows where the new element will land among the parent's children, using TRU-16.9's drop indicator.
- [ ] #2 **What it writes.** A static JSX parent gets a direct insertion, with token classes only: text gets a named style (TRU-4.3) and frames an empty flex. A dynamic parent (`.map()`, a condition) goes to Claude with the reason.
- [ ] #3 **Styles from the project.** The text style and spacing come from the project's token table, and no style names are assumed. With no tokens, the insertion uses plain utility classes when the project has them, and otherwise goes to Claude. Writable files come from the profile.
- [ ] #4 **New text is new copy.** It's staged and visible in the tray.
- [ ] #5 **Preview at once,** undone with the rest of the change set.
- [ ] #6 **Tests.** Playwright on the fixture: insert into a static parent and check the source diff; a `.map()` parent stages a Claude change.
- [ ] #7 **UI checked.** Screens checked against `docs/design-language.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
