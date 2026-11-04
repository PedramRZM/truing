---
id: TRU-3.1
title: 'A light theme for Truing, with Paper''s colours'
status: Done
assignee: []
created_date: '2026-11-02 09:28'
updated_date: '2026-11-02 11:48'
labels:
  - panels
dependencies:
  - TRU-1.5
type: feature
ordinal: 30010
parent_task_id: TRU-3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The maintainer asked for this on 2026-11-02 after seeing Paper: "the light mode is cool, use same colors". Our chrome is dark, after Airship's tokens. Beside a light app, it pulls the eye away from the page being designed. Paper keeps one token set of `light-dark()` pairs, so the theme follows the system with no second stylesheet. The values are in `docs/research/paper-design-teardown.
The product spec rules out dark mode for the app. This is Truing's own chrome, so it isn't affected.

### Decision (2026-11-02)

Paper's two lightest greys and its blue miss the 4.5:1 Truing holds its text to (TRU-1.6's design review). Computed on the `#f2f2f2` panel: text 3 is 3.89:1, text 4 is 3.04:1, white on the accent 3.03:1. Decided: **use Paper's values everywhere except text that fails**, where:

- text 3 and 4 use black at 0.6 (5.55:1), the next value in Paper's own scale;
- white text on the accent sits on blue-5, `oklch(55% .145 258)` (4.91:1), as `--ds-accent-fill` does today.

With text 2, 3 and 4 then alike, size and weight carry the hierarchy, and TRU-3.8's empty sections read as empty because they hold nothing but a title and a `+`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **One token set.** Every `--ds-*` colour is a `light-dark()` pair using Paper's values for both modes. `color-scheme: light dark` on `:root`; no second stylesheet and no theme class.
- [x] #2 **Light by default, dark by the system.** Truing follows `prefers-color-scheme`, and a designer on a dark system still gets dark. A manual switch waits for TRU-16.8's menu.
- [x] #3 **Measures.** Type 12 px with 16 px lines (13 and 10 px for headings and small), weights 400, 465 and 500. Controls 24 px, radius 6 px, `--shadow-control` in place of borders. Rows move to 28 px in TRU-3.7.
- [x] #4 **No stray colours.** The literals outside the token block in `styles.css` (the dot grid, the raised shadows, the checker) move to tokens or go. `overlay.ts`'s colours stay in one named list, since the overlay draws in the app's frame. A test fails on a colour literal anywhere else in `src/shell` or `src/modules`, so new ones can't creep in.
- [x] #5 **Canvas.** Flat `#eee` and `#282828`, with no dot grid. The frame still stands out in both.
- [x] #6 **Overlays.** Hover and pick outlines, labels and spacing bands in the frame use the new accent, and hold 3:1 as outlines on white and on the app's dark surfaces. TRU-16.2's second colour still has room.
- [x] #7 **Contrast.** Every text colour measured at 4.5:1 or better on the surfaces it sits on, in both modes, per the decision above. Numbers recorded in the task.
- [x] #8 **Nothing lifted.** Inter, JetBrains Mono and `lucide-react` stay. No fonts, icons or cursor images from Paper.
- [x] #9 **Tests.** Existing studio tests pass unchanged, except assertions on colour values, which move to the new values. Playwright checks the panel background under each emulated colour scheme.
- [x] #10 **UI checked.** A browser check in both modes, then a design review.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Follow the system.** `src/studio.ts` launches with no `colorScheme`, and Playwright's default is `light`, so a dark system never reaches the page. Pass `colorScheme: null`. A real app's and the fixture's dark mode go by class, so the app in the frame doesn't change.
2. **Tokens.** Rewrite the block in `src/shell/styles.css` to `docs/design-language.md`'s table, as `light-dark()` pairs, with the measures (12/16 px, 13 and 10 px, weights 400, 465, 500, controls 24 px, radius 6 px, `--ds-shadow-control`). Drop what has no role: backdrop, strong border, accent hover, accent background, 11 px.
3. **Rules.** Move literals to tokens (grid goes, shadows, checker), borders on controls to the shadow, and text on a fill to the right colour. In light, `--ds-text` on the accent fill would be dark on blue.
4. **Overlay.** `overlay.ts`'s colours in one named list, with the new accent. `BAR_SPACE` follows the shorter bar.
5. **Guards.** A unit test: every colour token is a pair, no literal elsewhere in `src/shell` or `src/modules`, the overlay's accent matches the tokens, computed contrast per surface. A new `theme.spec.ts`: panel and canvas under each scheme, measures, and every visible text's measured contrast.
6. **Checks.** Unit, typecheck and e2e, screenshots at 1280 and 1440 in both modes, then a design review and a task review.

