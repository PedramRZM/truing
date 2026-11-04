---
id: TRU-2.3
title: 'Inspector extras: keys, spacing overlays, copy actions, layers search, shortcuts and a Fill viewport'
status: Done
assignee: []
created_date: '2026-11-01 10:44'
updated_date: '2026-11-01 11:51'
labels:
  - inspector
dependencies:
  - TRU-2.1
type: feature
ordinal: 20030
parent_task_id: TRU-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After using TRU-2.1's select and inspect, the maintainer asked for what Airship, Onlook and Cortex do beyond it (2026-11-01). The maintainer picked four bundles and a Fill viewport from the sweep of their code. Everything here is read-only: it helps a designer read the page, and edits nothing.

The sweep is summarised below. File references are under the package. Airship and Cortex are MIT, Onlook Apache-2.0. We take the ideas, not the code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **A · Keys and labels.** The hover and pick labels show the size (`button · Button · 120×36`); With a pick: Enter selects the first child, Shift+Enter the parent, Tab and Shift+Tab the next and previous sibling. The tree and the inspector follow; Hover waits about 50 ms before climbing to an ancestor, so jitter doesn't flash parents; A path inside an `<svg>` resolves to the `<svg>`; Esc closes one layer per press: an open menu or the search first, then the pick; No single-letter key fires while focus is in a field, the app's or Truing's.
- [x] #2 **B · Spacing overlays.** The picked element shows its padding and margin as hatched bands, with px labels per side, and `auto` where the margin is auto; Holding Alt while hovering another element draws the distance between the two boxes on each axis. When one box contains the other, it draws the four insets.
- [x] #3 **C · Copy and context menu.** Right-clicking in a frame (Select mode) or on a tree row opens a menu: Open call site, Open definition, Copy path, Copy classes, Copy selector. Items that don't apply are disabled. The menu shows each item's shortcut, if it has one; Clicking a style row's token or value copies it; Each copy is confirmed by a short status message that's announced to screen readers.
- [x] #4 **D · Layers search and help.** A filter above the tree keeps each match's ancestors. ↑/↓ moves through the matches, Enter picks one, Esc clears the filter. No match says so; Rows get an icon for their kind (component, server component, text, image, link, button, other element). Text rows are named by their content, truncated; `?` opens a sheet listing every shortcut. Toolbar buttons show their shortcut in their tooltip, written ⌘ and ⇧ on a Mac and Ctrl elsewhere. The sheet, the tooltips and the key handlers come from one list of commands, so they can't disagree.
- [x] #5 **Fill viewport.** A "Fill" choice in the viewport menu shows one frame filling the canvas at the canvas's own size, without device chrome. The docks and the toolbar stay; The frame resizes with the window. Choosing a device brings the canvas back; This is what TRU-16.12 decides on: whether true inline is still needed after it.
- [x] #6 **Tests.** Unit tests for the command list, the measuring geometry and the tree filter; Playwright on the fixture app for: the keys, a context-menu copy, the filter, the `?` sheet and Fill; The a real app spec still passes.
- [x] #7 **UI checked.** a browser check screenshots of the overlays, the menu and the sheet; Then a design review and a copy review on the new strings; Existing strings stay as they are.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Everything stays inside the repo.

### The one list of commands

1. `src/commands.ts`, imported by the runtime and the shell: every core command (V, I, H, zoom, fit, docks, `?`, Esc) with its title, hint, group and key chords, a matcher (`commandForKey`) and a formatter (⌘ ⇧ on a Mac, Ctrl+ Shift+ elsewhere, plus the `aria-keyshortcuts` form). `runtime/keys.ts`'s `modeForKey` and `canvasShortcutForKey` are rebuilt on it, so the frames, the shell, the toolbar tooltips and the `?` sheet read the same entries. Chords without a modifier never fire in a field (the app's or Truing's).
2. A module declares its own commands in `module.ts` (`commands: { id: { title, keys, menu? } }`), and `panel.tsx` handles them (`definePanel(module, sections, { commands })`, each `{ run(props), enabled?(props) }`, typed from the declaration). The shell merges them into the list. Take the module out and its keys, menu items and sheet rows go with it. TRU-16.11's palette reads the same list. `docs/modules.md` gets a section.
3. Layered Esc in the shell: an open popover or dialog (menu, `?` sheet, viewport menu) closes first, the layers filter clears while focused, then the pick.

### A · Keys and labels (selection probe and overlay)

4. Hover and pick labels: `tag · Component · W×H`. The server already names the hover's component; it now names the pick's too, from the `selected` report, through the same `label` command.
5. Hover climbs to an ancestor only after 50 ms (a small hover-intent timer); moving down or across is immediate. A target inside an `<svg>` resolves to the `<svg>`.
6. Selection commands Enter / ⇧Enter / Tab / ⇧Tab: a probe command `navigate` moves the pick to the first child, parent, next or previous sibling element (skipping script, style and boxless elements). The shell's canvas takes focus when a frame is clicked in Select mode, so Enter and Tab go to the pick, not to the last toolbar button. With a pick, Tab cycles picks until Esc clears it.

