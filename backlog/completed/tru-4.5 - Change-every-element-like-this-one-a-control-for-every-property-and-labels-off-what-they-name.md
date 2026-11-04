---
id: TRU-4.5
title: 'Change every element like this one, a control for every property, and labels off what they name'
status: Done
assignee: []
created_date: '2026-11-02 23:16'
updated_date: '2026-11-02 23:16'
labels:
  - panels
dependencies:
  - TRU-2.2
  - TRU-4.1
  - TRU-4.3
  - TRU-3.9
type: feature
ordinal: 40050
parent_task_id: TRU-4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The maintainer asked on 2026-11-02, before the next tasks, for three fixes:

1. **Figma Make asks whether a change is for every similar element, with them highlighted on the frame.** Lists are the case: the real app's list cards, or the items of the header on `/main`. Until now an element in a `.map()` went to Claude, and tabs written by hand had to be changed one at a time.
2. **The panel couldn't change what the page shows.** The a toast on `/main` has a gradient, and the panel only said Gradient. The maintainer asked to probe every kind of property and give each a proper control.
3. **The pick's blue label covered what was picked** on the header's items, as there's no room above them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **The question.** After a change on a pick, the panel says how many are like it and offers Change all N and Only this one, with the others outlined in the frame. Pointing at Change all shows the change on them.
- [x] #2 **Hand-written and mapped alike.** Elements written once and drawn N times are one edit; elements written apart are one edit each. Undoing the change takes them all.
- [x] #3 **Every property.** Each CSS property the app's classes set has a control or a stated reason, kept true by a test.
- [x] #4 **Gradient.** Solid, Gradient and Image; shape, direction, colours and where each sits, clip to text. The toast reads and writes.
- [x] #5 **The label.** It sits outside the element whenever there's room.
- [x] #6 **Tests.** Unit tests on what's new. E2E not run, as the maintainer asked.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **"Like this" (`similar.ts`, `similar-plan.ts`, `similar-prompt.tsx`, `server.ts`).** The probe finds the nearest thing around the pick that repeats, by the page's structure, and takes the same place in each copy. So it doesn't matter how the code drew them. The server groups them by where they're written.
  - One place: one edit with `list: true` and `element.also`, so the preview shows on all. A place inside a component with one use stays `reach: component`; otherwise `reach: list`.
  - Other places: a follower each, `reach: similar`. Removals are only what that element has. The tray folds them into "Also on N more like it", and says if any need Claude.
  - Only this one: where one place draws them all, Claude, with "it is written once and drawn N times, so one can't change alone".
- **Engine.** It writes `className={navItem({ tone })}` in the cva call's base string in the same file, and `cn('w-full', tones[tone])` in the entry holding what's removed, which is how the toast's gradient is written. A class a variant sets still goes to Claude, as "class comes from a condition".
- **Package components.** A lucide icon or a `next/link` at its use takes a `className`. Before, every icon went to Claude.
- **Audit (`panel-coverage.ts`, `panel-coverage.test.ts`).** A test reads every class in the app's source and fails on a CSS property with neither a control nor a reason.
- **New controls (`effect-classes.ts`, `effect-sections.tsx`, `word-row.tsx`).**

| Section      | Added                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout       | Display, Position, Right and Bottom, Overflow; under More: Stack order, Aspect ratio, Grow, Shrink, Column and Row span, Scale, Move X and Y, Visibility |
| Fill         | Solid, Gradient, Image; image fit, place and repeat                                                                                                      |
| Blending     | Blend mode                                                                                                                                               |
| Outline      | Width, colour and offset; edits a ring where the element has one                                                                                         |
| Icon         | Colour, Fill, Lines, Line width                                                                                                                          |
| Text         | Case, Slant, Strikethrough, Lines                                                                                                                        |
| Stroke       | Width and colour; to Claude, as Tailwind has no class for it                                                                                             |
| Inner shadow | `inset-shadow-*`; Shadow no longer counts inner layers or rings                                                                                          |
| Filters      | Blur, Brightness, Contrast, Saturation, Grayscale, Invert, Sepia, Backdrop blur; a row each, and others read                                             |
| Interaction  | Cursor, Clicks, Select text, Transition, Duration, Easing, Animation. Closed by default                                                                  |

