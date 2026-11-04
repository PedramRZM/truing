---
id: TRU-2.5
title: 'Spacing at a glance: gaps between children, a Spacing toggle, token names and pinned measurements'
status: Done
assignee: []
created_date: '2026-11-01 11:30'
updated_date: '2026-11-01 13:05'
labels:
  - inspector
dependencies:
  - TRU-2.3
type: feature
ordinal: 20050
parent_task_id: TRU-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-2.3 hatched the pick's padding and margin, and Alt-hover measures to another element. The designers asked on 2026-11-01 to see the spacing between elements easily. The sweep (`docs/research/menus-spacing-frames-takes.md`, "Spacing at a glance") found what we lack:

- Airship's gap bands between children, measured from the boxes, so `space-between` and margins count;
- spacing shown without holding a key, as in Figma's Dev Mode and VisBug's Guides;
- pinned measurements;
- outlines on the parent.

No tool names the spacing token on the canvas. We can, from the token manifest and the project's spacing scale. All of this is read-only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Gaps.** When the pick has two or more children, the gaps between them are hatched, with a px label per gap, measured from the child boxes.
- [x] #2 **A Spacing toggle.** A key from TRU-2.3's list and a toolbar button. While it is on, hovering any element shows its padding, margin and gaps, and the distance to the pick, without Alt. Alt stays the quick, temporary way.
- [x] #3 **Token names.** Where a label's value matches the class that set it, the label names the token: `px-400 · 12`. Otherwise it shows bare px.
- [x] #4 **Readable at any zoom.** The labels, including the hover and pick labels from TRU-2.1, are drawn at screen size, not at the frame's scale. At 40% today they can't be read (TRU-2.3's screenshots).
- [x] #5 **The parent.** The pick's parent gets a dotted outline.
- [x] #6 **Pinned measurements.** Shift+click while measuring keeps a measurement on screen, several at once. Esc clears them, as one layer of TRU-2.3's Esc.
- [x] #7 **Tests.** Unit tests for the gap geometry and the token match. Playwright on the fixture: gaps, the toggle, a token label, a pin.
- [x] #8 **UI checked.** A browser check screenshots of the overlays, then a design review.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Everything stays inside the repo; the app is unchanged.

### What the frames need to know

1. **The zoom.** The shell scales frames with a CSS transform, so a frame can't tell its zoom today. A new bus message `view` (shell → server → every runtime, kept by the server and sent on hello, like `mode`) carries the camera's scale (1 in Fill) and the Spacing toggle. The probe context gets `ctx.view()` and `ctx.onView(callback)`. Sent only when the scale or the toggle changes, not on a pan.
2. **The Spacing toggle** is a core command (`spacing`, key S, group Tools) with a toolbar button after Hand, `aria-pressed`, its tooltip and `aria-keyshortcuts` from the list, and a row in the `?` sheet. The shell keeps it; frames get it through `view`. _(Decision below.)_

### Geometry (`measure.ts`, pure)

3. `gapBands(content, children)`: for each pair of adjacent drawn children (in-flow: no `position: absolute/fixed`, no `display: none/contents`), side by side when they share more than half the shorter height, else stacked. The band runs between their border boxes, across the union of the pair on the other axis, so margins and `space-between` count. Pairs that touch are skipped; at most 64 bands.
4. Pinned measurements reuse `measureBetween`.

### Token names (`spacing-tokens.ts`, pure, both sides)

5. The server reads each class of the hovered or picked element through the token table and keeps those with a spacing root and a px value: `{ className, root, px }` (`ClassLookup` gains the parsed `root`). It sends them to the frame with a new probe command `spacing` `{ id, classes }`, beside `label`, so the component name doesn't wait for the token table. The `hovered` report gains the element's `classes`.
6. `tokenFor(target, px, classes)`: which roots can set which label (`p` < `px`/`py` < `pt`/`pr`/`pb`/`pl`/`ps`/`pe`/`pbs`/`pbe`, same for `m*`; `gap` < `gap-x`/`gap-y`, plus `space-x`/`space-y` for the gaps), the most specific root whose px equals the value (±0.5) wins. Logical sides read the element's `direction`. The label is `px-400 · 12`; otherwise `12`; `auto` stays `auto`. Distances between two elements stay bare px: no class sets them.