### B · Spacing overlays

7. `src/modules/selection/measure.ts`, pure geometry: the picked element's padding and margin bands with a label per side (`auto` from `computedStyleMap()`, which keeps `auto` where `getComputedStyle` gives pixels), and the Alt-hover measurement: the gap on each axis between two boxes, or the four insets when one contains the other. The overlay draws them hatched in its shadow root.

### C · Copy and the context menu

8. Right-click in a frame in Select mode: the probe picks the element (new `ctx.onContextMenu`), the runtime tells the shell where (new `context-menu` message), and the shell opens one menu built from the module commands marked `menu`: Open call site, Open definition, Copy path, Copy classes, Copy selector, each with its shortcut, disabled when it doesn't apply. A tree row's right-click opens the same menu (`openMenu` in the panel props).
9. Copy selector needs a selector: the probe computes a unique one on each pick (added to the `selected` report).
10. A style row's class, tokens and value are buttons that copy themselves. Every new copy is confirmed by one shell status line (`role="status"`, `notify` in the panel props). The existing Copy button keeps its own "Copied".

### D · Layers search and help

11. A filter field above the tree: matches by tag, component name or text, keeps the ancestors open, ↑/↓ through the matches, Enter picks, Esc clears, and says when nothing matches. Pure `filterLayers()` in `layers-filter.ts`.
12. Row icons by kind (component, Server Component, text, image, link, button, other element); text rows named by their content, truncated (the probe sends `text` for elements that hold only text).
13. `?` opens a `<dialog>` listing every command by group. Toolbar tooltips and `aria-keyshortcuts` come from the list.

### Fill viewport

14. A Fill row in the viewport menu: one frame at the canvas's own size, camera fixed at 100% and the origin, no label, grips or border (the frame's status stays for screen readers). The canvas's ResizeObserver resizes it; choosing a device or Side by side brings the canvas back.

### Proving it

- Unit (vitest): the command list (matching, field guard, no two commands on one chord, formatting per platform), the measuring geometry, the tree filter, the hover-intent timer.
- Playwright on the fixture app's `/inspect` (an `<svg>` and a box with padding and `margin: auto` added to it): the keys, labels with sizes, the spacing bands, a context-menu copy, the filter, the `?` sheet and Fill. `real-app.spec.ts` run unchanged.
- A browser check screenshots of the overlays, the menu and the sheet; then a design review and a copy review; then a task review on the diff.

Decisions on the plan (2026-11-01): modules declare their own commands (the contract grows as above); the menu keys are O, ⇧O and C; Fill takes the whole canvas, docks and bar floating over the app; off a Mac, keys are written Ctrl+ and Shift+ (so Linux reads "Zoom to fit (Shift+1)").
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
- the features;
- the hit-test fix the maintainer asked for mid-task;
- unit tests and docs/modules.md;
- keys drawn in the UI font;
- the reviewers' findings;
- docs only, the new tasks below.

### What changed

- **One list of commands** (`src/commands.ts`). Each core command has its title, hint, group and key chords, plus a matcher, a formatter (⌘ ⇧ on a Mac, Ctrl+ Shift+ elsewhere) and the `aria-keyshortcuts` form. Every place that shows or handles a key reads this list:

  - the runtime (V, I, H and zoom from inside a frame);
  - the shell's key handler (`src/shell/index.tsx`, `src/shell/commands.ts`);
  - the toolbar's tooltips and `aria-keyshortcuts`;
  - the `?` sheet;
  - the context menu.

  A key without a modifier never fires in a field. Enter, Tab and Space never fire on a focused control. `runtime/keys.ts` is gone.

- **Contract** (`src/module.ts`, docs/modules.md):
  - `actions` in `module.ts`, run by `definePanel(module, sections, { actions })`;
  - `ctx.onContextMenu`;
  - `openMenu` and `notify` in the panel's props;
  - a new `context-menu` message;
  - the loader checks `actions` and requires a panel to run them.
- **A · Keys and labels:**
  - The hover and pick labels show `tag · Component · W×H`. The server names the pick's component as it does the hover's.
  - Enter, ⇧Enter, Tab and ⇧Tab move the pick through a `navigate` probe command. A click in a frame in Select mode focuses the canvas, so these keys go to the pick and not to the last toolbar button.
  - The hover waits 50 ms before climbing to an ancestor (`hover-intent.ts`).
  - `<svg>` parts resolve to the `<svg>`.
  - Esc closes one layer per press.
- **B · Spacing:** `measure.ts` holds the geometry for the padding and margin bands (`auto` comes from `computedStyleMap()`) and for Alt-hover's gaps and insets. The overlay hatches the bands and draws the lines.
- **C · Copy:**
  - Right-click in a frame or on a tree row opens a manual popover listing the module's `menu` actions, with each key shown and inapplicable items disabled.
  - The class, the tokens and the value in a style row each copy themselves.
  - Copies are confirmed by one `role="status"` line. A failure stays on screen until the next notice and says what to do.
  - `selector` was added to the `selected` report.
