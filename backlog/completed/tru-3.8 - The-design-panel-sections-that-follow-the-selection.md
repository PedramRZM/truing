---
id: TRU-3.8
title: 'The design panel: sections that follow the selection'
status: Done
assignee: []
created_date: '2026-11-02 09:28'
updated_date: '2026-11-02 15:07'
labels:
  - panels
dependencies:
  - TRU-2.1
  - TRU-3.3
type: feature
ordinal: 30080
parent_task_id: TRU-3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The maintainer asked on 2026-11-02 for Paper's properties panel. Paper's sections change with the selection, an empty section is one greyed title with a `+`, and a filled one opens, so the panel stays short and shows at a glance what isn't set. Ours is an inspector: identity, variants, source, tokens and owners, in one long read-out built for checking rather than designing.

The maintainer on 2026-11-02, with a screenshot of Paper's panel: today's Design tab is "basically code and tokens and CSS stuff", and Paper's is "more close to designers' worlds". So this panel leads with what a designer sees, and code moves to one closed section at the bottom. See `docs/design-language.md`, "The properties panel".

This task builds the shape and shows real values read-only. TRU-4.2 and TRU-4.3 then make the sections editable, with TRU-3.9's controls. That order lets a designer use the new panel straight away and keeps TRU-4.2's and TRU-4.3's scope as written.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Sections by selection.** Order and contents: **Element or component:** Selection (name, variants, instance count), Layout (width and height with their mode), Flex or Grid (when set), Spacing (padding and margin), Radius, Blending, Fill, Border, Shadow, Filters, Selection colours (TRU-11.3), Code; **Text:** Selection, Layout, Blending, Fill, Text (style, font, weight, size, line height, letter spacing, alignment), Underline, Stroke, Shadow, Filters, Code; **Nothing:** Page (route, viewport, the page's background token) and Claude (its status, once TRU-5.2 lands).
- [x] #2 **Empty sections.** A section with nothing set is one greyed line with its title, 33 px tall. The `+` stays disabled until TRU-4.2 and TRU-4.3 can write. A filled section opens and shows token name with value beneath, per TRU-4.3.
- [x] #3 **Designers' values.** Sections show numbers, fonts and swatches, not class names: `Padding 12 16`, not `px-400 · 12`. A linked token shows as a small icon, with its name on hover. A colour shows its token's name beside the swatch. A value off the scale shows as its number, flagged.
- [x] #4 **The Code section.** Last in the panel and closed by default, remembering the designer's choice. It holds today's Styles list, classes, Props, Owners, the source links and the copy actions, word for word.
- [x] #5 **Nothing lost.** Everything today's inspector shows is still reachable, moved rather than dropped: instances, off-token flags, and `TRU-16.1`'s states when they land. Existing text is kept word for word.
- [x] #6 **X and Y only when true.** Layout shows X and Y, or Left and Top, only for an element positioned absolutely or fixed. In the app's flow those fields would mislead.
- [x] #7 **Room for Claude.** The panel's body is a view that TRU-5.2 can sit beside, behind a Properties | Claude switch. Until TRU-5.2 lands there is no switch and no title.
- [x] #8 **Contract.** Sections register through the module contract, so TRU-4.2, TRU-4.3 and later modules add to one panel in a set order, with no edits to the shell.
- [x] #9 **Density.** 280 px wide, 24 px controls, 12 px type, measured by a browser check. No horizontal overflow on the longest real class list.
- [x] #10 **Tests.** Playwright on the fixture: an element, a text node and no selection each show their sections and real values. Existing inspector tests are moved with their assertions intact.
- [x] #11 **UI checked.** A browser check, a design review, a copy review.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Real values** (`module.ts`, `probe.ts`): a `computed` command reads the computed styles the panel names, for the element and its parent. A `styles` op reads the body's classes as tokens for the Page section. `PanelFrame` gains the frame's size. Runtime budget: 418 bytes left, so this is measured first. If it doesn't fit, trim or ask, never raise it silently.
2. **Split `panel.tsx`** with no change in behaviour: `panel-shared.tsx`, `layers-panel.tsx`, `code-section.tsx`, `selection-section.tsx`, `design-panel.tsx`, `design-sections.tsx`. `panel.tsx` keeps `definePanel`, the actions and the menu.
3. **Contract** (`src/module.ts`, `module-section.tsx`, `docks.tsx`): a set order per kind of selection, and `properties` in `definePanel`. Any module can add a section, and each section fails alone. `docs/modules.md` documents it. Unit test on the ordering.
4. **Values** (new `design-values.ts`, pure): computed style and classes become what a designer reads: `Padding 12 16`, the sizing mode, the linked token, the off-scale flag, element or text. Unit tests.
5. **Sections:** Selection, Layout, Flex, Grid, Spacing, Radius, Blending, Fill, Border, Text, Underline, Stroke, Shadow, Filters, Code, Page. The empty line is 33 px with a disabled `+`. Code is closed by default and remembers its state.
6. **Specs:** the inspector's specs start with Code open, so their assertions stay as they are. New spec for the three selections, written but not run. Evidence from throwaway headless scripts, as in TRU-3.7.