### The overlay (`overlay.ts`, `probe.ts`)

7. The pick: its bands as now, plus gap bands with their labels, plus a dotted outline on its parent (not on `<html>`).
8. Hover: while Spacing is on, or Alt is held, the hovered element shows its padding, margin and gaps, and the distances to the pick. Alt alone keeps working with Spacing off.
9. Readable at any zoom: every label and chip (hover, pick, bands, gaps, distances) is drawn at screen size (`scale(1/zoom)`, kept on screen). Outlines and distance lines stay one screen pixel, and the hatch keeps its period, so they don't vanish at 40%. _(Assumption: the criterion names the labels; the hairlines have the same problem, so they get the same fix.)_
10. Pins: Shift+click while measuring (Spacing on or Alt held, with a pick, over another element) keeps that measurement, as many as wanted; they follow layout on scroll and resize. The click doesn't change the pick. Esc clears the pins first, then the pick, as one layer in the frame's Esc. (The shell hands Esc to every frame, so with pins in one frame and a pick in another, one press clears both.)

### Proving it

- Unit (vitest): `gapBands` (row, column, wrap, `space-between`, margins, touching, the cap), `tokenFor` (each root, specificity, a value off the scale, logical sides in RTL, variants), the `view` message and the toggle in the command list (no chord bound twice).
- Fixture: a flex row with `justify-content: space-between`, a column with margins, and a box whose padding comes from a class. The fixture app ships no Tailwind, so the class's value is set inline beside it, as the token table reads it (`px-400` with 12 px).
- Playwright (`spacing.spec.ts`): the pick's gaps and their px; the toggle by key and by button, a hover showing bands and distances without Alt; a token label `px-400 · 12`; a pin kept across another hover and cleared by Esc before the pick; label size on screen at 40% equal to 100%. The other fixture specs run unchanged.
- A browser check screenshots at 1440 × 900 at 100% and 40% (Truing is a desktop tool, as in TRU-2.3), then a design review, a copy review on the new strings, and a task review on the diff.

Decisions on the plan (2026-11-01): Spacing is a core view setting beside Hand, sent with the zoom in `view`; its key is S.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
- the `view` message (zoom and Spacing), the S key and the toolbar button;
- gaps, the Spacing hover, token names, pins, the parent outline, labels at screen size, and the tests;
- a chip at the frame's edge moves back inside;
- the reviewers' findings;
- chips back on their bands, the outline labels moving off them instead, and no gaps inside an `<svg>` (2026-11-01);
- crowded chips spread outward along their own side (2026-11-01).

### What changed

- **Contract:** a `view` message (shell → server → every runtime, sent on hello like `mode`) carries the camera's scale and the Spacing toggle. Probes read it with `ctx.view()` and `ctx.onView()` (docs/modules.md). The shell sends it only when the scale or the toggle changes.
- **Spacing** is a core command (S, group Tools) with a ruler button after Hand. Its tooltip, `aria-keyshortcuts` and `?` row come from the list. Pressed in a frame, S reaches the shell like H.
- **Gaps** (`gapBands` in `measure.ts`): between each pair of adjacent children in the flow, measured between their border boxes. That covers `space-between`, margins and a grid's gaps. Bands run across both children, with at most 64. Purple, as in devtools.
- **Hover:** with Spacing on or Alt held, the hovered element shows its padding, margin and gaps, and the distances to the pick.
- **Token names** (`spacing-tokens.ts`): the server sends each hovered or picked element's classes that read a spacing token, with the token's px, through a new probe command `spacing`. It runs apart from `label`, so a name never waits for the token table. `ClassLookup` gains the parsed `root`.
  - The most specific root wins (`pt` over `py` over `p`), and logical sides follow `direction`.
  - The label reads `px-400 · 12`, else bare px. Distances stay bare px.