Where the sources disagree, and what this task does (computed numbers; the maintainer reviews):

| Paper's value                                    | Measured                            | Here                                                                                                                 |
| ------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Focus ring, light, `oklch(74% .12 258)`          | 2.07:1 on the panel; 3:1 is the bar | Blue-5, 4.39:1. Dark keeps Paper's (3.6:1). Also the current row's mark and the active frame's outline.              |
| Icon, light, black at 0.35                       | 2.41:1; `docs/design-language.md` has no icon row | Black at 0.5, 3.89:1. Dark keeps Paper's white at 0.4 (3.59:1). Row added to `docs/design-language.md`.                            |
| Orange and green status dots on the light canvas | 1.61:1 and 2.93:1                   | Paper's colours, with a 1 px ring in the icon colour that holds 3:1.                                                 |
| "Spacing bands use the new accent" (criterion)   | TRU-2.5's bands are told apart by hue  | Outlines and labels take the accent. Bands keep margin, padding and gap hues, or they could no longer be told apart. |
| Dark `--ds-shadow-control`                       | Not measured               | Our own: Paper's `#fff8` highlight glows on `#373737`, so white at 0.07, with darker outer shadows.                  |
| Segment track, dark, white at 0.06               | The same colour as the pressed part | Black at 0.2, a new `--ds-track`. Row added to `docs/design-language.md`.                                                          |
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **`src/shell/styles.css`:** one set of `light-dark()` tokens and the measures. Literals moved to tokens, the dot grid is gone, and controls carry the shadow in place of a border. A pressed tool and a toggle show white on the fill, and Apply is the dark confirming button.
- **`src/studio.ts`:** `colorScheme: null`. Without it Playwright emulates light, so a dark system never reached the page. With a dark preference forced in Chromium through `--blink-settings`, the old launch read light and this one reads dark.
- **`src/modules/selection/overlay.ts`:** every colour in one `COLOURS` list, with the new accent.
- **`src/shell/store.ts`:** `BAR_SPACE` follows the bar, now 34 px.
- **Accent as small text.** A frame's name, a marked menu row and the shared-change warning moved to text 1, as `docs/design-language.md` says. A pressed menu row now shows on the selected background.
- **Also fixed:** `<strong>` fell to the browser's 700, and placeholders used the browser's grey (4.38:1 in light, 2.58:1 in dark, reproduced by the test before the fix).
- **Docs:** `docs/design-language.md` gains Icon and Segment track rows, a new focus value and a note on why; `docs/modules.md` no longer calls the shell dark.
- **Chromium.** Truing's Chromium 147 supports `light-dark()` and `corner-shape`. Nothing uses `corner-shape` yet, as no criterion asks for it.

### Contrast, computed from the tokens

`test/unit/theme.test.ts` holds these. `test/e2e/theme.spec.ts` also measures every visible text on the page, with a pick in the panels, in the viewport menu and in the shortcuts sheet, in both modes.

| Light        | Panel | Canvas | Control | Hover | Selected |
| ------------ | ----- | ------ | ------- | ----- | -------- |
| Text 1       | 11.72 | 11.44  | 12.21   | 11.16 | 10.46    |
| Text 2, 3, 4 | 5.55  | 5.49   | 5.65    | 5.42  | 5.26     |
| Icon (3:1)   | 3.89  | 3.86   | 3.94    | 3.83  | 3.75     |

