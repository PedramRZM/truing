---
id: TRU-3.3
title: 'Panels that stay open beside the canvas'
status: Done
assignee: []
created_date: '2026-11-02 09:28'
updated_date: '2026-11-02 12:15'
labels:
  - panels
dependencies:
  - TRU-3.1
  - TRU-3.2
type: feature
ordinal: 30030
parent_task_id: TRU-3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The maintainer asked on 2026-11-02 for panels on the left and right that are always open, as in Paper. Today's docks float over the canvas, start closed, and at 340 and 360 px cover 700 of a 1440 px window. A designer opens them and loses the page, or closes them and loses the tools.

This reverses a choice TRU-1.5 made (Airship's "start as pills, open over the canvas, never resizing it"). ADR 0001 doesn't bind it: the ADR speaks only of panel sections in a shell, so no new ADR is needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Beside, not over.** Left panel 240 px, right panel 280 px, full height, separated from the canvas by a 1 px line. The canvas takes what's left, and Zoom to fit fits within it.
- [x] #2 **Open by default.** Both are open on first run. A designer's choice persists across restarts, like the frames' other settings in the store.
- [x] #3 **Collapse.** A toggle in each panel's header collapses it to a small floating pill holding its name and the toggle, and the canvas grows to fill the room. The existing `toggle-layers` and `toggle-design` keys do this.
- [x] #4 **Hide the UI.** `.` hides all the chrome, and again brings it back. `Shift+.` collapses or expands both panels. Both are in TRU-2.3's command list, so the sheet and tooltips show them. Neither reaches the app.
- [x] #5 **Everything still fits.** The inspector, the instances list, the Changes tray and the context menu are all usable at 240 and 280 px. Nothing overflows sideways: long paths truncate with the full text on hover. Measured by a browser check.
- [x] #6 **Small windows.** At a 1280 px window the canvas is still at least 700 px wide. Below that, the right panel collapses first.
- [x] #7 **Module contract.** Sections need no change for this; `docs/modules.md` is updated where it describes docks.
- [x] #8 **Tests.** Playwright: the canvas's width changes as each panel collapses and opens, the state survives a reload, `.` and `Shift+.` work with focus in a frame. Existing dock tests are updated for the new default rather than removed.
- [x] #9 **UI checked.** A browser check at 1280 and 1440, then a design review.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `src/shell/panels.ts`: the widths, which panels fit a window (the right gives way first), and reading and saving the choice.
2. `store.ts`: the camera works from the canvas's own edge, so the context menu and wheel zoom add the panel's width back. `safeRect` loses the docks. A placed camera moves against the panel, so the canvas's content stays still on screen.
3. `commands.ts`, `protocol.ts`: `.` and `Shift+.` in the list, and forwarded from frames.
4. `styles.css`, `docks.tsx`, `app.tsx`: panels beside the canvas, pills when closed, the bar and notice centred on the canvas.
5. Fit at 240 and 280 px, measured with every section open.

The maintainer's additions on starting: no e2e runs and no new e2e tests, with the suite's failures to be skipped or removed; and fix the layers tree's scrolling on deep pages (their screenshot, 2026-11-02).
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **Panels.** 240 and 280 px, full height, a 1 px line beside the canvas, open by default. Closed, a pill floats over the canvas. Toggles sit in each header, and their tooltips list `.` and `Shift+.`.
- **The choice persists** in `localStorage`, in Truing's own browser profile. The criterion says "like the frames' other settings in the store", but nothing else in the store persists yet, so this is the first.
- **Small windows.** Both panels fit down to 1220 px, where the canvas is 700 px. Below that the right gives way, and below 940 px the left. They return as the window grows. A panel opened by hand stays open until the window crosses one of those sizes.
- **The layers tree never scrolls sideways.** Rows indent by level instead of nesting padding (`layer-indent.ts`). An only child steps in a quarter step and a row among siblings a full 12 px. The step shrinks so the deepest row showing keeps 120 px for its name. `docs/design-language.md` records it as the Tree pattern.
- **Long paths** lose their start, not the file and line, with the full path on hover: Instances, the inspector's Call site and Definition, Owners, the Changes tray.
- **The runtime's budget held.** The new commands took it about 240 bytes over 85 KB. Rather than raise the budget, the frame commands' keys became constants, so the bundler drops `CORE_COMMANDS`' words from the runtime.

### How it was verified

- **Unit:** `pnpm exec vitest run`, 362 passed, with new `panels.test.ts` and `layer-indent.test.ts` and new cases in `commands.test.ts`. One existing case gained the two new forwarded commands.
- **Checks:** `pnpm typecheck` and Truing's `tsc --noEmit` clean, ESLint clean, Prettier clean. 
- **Browser:** throwaway headless scripts, not in the repo, on a real app signed out and on the fixture:

| Check                                                  | Result                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Canvas at 1440 and 1280                                | 920 and 760 px, starting at x 240                                                        |
| Frame after Zoom to fit, 1440                          | x 304 to 1096, inside the canvas                                                         |
| Fill at 1440                                           | iframe 920 × 900, the canvas's size                                                      |
| Window 1200, then 900, then 1440                       | right closed, both closed, both back                                                     |
| Close Layers at 1200                                   | Design returns, as it fits again                                                         |
| `.` and `Shift+.` with focus in a frame                | both work; the notice shows and then clears                                              |
| Reload, and a real stop and start on one profile       | the choice is kept                                                                       |
| Right-click at (700, 450) with Layers open             | menu at (699, 449)                                                                       |
| Ctrl+wheel at (280, 120)                               | the frame's share under the pointer unchanged                                            |
| Toggling a panel with a placed camera                  | frame unmoved on screen                                                                  |
| Deep tree, every row open on `/main`                | 485 rows, level 25: narrowest name 120 px, left body scrollWidth = clientWidth           |
| Right panel at 1280, every section open                | scrollWidth 279 = clientWidth 279; 0 elements past the edge; 436 paths, all with a title |
| Changes tray with a staged change on the fixture, 1280 | no overflow; Discard left the fixture's file unchanged                                   |

- **Screens, opened and read:** 1280 and 1440 light, 1440 dark by emulation, collapsed, hidden, the tray. The only console errors were the app's own 401s, signed out.

### What the reviewers flagged

- **a task review.** Fixed: the Fill spec's stale 1100 px, tray and inspector paths wrapping rather than truncating, Design left closed after closing Layers at 1200, `Shift+.` doing nothing below 940 px, the hide notice lingering after other keys brought the panels back, and a loose `Select` match in `real-app.spec.ts`. Left: the spec risks and the held key below.
- **a copy review.** Fixed: a bare `.` in the notice reads as stray punctuation and may be skipped by screen readers, so it names the period key.

### Left open

- **E2E not run and none added, as the maintainer asked.** Specs got the setup clicks on Open Layers and Open Design removed, the corner test reopens the panels it closes, and the Fill and `Select` fixes above. These edits have never run. So the "Tests" criterion is unmet, and "UI checked" and "PR" too (below).
- **Specs likely to need attention on the next run**, from reading them: `spacing.spec.ts:214` (the fitted zoom rose, so its chips may no longer crowd) and `context-menu.spec.ts:221` (the refit now waits for the canvas's new size, so an early zoom could stop it). The maintainer's instruction is to skip or remove what fails.
- **a design review and a browser check didn't run** as tools: the Playwright MCP server timed out on connecting. The scripts above took their measurements. The maintainer is testing by hand.
- **Taste:** rows shift slightly when expanding changes the deepest row, as the step rescales. On very deep pages levels differ by a few pixels. Truncated paths start about 5 px right of full ones in "On this page". `…s/ui/button.tsx:70` hides which folder a path is in until hover.
- **Names keep 120 px including the icon,** so about 96 px of text, and less beside a `Server` badge.
- **Noticed, not touched:**
  - A held `.` repeats into the app and its keyup always reaches it, the same as V and I today, because chords don't repeat and the runtime handles only keydown.
  - Closing a panel unmounts its body, so the layers filter and expanded rows reset. `.` keeps them.
- **For TRU-3.5:** the bar only just fits at 1280 (744 of 760 px), so the route box shrinks there.
- **Not checked:** a real dark desktop in the headed window, and a designer's own signed-in pages.

Criteria #8, #9 were not fully proved when this task closed. See Left open above.
<!-- SECTION:FINAL_SUMMARY:END -->