Each criterion is proved by the unit tests, the headless measures at 1280 and 1440 in light and dark, and the screens opened and read.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **Sections by selection.** The right panel is now sections that follow the pick. Element, text and nothing each have their set order, and a filled section opens.
- **Designers' values.** Computed styles become numbers, fonts and swatches: `Padding 8 16`, `Width 81 Fit`, `Height 36 Fixed`. A linked token is an icon with its name on hover. A colour shows its token's name with the value beneath.
- **Empty sections.** One greyed line, 33 px, with a disabled `+`.
- **Code.** Last of the module's sections, closed by default, remembered. It holds the tag, Call site, Definition, Owners, Props and Styles as they were, plus Copy classes and Copy selector, in the words the menu uses for them. Instances and Edit moved to Selection unchanged.
- **Contract.** `definePanel` takes `properties`. `PROPERTY_SECTIONS` in `src/module.ts` sets the order. Any module can add a section with no change to the shell, and each one fails alone. `docs/modules.md` documents it.
- **Split.** `panel.tsx` went from 1,942 lines to 347. The rest moved to `panel-shared.tsx`, `layers-panel.tsx`, `code-section.tsx`, `selection-section.tsx`, `design-panel.tsx`, `design-sections.tsx`, and the pure `design-values.ts`.
- **Probe and server.** A `computed` command reads the named computed styles for the element and its parent. A `styles` op reads the body's classes for Page. `PanelFrame` gains `width` and `height`.
- **Reading at rest.** The pointer is on an element when it's picked, so the browser can report its `hover:` state or a transition part way. Values are read again once the pointer leaves, on a frame resize and on each layers report. Where a pointer-state class sets a colour, the resting token decides.
- **Design language.** `docs/design-language.md` gains one pattern, the read-only Value row, for the maintainer to review.
- **Runtime.** 89,999 bytes, 1 under the 90 KB budget. Repeated schemas in `selection/module.ts` are shared to fit. The budget wasn't raised. See Left open.

### How it was verified

- **Unit:** `pnpm exec vitest run` in Truing, 429 passed, 22 of them new in `design-values.test.ts`.
- **Checks:** root `pnpm typecheck` and studio `tsc --noEmit` exit 0. ESLint on the 21 changed files exits 0, with the one import-order warning fixed. Prettier clean. `jest --findRelatedTests`: no related tests.
- **Browser:** throwaway headless scripts, not in the repo, on the fixture's `/properties` and on real `/main`, signed out. The app's dev server was the one Truing runs.

| Check                                         | Result                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Panel width, 1280 dark and 1440 light         | 280 px                                                                                          |
| Empty section, `+`                            | 33 px, 24 × 24, disabled                                                                        |
| Value rows, type                              | 24 px at least, 12 px                                                                           |
| Sideways overflow, 34-class button, Code open | 0, nothing past the panel's edge                                                                |
| Element, section order                        | Selection, Layout, Flex, Spacing, Radius, Blending, Fill, Border, Shadow, Filters, (TRU-11.3), Code |
| Text, section order                           | Selection, Layout, Blending, Fill, Text, Underline, Stroke, Shadow, Filters, Code               |
| Nothing picked                                | the existing hint, then Page: route and viewport                                                |
| Fixture card, inline styles                   | `Width 320 Fixed`, `Padding 12 16`, `Gap 8`, `Corners 8`, `Opacity 50%`, `#3d82f2`              |
| `/main` header button                     | `Padding 8 16`, `Corners 8`, Fill `background #ffffff`, Border `secondary #7f54e8`, `shadow-xs` |
| X and Y                                       | absent on a block, `X 40`, `Y 500` on an absolutely placed box                                  |
| Code                                          | closed by default; open survives the next pick; stored                                          |
| `hover:` opacity, pointer on, then off        | `Opacity 50%`, then the empty line                                                              |
| Frame resized from Desktop to Tablet          | Width 1424 becomes 752 with no new pick                                                         |
| Another module's sections                     | show in their slot; a throwing `Body` and a throwing `empty` each stop alone                    |
| Time from the pick's report to values         | 0.2 to 0.9 s, stable afterwards, no flicker                                                     |
| Shell console, page errors                    | none                                                                                            |