- **Label (`measure.ts`'s `labelTops`, `overlay.ts`).** Above, then below, then inside only when the element fills the frame. It stays whole at the frame's right edge too.
- **Change set v5**, `docs/design-language.md` and `docs/modules.md`.
- **Runtime budget: 110 KB, from 90 KB,** as the maintainer asked on 2026-11-02, sized in `bundles.test.ts` for the ten or so pending tasks that draw in the frame. The runtime is 90,223 bytes, after moving 844 bytes of schemas only the server reads into a function the bundler drops.
- **`propertiesOf`** no longer counts a `@property` rule's `syntax` and `inherits` as CSS properties.

### How it was verified

- **Types:** `npx tsc --noEmit` in Truing and `pnpm typecheck` at the root: exit 0.
- **Unit:** `npx vitest run` in Truing: 604 of 604. New: `effect-classes.test.ts`, `similar.test.ts`, `panel-coverage.test.ts`, and tests in `edits.test.ts` and `measure.test.ts`.
- **Browser:** throwaway headless scripts, not committed. On the fixture (`/similar`, Apply writes to the file, then restored):

| Check                     | Result                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-written tabs, colour | "3 like this", 2 outlined; Change all: "Also on 2 more like it"; Apply: `text-primary` on all three `<a>`                                         |
| Icon in a `.map()`        | "4 like this", 3 outlined; Claude until Change all, then Direct, "Changes all 4 on this page"; Apply: `size-4 text-primary` on the one `<Search>` |
| Banner gradient           | start and direction staged Direct; Apply: `from-primary`, `bg-gradient-to-b`                                                                      |
| Gradient by hand          | reads 45deg, "Written by hand, so it can only be read here."                                                                                      |
| Panel's sideways overflow | 0. No page errors                                                                                                                                 |

On a real app itself, signed out, at 1440 and read-only (`git status src` clean afterwards), with real pointer events:

| Check                          | Result                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A toast, `/main` | Gradient, To the right, brand-1-500 at 0, brand-2-500 at 100; start then direction: page shows `rgb(28, 104, 212)` to `rgb(127, 84, 232)`, Direct, at `user-sign-in-hint.tsx` |
| Header item                    | Label at 50 to 89 px, item at 17.5 to 42.5 px: doesn't cover it                                                                                                               |
| Header items                   | "6 like this"; pointing at Change all turns all six `rgb(28, 104, 212)`                                                                                                       |
| Their text colour              | Claude, "class comes from a condition": the colour is in the cva's tone                                                                                                       |
| Chevrons of the row of chips | "4 like this"; Change all: Direct, "Changes all 4 on this page"; each shows primary                                                                                           |
| Filter and blend on text       | `blur(8px)`, `multiply`. Sideways overflow 0. No page errors                                                                                                                  |

Screens read at 1440 in light. Not tried: 1280, dark, Apply on a real app itself.

### Deviations

- **TRU-4.4 asked for an eye on each filter;** each has a `−` that shows the result while pointed at instead.
- **TRU-4.4's open question** about Paper's Colors and Adjustments sections wasn't looked into, as Paper's not part of this ask.
- **Changing which icon is drawn** isn't here, though the maintainer's example was changing an icon. Colour, fill, lines and size spread. Swapping one for another rewrites a tag and an import, so it's TRU-15.3.

### Left open

- **E2E not run, as the maintainer asked.** No spec was added; the fixture page `test/fixture-app/app/similar/` is there for one. a browser check, a design review, a copy review and a task review weren't run either.
- **Search cards:** signed out, `/list` showed no cards, so the row of chips stood in for a list. Try a card's icon when signed in.
- **Taste:**
  - "Change all N" over "Apply to all", as Apply is what writes to the code;
  - the prompt's place at the panel's top, not on the canvas as in Figma Make;
  - the outlines, which reuse the instances' accent;
  - the words in the new menus, such as "Clicks: Lets them through".
- **Limits:**
  - "Like this" looks at what repeats around the pick, so the same component elsewhere on the page isn't outlined, though one edit in its JSX changes it too;
  - it stops at 60 elements and six levels up;
  - a gradient written by hand can only be read;
  - Strikethrough and Underline write to one tailwind-merge group, so setting both keeps the last;
  - the new tray text and prompts haven't been through a copy review.
- **Seen, not changed:** in a headless script, a locator's `.click()` inside the zoomed frame landed lower than its element, while real pointer events at computed points landed right. Worth a look if the fixture specs start missing picks.
<!-- SECTION:FINAL_SUMMARY:END -->
