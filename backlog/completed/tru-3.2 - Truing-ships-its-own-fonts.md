---
id: TRU-3.2
title: 'Truing ships its own fonts'
status: Done
assignee: []
created_date: '2026-11-02 11:48'
updated_date: '2026-11-02 11:48'
labels:
  - panels
dependencies:
  - TRU-3.1
type: feature
ordinal: 30020
parent_task_id: TRU-3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-3.1's design review found that Inter and JetBrains Mono never load. `styles.css` names them, but there's no `@font-face`, and a designer's machine needn't have them. Here the shell renders in Noto Sans and DejaVu Sans Mono. Noto has only Regular and Bold here, so weights 465 and 500 render as 400, and the hierarchy `docs/design-language.md` relies on doesn't show. The maintainer chose on 2026-11-02 to bundle them before TRU-3.3, since Inter's different widths will shift layouts and that's cheaper to absorb before the panels are rebuilt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Bundled.** Variable Inter and JetBrains Mono come from `@fontsource-variable/*`, pinned, as dependencies of Truing's package only. The shell needs no network and no installed font. The app's build gains nothing.
- [x] #2 **What renders.** Chromium reports Inter for interface text and JetBrains Mono for mono text, read from the browser's own record of the fonts it used, not from computed styles.
- [x] #3 **Weights.** 400, 465 and 500 each render differently in Inter.
- [x] #4 **Scripts.** Latin and Latin Extended are bundled. Other scripts, such as the app's Persian text in a layer row, fall back to the system's fonts. So does `→`, which neither subset holds (TRU-3.10).
- [x] #5 **Nothing breaks.** No sideways overflow at 1280 and 1440, in both modes. The bar and the panels still fit, and existing tests pass unchanged.
- [x] #6 **Licences.** `THIRD_PARTY_NOTICES.md` lists both fonts under the OFL.
- [x] #7 **UI checked.** Screenshots at 1280 and 1440 in both modes, then a design review.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin both packages in `package.json`.
2. Inline the woff2 files into `shell.css` with esbuild's `dataurl` loader, so `src/server.ts` needs no new route and nothing is fetched. Four files, about 189 KB before base64, on localhost.
3. Add `@font-face` rules to `styles.css`, keeping the family names `--ds-font` and `--ds-mono` already use, with each subset's `unicode-range`.
4. Tests in `theme.spec.ts`: the platform fonts through the DevTools protocol, and the ink drawn at the three weights.
5. Notices, `docs/design-language.md`, screenshots, then the reviewers.

The overlay stays as it is. It draws in the frame, where the shell's `@font-face` doesn't reach, and adding one there would touch the app's page (TRU-3.10).
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **`package.json`:** `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`, pinned at 5.3.0. Neither has install scripts. Only Truing's importer in `pnpm-lock.yaml` changes.
- **`src/build.ts`:** `.woff2` files load as data URLs, so `shell.css` carries them. It grew from about 100 KB to 351 KB, served from localhost.
- **`src/shell/styles.css`:** four `@font-face` rules, Latin and Latin Extended for each font, using each subset's `unicode-range`.
- **From the design review:** the frame's size and route moved from 10 px to 12 px mono, because JetBrains Mono's zero closes up at 10 px and `1440 × 900` read as `1448 × 988`. The shortcut keys lose their `letter-spacing`, which spaced hinted Inter unevenly (`Spa ce`). `--ds-text-10` had no other use, so it's gone.
- **Docs:** `THIRD_PARTY_NOTICES.md` lists the fonts, and its Airship row no longer claims the colours or dot grid TRU-3.1 removed. `docs/design-language.md` records the bundling and the 10 px limit.

### How it was verified

- **Studio e2e:** `pnpm exec playwright test`, 99 passed, including `real-app.spec.ts`. After that, two font tests were tightened and one added, and `theme.spec.ts` was run again on its own.
- **What renders:** Chromium's own record through `CSS.getPlatformFontsForNode` reports Inter and JetBrains Mono as custom fonts, so an installed copy can't pass the test.
- **Weights:** ink at 12 px is 497, 558 and 588 in the measuring run. Widths can't show this, as hinted text here advances in whole pixels.
- **Screens:** at 1280 and 1440 in both modes, with no sideways overflow and no failed requests.

### What the reviewers flagged

- **a design review** said "not ready" for the frame size, now fixed. Its other findings are below.
- **a task review** said "not ready" for gaps now closed: the font test ignored whether the font was bundled, nothing tested Latin Extended, and the notices were inaccurate. It confirmed four data URLs, no other `url()`, and that the fonts stay in Truing's importer.

### Left open

- **`→` falls back to a system font,** so it draws small and low. Neither subset holds it, and tests read it as text, so it went to TRU-3.10.
- **Taste:** section titles share the grey of the labels below them, at 5.45:1 against 11:1 for values. In dark, "Selection" and "Instances" differ slightly in grey. A `· 14px` can wrap alone onto its own line in the Styles list, which TRU-3.8 moves anyway.
- **Possible ligatures:** JetBrains Mono's `calt` is still in the subset, so `->` or `!=` in a class may draw joined. None appear in the shots. Turning them off needs a rule at each `font:` shorthand, which resets the setting.
- **Not checked:** a true 2x display (the attempt came out at 1x), Mac rendering, and the `⌘⇧⌥` glyphs.
- **The overlay's labels** stay in the app's fallback font, as the shell's `@font-face` doesn't reach the frame (TRU-3.10).
<!-- SECTION:FINAL_SUMMARY:END -->