- **Parent:** the pick's nearest ancestor with a box gets a dotted outline.
- **Pins:** Shift+click while measuring keeps the measurement, several at once. They follow scrolls and resizes. Esc clears them first, then the pick. The `?` sheet lists "Pin a measurement" and "Clear pinned measurements".
- **Screen size:** labels, chips, outlines, lines and the hatch are drawn at the inverse of the zoom. Chips stay centred on their bands while there is room; on a small box, where they would meet in its middle, each slides outward along its own side (top up, left left) until it covers no other chip, then is kept inside the frame's edge. The hover and pick labels move instead: above the outline, below it, inside it, then further out, wherever they cover no chip.
- **`<svg>`:** an icon is one picture, so no gaps are drawn between its paths.

### How it was verified

- **Unit:** `pnpm exec vitest run` passes 176 tests. `spacing.test.ts` is new (16): gap geometry (row, column, wrap, reversed, `space-between`, touching, the cap), the token match (each root, specificity, off-scale values, RTL, variants, which roots count) and label placement, including boxes with getter sides as in a DOMRect. `tokens.test.ts` adds the root; its frozen snapshot gained only the five `root` lines.
- **Fixture:** `test/e2e/spacing.spec.ts` passes 6 tests:
  - the pick's gaps, with the label equal to the measured width, and the column gap from a margin;
  - the parent outline past a `display: contents` wrapper;
  - a token label on the pick and on a hover;
  - S and the button turning hover bands and distances on and off, and Alt alone;
  - two pins kept across a hover, with Esc clearing pins before the pick;
  - labels 20 px tall on screen at the fitted zoom and still at 33%;
  - no chip or label overlapping another with the row just above the pick.

  All fixture specs pass together: 48. One TRU-2.3 assertion changed on purpose. The Spaced box's two inline spans are a space apart, so its band count now checks padding and margin (8) and the gap (1) separately, with all 9 labels exact.
- **Not run:** `real-app.spec.ts`, as in TRU-2.3: Next allows one `next dev` per folder, and Truing's server held it.
- **UI:** screenshots at 1440 × 900 through Truing on the fixture app, at 100%, 40% and 33%: the pick, a Spacing hover, pins, and after the placement fix. They are in `/tmp/spike/` and were not committed. Labels and chips measure the same on screen at every zoom. No 412 px shots: Truing is a desktop tool.

### What the reviewers flagged

- **a copy review:**
  - fixed: the Spacing hint promised distances everywhere ("In Select mode, hover to see padding, margins, gaps and the distances to the selection.");
  - fixed: the sheet didn't say Esc clears pins (a new row, the Esc title unchanged).
- **a design review** (from the screenshots: the shell connects only inside Truing's own browser):
  - fixed: a distance to the element above the pick was hidden under the pick's label;
  - tried, then undone at Decisions: a pass that moved chips apart where a band is thinner than its chip. It took them off their sides (seen in screenshots of a header button and a logo on a real app). On a small element, opposite chips may touch;
  - left for you: pins look like the live measurement;
  - left for you: the margin orange and the distance red have the same lightness (both colours from TRU-2.3);
  - older than TRU-2.5: the blue outline is 2.99:1 on white.
- **a task review:**
  - fixed: a `display: contents` parent drew a dot;
  - fixed: token names on a hover had no end-to-end test;
  - left: at a wrapped row's break, a short last child makes the gap band start at its own bottom, not the row's;
  - left: pins outlive a new pick and Interact mode until Esc;
  - left: the hover and pick labels can run past the frame's right edge (as in TRU-2.3);
  - left: the `view` message has no unit test of its own, only the end-to-end ones.

### Left open

- **Taste:**
  - the purple gaps;
  - pins drawn like the live measurement (dashed?);
  - orange margins next to red distances.
- **Calls:**
  - should a new pick, or Interact, clear the pins?
  - should S switch to Select mode, since it does nothing in Interact?
  - "while measuring" in the sheet means Alt held or Spacing on.
- **Esc goes to every frame:** with pins in one and a pick in another, one press clears both.

### Decisions

- **Chips** stay on their bands; the blue outline labels move instead. On a small box, crowded chips spread outward along their own side (checked on a real app's Sign in and Quick buttons).
- **No gaps inside an `<svg>`** (the logo showed its paths' gaps).
- **The runtime budget** stays at 80 KB: the spacing roots' table is written short to fit (79.9 KB).
<!-- SECTION:FINAL_SUMMARY:END -->
