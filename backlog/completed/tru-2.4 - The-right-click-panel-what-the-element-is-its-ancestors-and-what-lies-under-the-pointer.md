---
id: TRU-2.4
title: 'The right-click panel: what the element is, its ancestors, and what lies under the pointer'
status: Done
assignee: []
created_date: '2026-11-01 11:30'
updated_date: '2026-11-01 14:19'
labels:
  - inspector
dependencies:
  - TRU-2.3
type: feature
ordinal: 20040
parent_task_id: TRU-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-2.3 gave a right-click a plain menu of the pick's actions. On 2026-11-01 the maintainer asked for a richer panel, as remembered from Airship, after the other tools. The sweep (`docs/research/menus-spacing-frames-takes.md`) found no richer panel in Airship's code. The ideas worth taking are Onlook's grouped menu and floating bar, react-grab's header, the ancestor lists of LocatorJS and nextjs-locator, and Figma's "Select layer". None of the tools lists what is stacked under the pointer. TRU-2.3's fix for a real page, where a background picture covered the logo, would have needed that list as a way out.

Everything here is read-only. "Ask Claude about this" is added to the panel by TRU-5.2, and the edit rows (Edit text, Duplicate, Delete, Wrap) by TRU-4.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **A header.** The panel opens with the element: `Component · tag` and its call site as `file:line`, which opens in the editor. When there is no call site, it says why, in the inspector's words.
- [x] #2 **Groups.** Rows sit in groups (Open, Copy, Select), separated, each row showing its key from TRU-2.3's list.
- [x] #3 **Select parent and the ancestors.** "Select parent" (⇧Enter), and a list of the components from the element up to the page; hovering a row outlines it in the frame, choosing it picks it.
- [x] #4 **What lies under the pointer.** From a right-click in a frame, "Select layer" lists every element stacked at that point, top first, the pick marked. Choosing one picks it, including a picture laid over content.
- [x] #5 **Placement.** It opens at the pointer, flips to stay in the window, and closes on Esc, a click outside or a choice. ↑/↓ and → / ← move through rows and lists.
- [x] #6 **Tests.** Playwright on the fixture: the header, Select parent, an ancestor, and Select layer picking the fixture's covering picture.
- [x] #7 **UI checked.** A browser check screenshots, then a design review and a copy review.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Everything stays inside the repo.

### The contract grows (Decisions)

1. `ActionSpec.menu` goes from `true` to a group name (`menu: 'open'`). The shell puts the rows in groups by that name, in the order they first appear, with a separator between groups. Selection's rows: Open (Open call site, Open definition), Copy (Copy path, Copy classes, Copy selector), Select (Select the parent, which is new to the menu, plus the two lists below). The titles stay as they are, since the `?` sheet shows the same ones.
2. `definePanel`'s third argument takes an optional `menu`, as data, so the shell still draws the menu, places it and handles its keys:
   - `header(props, target)` gives `{ title, place, open? }`: `Button · button`, then `file:line`, which opens in the editor, or the inspector's sentence for why there is no call site.
   - `lists`: rows that open a list at the end of a group. Each has `{ title, group, items(props, target), highlight?(…, item | null), choose(…, item) }`, and each item is `{ id, label, detail?, current? }`.
   - `target` is the menu being shown: `{ id, frame, point }`. `point` is the right-click in the frame's own pixels, or null when the menu was opened from a tree row. `items` and `header` can return promises: the same promise for the same `target`, as `enabled` already must.
3. The store keeps the frame point the runtime already sends (`context-menu`), next to the screen point.

### Selection's panel

4. **Header**: from the inspection the menu's rows already wait on (`inspectionOf`), so there is no new lookup. If the element has no component, it shows only the tag.
5. **Select component**: the project's components from the pick up to the page, nearest first, taken from the layers tree the Layers dock already has (`pathTo`). Next's own components and those in packages are left out, as they are there. Hovering a row calls `highlight`, and choosing one calls `select`, which picks the component's first element, as a tree row does.
6. **Select layer** (only after a right-click in a frame): a new probe command `layersAt({ x, y })` returns every element drawn at the point, top first. These are `elementsFromPoint`, plus the children the browser skips for `pointer-events: none` (the disabled Send button), with an `<svg>`'s paths counted as the `<svg>`, our overlay and `<html>` left out, and no duplicates. Each element comes with its id, tag and short text. The pick is marked (`menuitemradio`, `aria-checked`), and each row is named as in the tree (text, else `<tag>`), with its component beside it.

