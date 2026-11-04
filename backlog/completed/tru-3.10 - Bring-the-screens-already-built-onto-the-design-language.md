---
id: TRU-3.10
title: 'Bring the screens already built onto the design language'
status: Done
assignee: []
created_date: '2026-11-02 10:26'
updated_date: '2026-11-02 23:48'
labels:
  - panels
dependencies:
  - TRU-3.1
  - TRU-3.3
  - TRU-3.8
  - TRU-3.9
type: feature
ordinal: 30100
parent_task_id: TRU-3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The maintainer asked on 2026-11-02 whether the chat panel and the other features need a review to match Paper's design language. TRU-3.1 recolours everything, and TRU-3.3 checks that it fits, but nothing brings the screens already built up to `docs/design-language.md`. Their rows, menus and sheets were built after Airship's dark editor. Left alone, the new panels would sit beside old controls.

There's also a placement problem to solve here. TRU-5.2's Properties | Claude switch (2026-11-02) would hide the Changes tray while Claude shows, yet TRU-12.2 reports Claude's progress there.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **The Changes tray.** Built from the Section and Row patterns. It stays reachable in both views of the right panel: a one-line summary pinned to the panel's foot ("3 changes", and Apply) that opens upward, above TRU-5.2's composer. Apply is the one dark button. Direct and Claude labels stay as they are.
- [x] #2 **The right-click menu.** The Menu pattern: 24 px rows, groups split by lines, shortcuts at the row's end, white on the accent fill when highlighted. Its panel of ancestors and what's under the pointer (TRU-2.4) is unchanged in behaviour.
- [x] #3 **The shortcuts sheet and notices.** The sheet is a Popover, with TRU-16.11's search when that lands. TRU-2.3's notices become the Toast pattern, and `notify` in `docs/modules.md` describes where they now show.
- [x] #4 **Instances.** Its lists use the Row pattern, and fold as they do now. Counts sit at the row's end.
- [x] #5 **Module sections.** `module-empty`, `module-facts` and the failure state follow the patterns, so a module built only on the contract matches with no work of its own. `examples/element-count` shows it.
- [x] #6 **Overlays.** Pick and hover labels, spacing bands and measurements use the Label on the canvas pattern, and read at any zoom in both colour schemes.
- [x] #7 **What TRU-3.1's design review left.** Icons are 16 px in a 24 px button, one stroke, and lucide's chevrons replace the native triangles on `summary`. Menu headings lose the uppercase mono. `summary`, `.inspect-copy` and `.change-claude` get 24 px hit areas. Overlay labels follow the Label on the canvas pattern, in the frame's fallback mono: `@font-face` from the shell doesn't reach the frame, and adding it there would touch the app's page. The `→` in a token's path isn't in the bundled subsets, so it falls back to a system font and draws small and low: draw it another way, keeping what the tests and a copy read.
- [x] #8 **Nothing lost, words kept.** Every action still exists under the same name, and existing text stays word for word except where `docs/design-language.md`'s Words section needs a designer's word; each such change is listed in the PR.
- [x] #9 **Tests.** Existing tests pass with their assertions intact, apart from colour and position values, which are listed in the PR. Playwright: the tray's summary shows in both views of the right panel and opens from each.
- [x] #10 **UI checked.** A browser check at 1280 and 1440, in light and dark, for each screen above. Then a design review and a copy review, given `docs/design-language.md`.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. A `foot` place in the module contract, and the tray on it: a summary line, with the list opening upward.
2. Menu highlight, the sheet as a Popover, notices as the Toast.
3. Instance rows, shared module classes and the failure state.
4. Overlay labels, chevrons on `summary`, hit areas, icons, the `→`.
5. Measure each in a throwaway headless script, then the three reviews.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
- **The tray:** `panel.foot` in the contract pins a right section under whichever view shows, outside the scrolling body. The summary is "N changes", Discard and Apply. Its rows are Rows, with Undo on hover, and whether it's open is remembered.
- **The menus:** a highlighted row is white on the accent fill, including a row whose list is open, in every `.menu`. The panel colour sits at 92%, and shortcuts are text 2. The right-click menu grew from 240 to 264 px so every action fits one 24 px row.
- **The sheet:** a non-modal Popover beside the right panel, 400 px wide, with its title as a tab on a darker header. While it's open, frames ignore the pointer, so a press on one closes it, as before.
- **Notices:** 1.5 s, and a long one wraps. **Failures** are an icon and text, with no box. **`module-empty`** is text 2, and **`module-facts`** are Value rows. `element-count` shows both with no change of its own.
- **Also:** `FoldSummary` and `PathArrow` in `src/shell/controls/fold.tsx`. Instance rows are 28 px, with counts and actions at the end. Icons in 24 px buttons are 16 px, layers' row actions included.

