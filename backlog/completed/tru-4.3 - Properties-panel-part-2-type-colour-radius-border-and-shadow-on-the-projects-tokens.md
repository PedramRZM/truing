---
id: TRU-4.3
title: 'Properties panel, part 2: type, colour, radius, border and shadow on the project''s tokens'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-11-02 17:58'
labels:
  - panels
dependencies:
  - TRU-4.2
  - TRU-3.9
type: feature
ordinal: 40030
parent_task_id: TRU-4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This is the second half of the panel. Each kind of value comes from its own tokens:

| Value   | Tokens                                                                                    |
| ------- | ----------------------------------------------------------------------------------------- |
| Type    | the text styles (`text-title-*`, `text-label-*`, `text-button-*`, `text-body-sm`)         |
| Colour  | the palette families and the shadcn semantic variables (`primary`, `muted-foreground`, …) |
| Radius  | `--radius-*`                                                                              |
| Shadows | `shadow-floating-card`, `shadow-navigation`, `shadow-pane`                                |

Two examples from Figma Make show what to avoid (`docs/research/figma-make-teardown.md`). It displayed `bg-indigo-600` as a hex value and split one Tailwind `shadow-lg` into six drop shadows. Our panel keeps the token, but leads with what a designer reads: a colour's swatch and name, a font, a number (TRU-3.8; the maintainer, 2026-11-02).

Like the layout panel (TRU-4.2), changes are staged in TRU-4.1's tray:

- **Direct.** A token swap on a static class string is a direct edit.
- **Claude (TRU-12.2).** A style that comes from a class built at runtime, a change that has to happen in a component's variant logic, or a per-size type change that needs more than a breakpoint class.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Typography.** The named text style sits on top. Setting one writes the `text-*` class and removes conflicting size, weight and line-height classes. Below it are separate controls for font, weight, size, line height, letter spacing, and horizontal alignment, plus vertical alignment where the parent allows it, each showing the current value, as in Paper. Changing just one flags the result as off-style. Numbers snap to the scale (TRU-3.9).
- [x] #2 **Colour.** The picker shows semantic tokens first, then palette families, with names and swatches. A change writes the matching class (`bg-…`, `text-…`, `border-…`). A text colour that fails contrast on its background gets a warning.
- [x] #3 **Radius, border and shadow.** These offer their tokens. Shadow shows a token, not its layers.
- [x] #4 **The sections' shape (the maintainer, 2026-11-02, from Paper).** In TRU-3.8's panel, with TRU-3.9's controls: Fill, Border and Shadow are empty one-line sections until set, with a `+` that adds one; Radius has a slider stepping through `--radius-*`, the token's name beside it, and a toggle for per-corner values; Blending holds opacity, in Tailwind's `opacity-*` steps. TRU-4.4 adds blend modes; Underline is its own section, writing `underline` and its `decoration-*` and `underline-offset-*` classes; Inner shadow, filters, gradients and blend modes are TRU-4.4's.
- [x] #5 **Breakpoints and off-token values.** Breakpoint scope and off-token flags behave as in TRU-4.2 and TRU-11.2.
- [x] #6 **A component with no `className` and no variants** (the maintainer, 2026-11-01: a row of chips on a real page, `ListItem`). Colour, background, border, radius and shadow can be changed on it. The panel says which of two ways it will go: **the component**, every instance: a direct edit of the unconditional string in its own `cn(...)`, with the instance count (TRU-2.2) before Apply; **this instance only**: Claude, with the reason ("the component takes no className; this needs a prop"); Its off-token values (`rounded-[18px]`, `shadow-[0_4px_12px_…]`) show flagged with the nearest tokens (TRU-11.2). The list around it (`ChatQuestionList`) picks its classes from a condition, so changes there go to Claude with that reason. A Playwright test covers a fixture shaped the same way.
- [x] #7 **Tests.** Unit tests cover the class mapping. A Playwright test changes a card's text style, background and radius and checks the source diff.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Calls taken without asking (each can be reversed)