### The shell's menu

7. **Placement**: measured after it opens. It opens at the pointer, flips left or up when it would leave the window, then is clamped. The size limit is the window's height less a margin. A list opens beside its row, flips to the left when there is no room, and shifts up to fit. The rule is a pure `placeMenu()` with unit tests.
8. **Keys**: ↑/↓ move through the rows (and wrap), → or Enter opens a list and focuses its first item, ← or Esc closes the list and goes back to its row, and Esc with no list open closes the menu (as today). Hovering a list's row opens it. Inside the menu, Enter, Space and the arrows don't reach the shell's own keys (Enter would otherwise also run Select the first child). Closing on a click outside, a choice and Tab stays as it is.

### Proving it

- Unit (vitest): `placeMenu` (fits, flips right→left and down→up, clamps, list beside its row), and how the rows are grouped.
- Playwright in `inspect-extras.spec.ts` on the fixture's `/inspect`: the header shows `ClientPanel · li` (or the fixture's real name) and its `file:line`, and choosing it opens the editor (the editor log); Select the parent; a component from Select component; and Select layer at "Under the background" lists the covering picture first with the `<p>` marked, then choosing the picture picks `<img>`. Also ↑/↓/→/← and a flip near the window's bottom-right corner.
- A browser check screenshots of the menu and both lists at 1440 px (no 412 px shots: Truing is a desktop tool, as in TRU-2.3 and TRU-2.5), then a design review, a copy review and a task review.

Decisions on the plan (2026-11-01): a module adds to the menu as data and the shell draws it; the two lists are submenus (Select component ▸, Select layer ▸); the ancestors are the components the Layers dock shows, nearest first.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The right-click menu now opens with the pick's header (`Button · <button>` and its call site, which opens in the editor, or the inspector's sentence for why there is none). Its rows sit in three groups (Open, Copy, Select), each with its key. Select has Select the parent (⇧Enter), Select component ▸ and Select layer ▸. The menu opens at the pointer, flips to stay in the window, and is driven with ↑ ↓ → ←, Enter, Space and Esc.

### What changed

- **The contract** (`src/module.ts`, `docs/modules.md`): `ActionSpec.menu` names a group (`'open'`) instead of `true`. `definePanel` takes `menu: { header, lists }` as data, and the shell draws it. `MenuTarget` is `{ id, frame, point }`, with `point` null when a tree row opened the menu. The loader checks group names are kebab-case.
- **The shell:** a new `src/shell/context-menu.tsx` replaces the menu in `command-views.tsx`. It has the header, the groups with separators, and the lists as nested popovers beside their row. A list item is outlined in the frame while hovered or focused (cleared however the list closes), and picked when chosen. The checked item is a `menuitemradio`. While a list is open, the pointer must rest 150 ms on another row before that row replaces the list, so a diagonal move to the list doesn't swap it. Placement is the pure `src/shell/menu-layout.ts` (`groupRows`, `placeAtPoint`, `placeBeside`), measured after the menu opens and again as it grows (ResizeObserver). The store keeps the right-click's point in the frame.
- **Selection:** the actions are grouped and reordered as Open, Copy, Select, so the `?` sheet lists them in the same order. There are two new probe commands. `stackAt` returns every element drawn at the point, top first: the browser's stack, plus the children it skips for `pointer-events: none`, with an `<svg>`'s paths counted as the `<svg>`. `current` returns the picked element's id. `elementAt` and `stackAt` now share one walk. The panel builds the header from the inspection it already reads, Select component from the Layers tree's path (nearest first), and Select layer from `stackAt`, named as in the tree with the component beside each item.
- **The menu waits for its own pick.** The menu opens before the frame reports what the right-click picked, so it asks the frame (`current`) and waits for that report. It never shows the last pick's header or lists, even for a moment.
- **The runtime bundle** is 80,298 bytes; the base branch was 79,881, already within 119 bytes of the 80 KB budget. The maintainer raised the budget to 85 KB (`test/unit/bundles.test.ts`).

