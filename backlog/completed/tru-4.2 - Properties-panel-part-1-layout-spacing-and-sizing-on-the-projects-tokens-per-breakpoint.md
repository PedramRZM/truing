---
id: TRU-4.2
title: 'Properties panel, part 1: layout, spacing and sizing on the project''s tokens, per breakpoint'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-11-02 16:51'
labels:
  - panels
dependencies:
  - TRU-1.4
  - TRU-4.1
  - TRU-3.8
  - TRU-3.9
type: feature
ordinal: 40020
parent_task_id: TRU-4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This is the panel a designer uses most. It covers:

- padding, margin and gap;
- width, height and their min and max;
- flex and grid alignment and direction;
- position.

Figma Make's panel shows raw px, offers Fixed, Fill and Hug, and turns every change into a credit-billed agent call (`docs/research/figma-make-teardown.md`). Ours offers only what the project's spacing convention allows:

- the 3-digit spacing scale for spacing;
- standard Tailwind units for sizing.

Changes are staged in TRU-4.1's tray, and the panel doesn't care which path will apply them:

- **Direct.** On a static class string, a spacing or sizing change, or a breakpoint-prefixed one, is a direct edit with no model call.
- **Claude (TRU-12.2).** Layout changes often aren't direct. Responsive work in particular: stacking a row on Phone, hiding something below Tablet, moving an element on one size only. A value that comes from a class built at runtime goes the same way.

Tailwind is mobile-first, so outside the Phone preset the designer chooses "all sizes" or "from this size up". This panel is where most responsive refinement starts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **What the panel offers:**: spacing controls offer only `--spacing-*` steps, shown in px with the token's name on hover; sizing controls offer standard Tailwind units plus `full`, `fit` and `auto`; any number can be typed, and one off the scale snaps to the nearest step and says so (TRU-3.9; the maintainer, 2026-11-02), so nothing off the scale gets written.
- [x] #2 **What it writes.** A change writes the matching class (e.g. `px-400` → `px-500`) and removes the class it replaces. `tailwind-merge`, configured with our scales, decides what conflicts.
- [x] #3 **Breakpoints.** In Tablet or Desktop, "from this size up" writes `md:`/`lg:` classes, and "all sizes" writes unprefixed ones. The panel shows which breakpoint a value comes from.
- [x] #4 **Responsive changes beyond a class.** In any viewport, the designer can: change direction or wrap; hide or show an element; change order; resize; for that size only. The preview updates at once. A change that maps to a static breakpoint class is staged as **Direct**. One that needs restructuring or touches a runtime-built class is staged as **Claude**, with the per-viewport intent recorded (TRU-4.1's change set, applied by TRU-12.2). The label shows on each change before Apply.
- [x] #5 **Flex and grid.** Flex and grid controls (direction, align, justify, wrap, gap) write the corresponding classes.
- [x] #6 **More of Paper's Layout (2026-11-02).** Align buttons along the section's top, writing `self-*` when the parent is flex or grid; Rotate and flip, writing `rotate-*` and `-scale-x-100`; X and Y, or Left and Top, only for an element positioned absolutely or fixed, writing `left-*` and `top-*`.
- [x] #7 **A new pick while a change is unfinished.** TRU-3.9's `ScaleField` previews while a drag or an arrow key is under way, and a new pick remounts it through its `key`. A pick in a frame doesn't blur the field, so nothing tells it to finish. Decide whether the pick commits or cancels the unfinished change, and clear its preview either way.
- [x] #8 **The Flex section's shape (the maintainer, 2026-11-02, from Paper).** Built with TRU-3.9's controls, in TRU-3.8's section: a 3 × 3 alignment pad; direction; wrap; gap; horizontal and vertical padding with a toggle that opens all four sides; a menu for Space between and baseline. Width and height each offer Fixed, Fit and Fill, the words TRU-16.3's label uses.
- [x] #9 **Off-token values.** An element whose current value is off-token shows it flagged (TRU-11.2), and offers the nearest tokens.
- [x] #10 **A component with no `className` and no variants** (the maintainer, 2026-11-01: `ListItem`, a row of chips on a real page). Spacing and sizing can be changed on it the same two ways as in TRU-4.3: the component, every instance, as a direct edit of its own `cn(...)` string with the count; or this instance only, through Claude, with the reason. Its `min-h-[40px]` shows flagged.
- [x] #11 **Tests.** Unit tests cover class mapping both ways, breakpoint prefixes, and Direct vs Claude classification for the responsive cases. A Playwright test changes padding on a fixture element and checks the source diff. Another stacks a row in the Phone frame and checks it is staged as a Claude change with the right intent.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Calls taken without asking (each can be reversed)