- **D · Layers:**
  - A filter field: ↑/↓ moves through the matches, Enter picks, Esc clears, and "No layers match". The count sits inside the field.
  - Rows carry icons by kind. Text rows are named by their text (a `text` field on the layer nodes).
- **Fill:** `{ kind: 'fill' }` shows one frame at the canvas's size, with the camera fixed at 100% and no label, grips or border. The frame's status stays available to screen readers.
- **The hit-test fix** (2026-11-01). On a real page, the logo, the tagline, the disclaimer and a heading lie under `AppLayout`'s background `<img>` (`z-[1]`). The submit Button is disabled with shadcn's `pointer-events-none`. So every pick went to the picture or to the row around the button. `elementAt` in `probe.ts` now does its own hit test:
  - a picture, an `<svg>` or an empty box that covers what lies under it passes the pick through;
  - the pick goes down to a child the browser skipped for `pointer-events: none`, but not into a control's icon (Enter goes there).

### Deviations from the plan

- **`actions`, not `commands`.** `probe.commands` already names the probe's calls, so the module's list commands are `actions`.
- **The context menu is a manual popover.** On Linux the right button's release came after the menu opened, and an `auto` popover read it as a click outside. Esc and outside clicks are handled by the shell instead.
- **Out of scope, asked for mid-task:** the hit-test fix above, and the tasks TRU-2.4, TRU-2.5, TRU-14.1, TRU-14.2, TRU-14.4 and TRU-14.5 (see below).

### How it was verified

- **Unit:** `pnpm exec vitest run` passes 159 tests. The new ones are `commands.test.ts`, `measure.test.ts`, `layers-filter.test.ts` and `hover-intent.test.ts`. They cover:
  - matching, the field and control guards, and no chord bound twice;
  - formatting per platform, and the toolbar's old tooltip strings coming out of the list.
- **Fixture:** `test/e2e/inspect-extras.spec.ts` passes 9 tests. They cover:

  - the hit-test cases, including a small logo over its card's gradient;
  - sizes in the labels, and `<svg>`;
  - the keys, Esc's layers and the field guard;
  - the bands with `auto`, and the Alt insets;
  - the menu from a frame and from a row, Copy selector resolving to the element, Copy classes disabled when there are none, and a token copy;
  - the filter;
  - the `?` sheet and the tooltips;
  - Fill, including a window resize.

  Every fixture spec passes together (`app-checks`, `inspect`, `inspect-extras`, `modules`, `shell`: 42 tests). One existing assertion changed on purpose: the `<li>` row now reads `Beta`, as D asks. The hit-test test failed against the old probe (it picked `<img>`, not `<p>`) and passes with the fix.

- **A real app:** `real-app.spec.ts` could not run, because Next 16 allows one `next dev` per folder and another server held it. Instead, a throwaway headless Truing attached to the running server and picked on a real page: logo `<svg>`, tagline `<p>`, disclaimer `<p>`, a heading `<h6>`, submit `<button>`.
- **UI:** screenshots at 1440 × 900 of the bands, the Alt measurement (at 100% zoom), the menu, the filter, the notice and the sheet. There is no horizontal overflow, and the sheet doesn't scroll at 900 px. No 412 px shots: Truing is a desktop tool.

### What the reviewers flagged

- **a task review:**
  - the hit test skipped any image over a non-ancestor (fixed: only a covering layer is skipped);
  - the menu could run off the bottom (fixed);
  - the `actions` rename wasn't recorded (recorded above);
  - the menu can act on the previous pick if an item is clicked before the new pick's report arrives (left as is: well under a second).
- **a design review:**
  - fixed: the menu's vertical placement, focus return and Tab, the copy failure's way forward, the filter jumping as you type, `aria-controls`, the double focus ring, the sheet's scroll, chip corners;
  - left for you: copy targets are 19 px tall where Truing's controls are 24 px.
- **a copy review:** fixed the failure messages per copy, "selection" for "pick" in the Esc row, "Hold … and …" for gestures, and "Zoom at the pointer".

### Left open

- Run `pnpm exec playwright test test/e2e/real-app.spec.ts` with your dev server stopped.
- Taste:
  - how loud the full-width hatched `auto` bands look;
  - the keys in the UI font;
  - the 19 px copy targets.
- Words:
  - "Fill" may read as a paint colour to designers ("Canvas"?);
  - "Docks" is the sheet's heading, a word used nowhere else in the UI;
  - copying a path now shows both the inline "Copied" and the new notice.
- At 40% zoom the band and hover labels are too small to read. Drawing them at screen size went into TRU-2.5.
- Clicking a full-window empty overlay, such as a Radix dialog's backdrop, now picks what is under it. It's the same rule as the background picture, and the layers tree still reaches the backdrop.

### Decisions

- **Fill** keeps its name.
- **The `?` sheet's group** for the dock toggles is "Panels", not "Docks".
- **Copy targets** in the inspector stay 19 px tall, as inline text in dense rows.
- **`real-app.spec.ts`** ran with the dev server stopped: 6 passed (sign-in redirect, `/sw.js`, the three breakpoints, the Turbopack pick). Truing was started again afterwards.
<!-- SECTION:FINAL_SUMMARY:END -->