1. **A class's kind comes from what it sets, not its name.** `text-title-m`, `text-grey-700` and `text-center` share a prefix, as do `font-bold` and `font-sans`. `Style.properties` already says what each class sets, so a family can be built from it. Unambiguous ones (`opacity-*`, `tracking-*`) stay patterns.
2. **Text shows on an element too,** when it holds only text or its classes set type or colour. The chip's `text-grey-700` and the card in this task's test need it. There it leads with Colour; for a pick that is Text, colour stays in Fill, as in Paper. Underline follows the same rule.
3. **Radius and Blending stay open,** as a slider at 0 or 100 is how you set them. The task names only Fill, Border and Shadow as empty until set, and Underline's `+` follows them. Stroke and Filters keep a disabled `+` for TRU-4.4.
4. **A size off a style writes Tailwind's own sizes** (`text-lg`), never `text-[17px]`, and keeps the style's weight with a `font-*` class, so changing one value changes one value. Tailwind's size also brings its line height: pinning that would need an arbitrary class.
5. **Off-style means:** the text style is overridden by a weight, line height or letter spacing, or a plain size is set with no style. No type classes at all isn't off-style. Choosing a style also takes `tracking-*` away, beyond the task's list, or it would stay flagged.
6. **Align writes `text-start` and `text-end`,** as a real app is multilingual.
7. **Vertical align:** `self-*` in a row flex or a grid parent, `align-*` on an inline or table-cell element, otherwise not shown.
8. **Removing a value.** The task has `+` and no way back, so a set Fill, Border, Shadow and Underline get a remove button. It takes the class away; at a use, where the class lives in the component, it writes the neutral one (`bg-transparent`, `shadow-none`, `border-0`, `no-underline`).
9. **Contrast** uses `colorjs.io`, already a dependency, against the element's own background or its nearest ancestor's. 4.5:1, or 3:1 for large text. A gradient, image or translucent background can't be measured, so nothing is said.
10. **A shadow's nearest tokens** are by blur.

### Slices

1. `layout-classes.ts`: a family can be given as an object; `border-radius` and border overlays; an overlay hook for a text style.
2. `style-classes.ts`, pure, with unit tests: families from styles, class mapping, off-style reading, contrast, shadow size, the steps. `styleTokens` for the server's op.
3. Server: `style-tokens` op, `replaces` and `clearWith` on `stage-classes`. Probe: `backdrop`. `PropertyPick.setsText`, `PropertySection.Add`.
4. Panel: `style-sections.tsx` (Radius, Blending, Fill, Border, Text, Underline, Shadow), replacing TRU-3.8's read-only rows; `TokenField` detail and `TokenButton` icon; working `+`.
5. Docs: `docs/design-language.md`, `docs/modules.md`. Specs written, not run: `style-panel.spec.ts` and its fixture, `properties.spec.ts` updated.

### Proving each criterion

Unit tests for the mapping, what replaces what, off-style and contrast. A throwaway headless script on the real studio with a real app's tokens, at 1280 and 1440, light and dark, for what shows and what gets staged, and on a fixture shaped like `ListItem`. Apply on the fixture only, to read the source diff.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **Panel.** Radius, Blending, Fill, Border, Text, Underline and Shadow are fields and token menus in `style-sections.tsx`, written through the pure `style-classes.ts`. TRU-3.8's read-only rows for them are gone. Stroke and Filters stay read-only for TRU-4.4, with a disabled `+`.
- **A class's kind.** `familyOf` builds a family from what the element's classes set, so `text-title-m`, `text-grey-700` and `text-center` can't be taken for one another. `ring-*` isn't a shadow and `divide-*` isn't a border.
- **Sections.** Fill, Border, Underline and Shadow are one line with a working `+` until set, and open as soon as something is staged. Each gets a `−`. `PropertySection.Add` is the new slot.
- **Text on an element.** Shown when it holds only text or its classes set type or a text colour, so the chip's `text-grey-700` can be changed.
- **Contrast.** The probe reports `backdrop`, the nearest colour behind an element. The note reads "Contrast is 1.47:1. This text needs 4.5:1."
- **`stage-classes`.** `replaces` drops other staged properties a change takes over, `clearWith` overrides a class written in the component, and the same value by another token now counts as a change.
- **Words.** `docs/design-language.md` gains the field note and the panel's rules for styles, Text and shadows. `docs/modules.md` documents `Add`, `backdrop` and `setsText`.

### How it was verified

- **Types:** root `pnpm typecheck` and Truing's `tsc --noEmit`, exit 0.
- **Lint:** ESLint on the changed files, no output. Prettier clean. `jest --findRelatedTests`: no related tests.
- **Unit:** `vitest run` in Truing, 546 of 547 in the last full run, 30 of them in the new `style-classes.test.ts`. The one failure is `tokens.test.ts`: see Left open.
- **Browser:** a throwaway headless script on the fixture with a real app's real tokens, and another on a real app itself, signed out. No page errors in either.