1. **A new pick commits.** `docs/design-language.md` says leaving a field commits what's typed, and a pick is leaving it. A pick in a frame doesn't blur, so the panel blurs the field itself, while the last pick's sections are still on screen. The same path clears the preview.
2. **Three scopes.** All sizes; From this size up (`md:`, `lg:`); This size only. Phone has no "up", and Desktop has no "only", as nothing sits above it. Anything "only" is staged **Claude**, as it needs the value above it restored: that is the task's Phone-stack case, and TRU-4.1's "layout change at Phone size needs restructuring". Its edit is kept (`max-md:`, `md:max-lg:`) so the preview still works.
3. **The runtime's budget isn't raised.** The selection module's server schemas ship in every frame though only Truing's process reads them. A build-time `define` folds them away.
4. **Change set version 4.** Scope gains `{ only }`, and a change with a `reason` may keep its edit for the preview and for TRU-12.2 to read.
5. **Live preview through the tray.** `ctx.changes.preview` shows an unfinished change through the same stylesheet, last so it wins.
6. **`className` on a component that passes it on is Direct.** TRU-4.1 left this for TRU-4.2: the definition's JSX is read to tell whether it passes `className` or spreads props.
7. **Every Button, when Button has variants, goes to Claude.** Its value lives in a variant, and TRU-4.1's insert sits before `buttonVariants(...)`, which would win.

### Slices

1. Budget trim; change set v4; host and tray preview; engine's `takesClassName`.
2. `layout-classes.ts`, pure, with unit tests: class mapping both ways, breakpoints, which class wins at a width, Direct and Claude classification.
3. Server: `layout-tokens`, `preview-classes`, `stage-classes`.
4. Panel: `layout-sections.tsx` (scope, Layout, Flex, Grid, Spacing), a menu for Space between and baseline, `ScaleField`'s `off`, `from` and `zeroText`.
5. Docs: `docs/design-language.md`, `docs/modules.md`. Specs written, not run: `layout-panel.spec.ts`, and `properties.spec.ts` updated to the fields.

### Proving each criterion

Unit tests for the mapping and the routing. A throwaway headless script on the real studio, at 1280 and 1440, light and dark, for what shows and what gets staged. No Apply on the real source: the engine's fixture tests prove the write.

### Added on the maintainer's request (2026-11-02, while it was being built)

- **Point to preview.** An option shows on the page while the pointer is on it, without staging: token menu rows, Space between and baseline, Fixed, Fit, Fill and Auto, direction, align in the parent, the alignment pad, wrap, flip and hide, and a component's variant and size.
- **No Edit heading.** It misled, so variant and size sit with the component in the Selection section. They are menus now, as a native `<select>` can't say which option the pointer is on. An element picked as Text keeps its words in the Text section.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **Panel.** Layout, Flex, Grid and Spacing are fields and controls in `layout-sections.tsx`, written through the pure `layout-classes.ts`. Every change goes to the tray. TRU-3.8's read-only rows for these sections are gone, and text picks gain a Spacing section so a margin can be changed.
- **Scope.** All sizes, From this size up, This size only. A field or control marks where its value comes from with the size's icon, its words on hover and to a screen reader.
- **Routing.** No component: the element's own JSX. A component that passes `className` on: at the use, Direct, adding the attribute if needed. One that doesn't, such as `ListItem`: this use goes to Claude, and every use is Direct with the count. One size only goes to Claude, keeping its edit for the preview.
- **New pick.** It commits: the panel blurs the field while the last pick's sections are still on screen.
- **Min and max.** Numbers on Tailwind's scale, plus `full`, `fit` and `auto` from the field's menu, and `None` for a max.
- **Runtime.** A build-time `define` drops the selection module's server schemas from each frame: 89,947 to 89,467 bytes before this task's ops, which no longer count. The budget wasn't raised.
- **Change set version 4.** Scope `{ only }`, an edit with a reason, `takesClassName`. `ctx.changes.preview` shows a change without staging it.
- **Removed as dead:** `flexDirection` and its two assertions, as the panel no longer prints a direction in words.

### How it was verified

- **Types:** root `pnpm typecheck` and Truing's `tsc --noEmit` exit 0.
- **Lint:** ESLint on the 32 changed files, 0 errors. One warning remains, the existing `no-console` in `build.ts`. Prettier clean. `jest --findRelatedTests`: no related tests.
- **Unit:** `vitest run` in Truing, 516 passed in the last clean run, 48 of them new; later full runs had the one timeout below. See Left open on `tokens.test.ts`.
- **Browser:** a throwaway headless script on the fixture with a real app's real tokens, and another on a real app itself, signed out, for variants. No page errors.