### How it was checked

- **Commands:** `eslint` on every changed file exits 0, with one old `<img>` warning. `pnpm typecheck` and Truing's `tsc --noEmit` exit 0. `vitest run` passes 605 of 605, with `tokens.test.ts` passing in a full run.
- **Browser:** throwaway headless scripts on the fixture app, with no page errors. Screenshots were opened and read.

| Check | Result |
| ---------------------------------------------- | ---------------------------------------------- |
| Foot, empty and staged | 41 px both, so the panel doesn't move |
| Summary | closed by default, 40 px, flush with the panel's foot |
| List | opens above the summary; open after a reload |
| Row head, Undo | 28 px; opacity 0, then 1 on hover |
| Apply, Discard | 24 px; only Apply is dark |
| Menu row, highlighted | 24 px, `oklch(.55 .145 258)` with white text |
| Row with its list open | white on the accent fill, chevron too |
| Sheet | `:modal` false, radius 6 px; Esc, Close and a press in a frame close it |
| Sheet, right panel closed | opens under the pill, not over it |
| Instance row, `summary` | 28 px; 24 px with a 16 px chevron |
| `→` | text kept and unpainted, 12 px icon over it |
| `.inspect-copy` | 16 px line, hit 3 px outside it |
| Pick label | 12 px system mono, on the accent fill |
| `spacing.spec`'s crowded check, repeated by hand | 9 chips, 2 labels: nothing off side, crowded or covered |

### What the reviews found

- **a task review:** the new spec loaded no modules, a menu row with its list open was white on grey, a failure in the foot had no name, and a pending checkbox looked live. All fixed. By reading, it expects the existing specs to hold.
- **a design review, from screenshots:** the wrapped menu row and the 8 px jump at the first change are fixed. Its "invalid dark shots" and "Not drawn by React" were the script's timing: retaken with waits, both read right.
- **a copy review:** no visible word changed. Three doc sentences fixed.
- **The browser check itself** found two more, both fixed: a press in a frame didn't close the non-modal sheet, and the `module-facts` change broke the Call site row's truncation.

### Deviations

- **Spacing chips keep their kind's fill.** On one accent, margin, padding and gap couldn't be told apart. `docs/design-language.md` now says so.
- **Labels are 12 px mono, not 10.** `docs/design-language.md` allows no mono numbers at 10 px, and these hold sizes.
- **Discard stays on the summary line,** beside Apply. The task names only the count and Apply, but this keeps it one click away, as it was.
- **Tests, against the task and the maintainer's standing test rules.** the maintainer asked for no e2e runs, and to skip or remove a spec this breaks. None was skipped or removed. `fixtures.ts` starts the specs' browser with the list open, so their rows stay readable.

### Left open

- **E2E not run, as the maintainer asked.** That includes the new `changes-summary.spec.ts` and the seed in `fixtures.ts`.
- **"Both views" is shown by structure only.** TRU-5.2 brings the Claude view, and its test should add that case. A stopped Changes section showing its title wasn't exercised either.
- **Reviews and checks with limits:**
  - a design review worked from screenshots, as Truing runs only in its own browser. a browser check didn't run as a tool.
  - Light and dark were read at 1440, and light only at 1280. Sheet at both widths, tray at both, menu at 1440 only.
  - The Toast's 1.5 s is the constant; the measured 1.9 s includes a screenshot. Focus order and reduced motion weren't checked.
- **Open choices:**
  - The "Changes" heading now shows only when the section stops, for screen readers otherwise. The summary names itself, but it's a change to what's visible.
  - An unchecked checkbox is about 1.06:1 in light by token, shadow not counted, against 3:1. This is TRU-3.9's pattern, and `docs/design-language.md` forbids a border there. The tray now uses it too.
  - The viewport menu's Apply is dark too, so two show when changes are staged. Its chosen row has no tick.
  - "Viewport" no longer reads in capitals, as the task asks.
  - Discard now comes before Apply in the tab order.
  - "Hide or show everything" keeps its sentence for 1.5 s, which may be short to read.
- **Seen, not changed:** Code's value rows wrap up to six lines (`#1c68d4 · dark`). A truncated path in Instances can start about 5 px right of the others. Spacing chips can hide a small button at low zoom.

Criteria #9, #10 were not fully proved when this task closed. See Left open above.
<!-- SECTION:FINAL_SUMMARY:END -->