| Dark       | Panel | Canvas | Control  | Hover    | Selected |
| ---------- | ----- | ------ | -------- | -------- | -------- |
| Text 1     | 11.9  | 12.2   | 9.99     | 10.56    | 9.3      |
| Text 2     | 6.96  | 7.09   | 6.07     | 6.34     | 5.73     |
| Text 3     | 5.79  | 5.89   | 5.12     | 5.33     | 4.87     |
| Text 4     | 4.76  | 4.83   | not used | not used | not used |
| Icon (3:1) | 3.59  | 3.63   | 3.31     | 3.41     | 3.2      |

White on the accent fill 4.91. White on the light confirm button 16.67; `#1e1e1e` on the dark one 14.89. The accent as an outline: 3.03 on white, 5.51 on `#1e1d26`, 5.68 on `#181b24`.

### How it was verified

- **Studio e2e:** `pnpm exec playwright test`, 96 passed, including `real-app.spec.ts` on Turbopack. No existing test was edited.
- **Unit:** `pnpm exec vitest run`, 350 passed. Both typechecks are clean; ESLint has no errors.
- **Screens:** at 1280 and 1440 in both modes, with no sideways overflow and no console errors. Opened and read; the frame stands out in both modes with the fixture's white page.
- **Not run:** `check-build`, as there's no app build to check.
- **A watch-limit trap.** The first full run had many failures, and Turbopack crashed with `OS file watch limit reached`: a VS Code helper held 65,092 of the 65,536 watches. With the limit raised to 524,288, the same suite passed. The fix was the maintainer's `sysctl`, and it lasts until a reboot unless added to `/etc/sysctl.d/`.

### What the reviewers flagged

- **a task review.** Fixed: selects at 27 px, and the numbers not recorded. Also fixed: the literal guard missed named colours, so a new check reads colour properties in the stylesheet's rules.
- **a design review** worked from screenshots, as the shell only connects inside Truing's own browser and its ports were in use. Fixed: the 20 px segment hit area, and the dark pressed segment matching its track. The other findings are below.

### Left open

- **The fonts never load.** There's no `@font-face`, and neither Inter nor JetBrains Mono is installed here, so the shots show Noto Sans and DejaVu Sans Mono. Noto has only Regular and Bold here, so 465 and 500 render as 400 and the weight hierarchy doesn't show. This is older than TRU-3.1, and the test reads computed weights only. Bundling adds a dependency, and Inter's metrics will shift every layout, so it should come before TRU-3.3. TRU-3.2 does it (2026-11-02).
- **Dark focus colour.** Paper's value is 2.76:1 on a selected row and 2.98:1 on a control, though the other edge meets the panel at 3.6:1. `oklch(64% .15 258)` gives 3.25:1 on the selected row.
- **Spacing bands.** The criterion says they take the accent; they keep their hues (the Plan's table).
- **Status dots** still say their state by colour alone, through a `title`. The ring only helps them show up.
- **For TRU-3.10:** overlay labels are 11 px Inter, not 10 px mono; 14 px icons and native triangles beside lucide chevrons; uppercase mono menu headings; `summary`, `.inspect-copy` and `.change-claude` are 16 px tall.
- **Taste:** the 2 px current-row mark curves with the row's radius; a raised button's hover in dark barely shows (1.06:1); stale content at 0.6 opacity drops light text 2 to 2.49:1 while it loads; the overlay outline is 2.71:1 on a `#f2f2f2` page.
- **Not checked:** a real dark desktop in the headed window, a dark app in the frame (computed ring 1.28:1), native select popups, and the Changes tray and failed-module states on screen.
- **Noticed, not touched:** `.frame-handle`'s hover rules set only an inset on `::after`, with no `content` or background, so the "2 px accent line" they describe doesn't appear to draw.
<!-- SECTION:FINAL_SUMMARY:END -->