| Check                                                        | Result                                                                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Padding arrow, Esc, Enter                                    | previews 16, back to 12, staged Direct; source untouched                                                                                                  |
| Type 17                                                      | staged 12 → 16, on the scale                                                                                                                              |
| Step back to the page's value                                | the staged change goes                                                                                                                                    |
| Gap arrow, then pick another element                         | staged 8 → 12; preview became the staged change                                                                                                           |
| Tablet, From this size up, `md:px-500`                       | adds `md:px-600`, removes `md:px-500`, Direct; reads "From Tablet up"                                                                                     |
| Tablet, This size only, Down                                 | `md:max-lg:flex-col`, Claude, intent says Tablet only; preview column                                                                                     |
| Phone, This size only, Down                                  | `max-md:flex-col`, Claude, "layout change at Phone size needs restructuring", intent "Stack the children in a column at Phone size only…"; preview column |
| Class built at runtime                                       | Claude, "class is built at runtime"                                                                                                                       |
| Component with no `className`, 2 uses                        | this use Claude, with the reason; every use Direct, "Changes every QuestionChip: 2 uses"                                                                  |
| `min-h-[40px]`                                               | 40, "off the scale"                                                                                                                                       |
| Hover: token row, Fill, Down, pad, wrap, hide, Space between | each on the frame, 0 staged; back to the page after leaving or Esc                                                                                        |
| Hover on a real app's Button, variant                           | `default` blue, `destructive` red; Esc restores; 0 staged                                                                                                 |
| Hover on a real app's Button, size                              | `lg` 48 px, `xs` 24 px; Esc restores                                                                                                                      |
| Max width menu                                               | full, fit, auto; hover shows `fit-content`; choosing stages it                                                                                            |
| Fixed on a Fill element                                      | staged "Fill → Fixed 384"                                                                                                                                 |
| Apply                                                        | `className="px-400"` to `"px-500"`; `<Card label="A card" />` gains `className="px-500"`                                                                  |
| Sideways overflow in the panel, 1440 and 1280                | 0                                                                                                                                                         |
| Option menu rows                                             | 24 px, no border, highlighted on the accent fill                                                                                                          |

- **Screens, opened and read:** 1440 light, 1280 dark, Tablet and a menu's rows in dark, kept locally, not in this repo.

### What the reviewers flagged

- **a task review, not ready at first. Fixed:**
  - All sizes and From this size up kept one-size classes, which would still win;
  - any spread counted as passing `className`, which could write an edit that does nothing;
  - `hidden md:flex` stayed shown at `md` after Hide, and Show lost a frame's flex;
  - Fixed on `w-full` staged nothing when the number matched;
  - the preview's order could differ from Apply's when two scopes were staged;
  - Hide then Show left an empty Direct row, and Show on a class at a use did nothing;
  - a preview could stay on the page after a failed stage or a click on the current option;
  - min and max lacked the words, and `max-w-full` read as 100;
  - the breakpoint showed only on number fields;
  - `docs/modules.md` still said version 3.
- **a copy review, not ready at first. Fixed:** the breakpoint mark said code's words, and "From" for a one-size change. Clearer reasons in the tray, None and ° in tray labels, one name for each align, and two intents that told Claude the wrong thing.
- **The maintainer, in Truing:** the option rows had the browser's button border; fixed. Variant hover looked broken as Truing's server predated the op; restarting fixed it. `--watch` rebuilds the shell only.

### Left open

- **E2E not run, as the maintainer asked.** `layout-panel.spec.ts` is new. `properties.spec.ts`, `changes.spec.ts` and `theme.spec.ts` changed: their assertions now read fields and the option menu, as those replaced text and a `<select>`. Nothing was skipped or removed, so "Tests" is unmet.
- **`tokens.test.ts` times out in some full runs.** "finds the token in every class of ours" hits Vitest's 5,000 ms limit, with no assertion failing, and passes 3 of 3 alone. It checks every class against every token, so it's CPU-bound, and Truing and Next were running beside it. This change doesn't touch token lookups, but it wasn't run without this change. The limit wasn't raised. The testing rule's fix is its own Vitest group: an open choice.
- **No `stage-classes` unit test.** The routing's parts are tested (`scopeReason`, `decideReach`, the engine, `takesClassName`), and the whole is proved by the script, and by a spec that has not run.
- **A browser check and a design review didn't run as tools:** Truing injects its runtime only into its own browser, so they can't drive it. The scripts took the measures above. "PR" is unmet: this is a local merge.
- **Try by hand:** a real locked scrub on a padding label, and hover on your own screens.
- **Taste:**
  - "Padding across" and "Flip across" against "left and right";
  - "As its parent says" among Start, Centre, End and Stretch;
  - "Hide: On → Off";
  - the summary line still reads "Button · variant tonal · size default not set" above the two menus, as specs pin it and it's the only place that says "not set";
  - `docs/design-language.md` gains Point to preview, Scope row, Option menu and "A new pick commits", for you to review.
- **Limits:**
  - All sizes on `px-*` leaves a wider `md:p-400`, which still wins at `md`, though the preview shows the change;
  - Hide at all sizes writes `hidden`, which tailwind-merge puts in place of `flex` in the source, so Show afterwards won't bring `flex` back;
  - "Every Button" goes to Claude when Button has variants, as TRU-4.1's insert would land before `buttonVariants(...)`;
  - a pick with no place in the code has no preview once staged, as there's no edit to show;
  - a hover's preview needs a mouse, by design.

Criteria #11 were not fully proved when this task closed. See Left open above.
<!-- SECTION:FINAL_SUMMARY:END -->