### Deviations from the plan

- The probe command is called `stackAt`, not `layersAt`, and the Playwright tests are a new `test/e2e/context-menu.spec.ts` rather than additions to `inspect-extras.spec.ts`.
- The menu takes focus itself as it opens, not its first row: the rows may still be loading, and the first row to take focus would depend on timing. ↓ goes to the first row and ↑ to the last.
- A list opened from the keys focuses its checked item, otherwise its first.

### How it was verified

- `pnpm typecheck`: clean. ESLint on every changed file: clean.
- `pnpm vitest run`: 185 passed, including six new `menu-layout` tests (the groups, the flips, the clamp, a list beside its row).
- `pnpm exec playwright test`: all specs passed, `context-menu.spec.ts` 9 of 9 (10 of 10 with the crossing test added after Decisions). It covers the header and the editor log, the absent call site, the group order and keys, Select the parent, Select component (hover outline and pick), Select layer (the covering `<img>` listed first, the `<p>` checked, the picture picked), the keys, the flip at the window's lower right corner, Space on a row, and the stale pick. `real-app.spec.ts` passed 6 of 6 with the maintainer's studio stopped (it fails with `fetch failed` while another studio holds ports 4100 and 3000), and it wasn't re-run after the review fixes.
- The Space and stale-pick tests were each run with their fix taken out, and failed. The stale-pick test delays the frame's report on the shell's WebSocket by 1.5 s.
- UI: screenshots at 1440 × 900 in `/tmp/spike/` (not committed): the menu on a Button, Select component open, Select layer opened from the keys, and a header with no call site. The menu is 240 px wide with 28 px rows, with no horizontal overflow and no scroll at 900 px. No 412 px shots: Truing is a desktop tool.

### What the reviewers flagged

- **copy-reviewer:** the header path didn't say it was the call site. It now reads "Open call site … in your editor", with the module saying what the place is (`what`). The header now writes tags as `<tag>`, like the lists and the inspector. Fixed.
- **design-reviewer:** the focus ring went around the whole menu box (fixed: `.context-menu:focus-visible` has no outline, and the rows keep the ring). A diagonal move could swap the open list (fixed with the 150 ms rest). A long title could scroll sideways (fixed: it wraps). The checked item was marked with `aria-current` (fixed: `menuitemradio`). The chevrons now share the keys' grey. Left as is: the 12 px check column is a raw size, like Truing's other icon sizes.
- **task-reviewer:** the menu could show the last pick (fixed, with a test). Space on a row didn't press it, because the canvas took it for panning (fixed, with a test). Select layer's component names didn't update when the layers tree arrived later (fixed: the answers are kept per pick and per tree). The `module.ts` comment on empty lists was wrong (fixed). The maximum height is now the window's height less 16 px (fixed). Not changed: the ref callbacks re-attach their observers on each render, as TRU-2.3's did.

### Left open

- **Header weight:** the header's title is 12 px at weight 500, the same size as the rows. A long call site wraps over up to three lines of mono text.
- **Wording:** the new rows are "Select component" and "Select layer" (Figma's words), beside the existing "Select the parent".
- **Name order:** the canvas label reads `button · Button` and the header `Button · <button>`.

### Decisions

- **The runtime budget** goes to 85 KB: more probe features are coming.
- **The header** stays as it is: a 12 px title and the full call site, matching the Design panel.
- **The list rows** keep Figma's words: Select component, Select layer.
- **The name order** stays as it is: `Component · <tag>` in the header, `tag · Component` on the canvas.
- **The crossing test** is added: Select component's list stays open while the pointer cuts across Select layer on its way to the list's second item, and resting on Select layer opens its list instead. With the 150 ms rest taken out, the test fails.
<!-- SECTION:FINAL_SUMMARY:END -->