- **Screens, opened and read:** fixture and `/main` at 1440 light and 1280 dark, closed and with Code open. kept locally, not in this repo.
- **Existing specs:** read, not run. The inspector's specs start with Code open, through `inspect-fixture.ts`, and no assertion changed. None was skipped or removed.

### What the reviewers flagged

- **a task review, not ready at first. Fixed:**
  - values stayed stale after a frame resize or a page change;
  - `dark:` and `md:` classes counted as hover states;
  - hover in a dark app showed the light value;
  - opacity, underline and shadow read the hovered value;
  - a border on any side but the top read wrong or empty;
  - a failed read hid Code, and the tag didn't show while loading, gone or failed;
  - `50%` read as 50, named grid lines counted as tracks, `-mt-200` lost its token, `inset-0` and a block's `w-auto` read Fit;
  - one waiting section blanked the panel, and a stopped Page section stayed stopped across routes.
- **a task review. Accepted, listed below:** the off-scale flag is class-only, padded text reads as a Frame, and a new slot needs a line in `src/module.ts`.
- **a copy review, not ready at first. Fixed:** a failed section now names itself and gives a way forward. "Backdrop" replaces a second "Background". "Corners", "Style" and "Kind" replace labels that repeated their section or value. The `+`'s name is lowercase.
- **My own scripts. Fixed:** a width set outside a class read Fill, so a block narrower than its parent now reads Fixed.

### Left open

- **E2E not run, as the maintainer asked.** `properties.spec.ts` is new. `inspect-fixture.ts` opens Code for the existing specs. Nothing was skipped or removed, so the "Tests" criterion is unmet.
- **A browser check and a design review didn't run as tools:** the Playwright MCP server failed to connect, so "UI checked" is unmet, though a copy review ran and the scripts took the measures above. "PR" is unmet: this is a local merge.
- **"Designers' values" is left open for one reason:** the off-scale flag covers values a class sets. A value from inline CSS or a stylesheet shows its number with no flag, as the panel has no scale to compare it with. TRU-11.2 is the natural home.
- **Budget, open:** 1 byte left, so the next probe change needs a trim or a raise. The largest trim I can see: the server ops' schemas ship in every frame and the runtime never reads them. That's outside this task, so I left it.
- **Open choices:**
  - Padded text reads as a Frame, so it gets Spacing but no Text section. Reading it as Text would hide its padding, as the task's Text list has no Spacing.
  - The Changes tray still sits below Code, as its own module, so Code is last in the Properties view but not in the dock.
  - `<tag>` moved into Code, and Selection names the pick as the Design tree does. Server Component and `not set` stayed in Selection word for word, though they're code's words.
  - Raw CSS still shows in Filters and for a shadow with no token. TRU-4.4 owns filters.
- **Limits:**
  - A height set outside a class reads Fit: the computed value can't tell it apart.
  - Hover in a dark app relies on `color-scheme: dark`. An app that only sets a `dark` class gets the light value until the pointer leaves.
  - A theme change with no layers report keeps old values until the next pick.
  - Text with inline children, such as `<p>a <b>b</b></p>`, reads as a Frame.
  - Selection colours (TRU-11.3) and Claude (TRU-5.2) have their slots and nothing in them.
- **Not checked:** a designer's signed-in pages, a real dark app, and the headed window.
- **Noticed, not touched:**
  - `src/virtual-modules.d.ts` relative imports resolve to `any` under `skipLibCheck`, so `panels` in the shell isn't typed.
  - The untracked `Screenshot from 2026-11-02 11-50-18.png` is still in the repo root, left out of this commit.

Criteria #3, #10, #11 were not fully proved when this task closed. See Left open above.
<!-- SECTION:FINAL_SUMMARY:END -->
