---
id: TRU-11.4
title: An eyedropper that answers with a token
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
labels:
  - tokens
  - inspector
milestone: m-2
dependencies:
  - TRU-3.9
  - TRU-11.2
type: feature
ordinal: 110040
parent_task_id: TRU-11
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper's colour fields have an eyedropper. Ours shouldn't write what it samples, since TRU-4.3 allows tokens only. Its answer should be the token: "this colour on the page is `brand-1-600`", or "this isn't a token, and these are the nearest". That also makes it a way to check an image or gradient against the palette.

`I` is Interact here and the eyedropper in Paper. Interact keeps it. This task picks a free key and records it in TRU-2.3's list.

Research: `src/tokens/lookup.ts`; TRU-11.2's nearest-token logic; the EyeDropper API's support in Truing's Chromium, against sampling from a screenshot of the frame.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Sampling.** From a colour field or the rail, the pointer samples any pixel on the canvas, including images and across frames, with a live magnified preview. Esc cancels.
- [ ] #2 **The answer.** The exact token if there is one, otherwise the three nearest by perceptual distance with their difference. On a colour field, choosing one stages the swap as TRU-4.3 does.
- [ ] #3 **Works from the token table.** It reads the table Truing already holds, whatever form the tokens came from, with no config. On a project with no tokens it shows the sampled value and says there is nothing to match against.
- [ ] #4 **Raw colours stay out.** Nothing writes a sampled value to source.
- [ ] #5 **Tests.** Unit tests for nearest-token ranking. Playwright: sample a token-coloured fixture element, and one that isn't.
- [ ] #6 **UI checked.** Screens checked against `docs/design-language.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
