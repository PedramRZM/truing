---
id: TRU-20
title: 'Epic: visual refinement of the real app'
status: In Progress
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-03 11:27'
labels:
  - epic
milestone: m-3
dependencies:
  - TRU-18
type: epic
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer builds a feature end to end on a branch. Someone else, who may never write code, refines the real UI on their own machine in Truing: a local-only editor over the real repository.

In Truing, a person can select anything and see the component, its variant and its tokens; see off-token values flagged; edit through token-aware panels, and create tokens when one is missing; reorder by drag, and switch between phone, tablet and desktop; and ask Claude, on their own subscription, for anything the panels can't do.

Every change is a source edit, committed to a hand-back branch and sent to the developer as a PR into the feature branch. Every visual change is staged the same way, then applied by one of two paths:

- **Direct.** A token swap, a breakpoint class on a static string, text, a variant or a static reorder is written exactly, with no model call.
- **Through Claude.** Changes that need judgement go to Claude with their per-viewport intent and screenshots, and are checked at every size before they're kept. This includes most responsive work, classes built at runtime and changes across components.

Decisions so far:

| Question                       | Decision                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where changes go               | A hand-back branch cut from the feature branch, with a PR into the feature branch. A developer reviews and CI runs before anything lands.                                                                                             |
| What runs on the person's machine | The full app, however that project runs it                                                                                                                                                                                          |
| Where tokens live              | Code first. The project's token source is the source of truth, people create tokens through reviewed PRs, and any Figma file is updated from code                                                                                     |
| Where the AI runs              | The person's own Claude subscription, through their own unmodified `claude` CLI. No API keys in Truing                                                                                                                                |
| Base and shape                 | ADR 0001: composed from our own parts, injected by its own Chromium window (nothing added to the app, no proxy), with features as modules                                                                                             |
| Performance                    | A performance module (Web Vitals, renders, long tasks), with findings handed to Claude                                                                                                                                                |
| Truing's own look              | Paper is the reference for the chrome: panels always open beside the canvas, Design and Theme tabs, a vertical tool rail, sections by selection, layers for designers with a Code view. `docs/design-language.md` states it for every screen |
| The properties panel           | Designers' controls first: numbers, fonts, swatches, with code in a closed section at the bottom. Any number can be typed, and one off the scale snaps to the nearest step and says so                                                |

Not in scope: hosting Truing anywhere but a local machine, real-time multiplayer, editing server code or data from Truing, two-way Figma sync, designing new screens from nothing.

Spec: `docs/specs/product.md`. Workflow: `docs/specs/code-first-workflow.md`. Decision: `docs/adr/0001-compose-our-own-injected-browser-modules.md`. Research: `docs/research/README.md`.

This is the product-level outcome. It has no tasks of its own: the work is split across the epics it depends on, and it closes when they do.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A person has refined one real feature end to end with Truing, a developer merged the PR, and the product spec's metrics were recorded (TRU-13.3).
- [ ] #2 Every acceptance criterion in `docs/specs/product.md` holds, each with the proof it names.
- [ ] #3 No Truing code in any build of an app, by construction and with a check.
- [ ] #4 `docs/specs/code-first-workflow.md` is ratified or revised as an ADR.
- [ ] #5 **Zero config throughout.** Every feature in this epic works in a project Truing has never seen, with no config file. What it needs from the project comes from the saved profile or from Claude reading the project, and it asks the person when Claude can't tell.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