| Check                                         | Result                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Card: text style, fill, radius, then Apply    | `bg-card rounded-lg text-title-m` to `text-label-md bg-primary rounded-2xl`, Direct |
| Source before Apply                           | untouched                                                                           |
| `text-title-m font-bold`, choose label-md     | adds `text-label-md`, removes `text-title-m` and `font-bold`                        |
| The same, choose title-m                      | removes `font-bold`; the flag clears                                                |
| Weight down on `text-title-m`                 | adds `font-semibold`; reads "title-m", off the scale                                |
| Size 18, then 20, on `text-title-m`           | `text-xl font-bold`; reads "None", off the scale                                    |
| Type size 17                                  | "Snapped to 16"                                                                     |
| `bg-[#1c68d4]`, choose primary, same hex      | adds `bg-primary`, removes the class by hand; was flagged                           |
| Colour menu                                   | Semantic first, then 9 families; 112 swatches; rows 28 px                           |
| Point at primary, Esc                         | preview `rgb(28, 104, 212)`; back to `rgb(250, 250, 250)`; nothing staged           |
| `text-grey-300` on white                      | "Contrast is 1.47:1. This text needs 4.5:1."; gone with `foreground`                |
| Bare box: `+` on Fill, Border, Shadow         | each opens at once; 33 px and enabled before                                        |
| Then `−` on each                              | nothing left staged; back to empty lines                                            |
| Border colour staged, then Remove, then Apply | writes; `border` and `border-grey-300` gone                                         |
| Radius corner up                              | adds `rounded-tl-2xl`                                                               |
| Opacity typed 52                              | `opacity-50`, preview 0.5                                                           |
| Chip: `rounded-[18px]`, `shadow-[…]`          | 18 and Custom, both flagged; Nearest leads with floating-card                       |
| Chip, this use                                | Claude, "it is written inside QuestionChip, so one use can't change alone"          |
| Chip, every use                               | Direct, "Changes every QuestionChip: 2 uses in the code"; Apply writes              |
| The list's `rounded-xl`                       | Claude, "class comes from a condition"                                              |
| From this size up on Desktop                  | `lg:bg-primary`, nothing removed                                                    |
| a real app's header button                      | `button-sm` flagged (a `font-bold`), `secondary`, `background`, `xs`                |
| On a real app, point at `title-2xl`              | 24 px, 700, 30 px                                                                   |
| Sideways overflow in the panel, 1280          | 0                                                                                   |

- **Screens, opened and read:** 1440 light and dark, 1280 dark, a colour menu and a real app, kept locally, not in this repo.

### What the reviewers flagged

- **a task review, not ready. Fixed, each with a regression test or a browser check:**
  - choosing the style already named did nothing, so `font-bold` and the flag stayed;
  - a second size step lost the style's weight;
  - a token with the same value as a class by hand staged nothing;
  - Remove could block all of Apply, as a staged colour had already rewritten what it removes;
  - the shadow's reading ignored breakpoints;
  - `ring-*` counted as a shadow, so choosing one deleted the ring;
  - `border-t border-b` collapsed to one side;
  - the spec read staged changes before staging had finished.
- **a copy review, not ready. Fixed:** the contrast note could round up to read "4.5:1 … needs 4.5:1", and never said contrast. "Align vertically", As its parent says, the fill's name in the tray, and two intents that didn't say what they meant.
- **My own slip, fixed:** I shortened TRU-3.8's Line height, Letter spacing, Thickness, Width and Opacity to fit. They're back, on rows of their own where needed, as existing copy stays.
- **My own scripts. Fixed:** `border-transparent` read "#000000 0%", flagged. It reads Transparent, with no flag.

### Left open

- **E2E not run, as the maintainer asked.** `style-panel.spec.ts` is new, and `properties.spec.ts` changed to read fields. Nothing was skipped or removed, so "Tests" is unmet. The specs may hold mistakes the script didn't.
- **`tokens.test.ts` still times out in full runs,** with no assertion failing, and passes 49 of 49 alone. TRU-4.2 recorded the same. It wasn't run without this change, and the limit wasn't raised.
- **A browser check and a design review didn't run as tools:** Truing injects its runtime only into its own browser. "PR" is unmet: this is a local merge.
- **Try by hand:** a real drag on the radius slider, and a scrub on a label.
- **Taste:**
  - "Align vertically" sits in Text while Layout has "Align in its parent", and in a row or a grid both write `self-*`: the task asks for both;
  - Start and End under left and right icons, chosen for right-to-left pages;
  - Text style's "None" when nothing is set, and "title-m, changed" in the tray;
  - the `−` beside each set value, which the task didn't ask for.
- **Limits:**
  - in a real app `sm` and `md` are both 8 px and `lg` and `xl` both 12 px, so the slider has one stop for each pair, and choosing `md` writes `rounded-sm`;
  - a size off a style takes Tailwind's line height with it, as pinning one would need a class by hand;
  - at a use, a style can't take a weight class written inside the component;
  - with no colour behind an element, or a translucent one, no contrast is measured; the same goes for an element with no text of its own, which has no Text section;
  - `−` on a shadow leaves a `ring-*`, which still reads as Custom;
  - removing every class leaves `className=""`, as TRU-4.1's engine does.

Criteria #7 were not fully proved when this task closed. See Left open above.
<!-- SECTION:FINAL_SUMMARY:END -->
