---
name: ui-design
description: 'Design and review web interfaces, phone-first and desktop: spacing, type, colour, states, motion, forms, search results and filters. Use when building, restyling or reviewing anything a user sees, polishing small details (touch targets, layout shift, skeletons, empty states, motion), adapting a pattern from a reference site, or when a screen looks generic, cramped or off.'
---

# ui-design: interfaces that are fast, stable and not generic

**In this repo:** `docs/design-language.md` overrides this skill for Truing's own interface: a dense desktop tool, with 24 px hit areas, 12 px text and 1280 and 1440 px widths. Read it first.

The repo's own CLAUDE.md and AGENTS.md, lint config, design system and component library take precedence over everything here: read them first and follow them where they differ. This skill adds what they usually leave out (invariants to check, craft details with sources, a review rubric), and it outranks everything in `references/vendor/` wherever the two disagree. Class names in the references are Tailwind v4 and the code is React or Next.js; translate to the project's own stack.

Build only from the project's design tokens (colour, type roles, spacing, radius, elevation, motion) and never invent a colour, size or duration: a value the design system lacks is a new token (`references/tokens.md`), and if the project has no design system, define a small set of tokens before styling components. Concrete tokens work; vague taste words ("clean", "modern", "minimal") push a model to a different generic look, so never brief yourself with them.

## Non-negotiables (check every one before you call a screen done)

1. Tokens only. No raw colour, size, radius, shadow or duration values in components.
2. Numbers, money and dates go through `Intl` for the person's locale, in one shared formatter per kind, on the server side of a component (or the formatted string is passed down, because the server's and the browser's ICU data can differ); data and APIs stay in machine formats (ISO 8601 dates, plain numbers); `NaN`, `undefined` and `Invalid Date` never reach the screen.
3. Tap targets are at least 44 px (48 px for the primary action), measured as the hit area, and spaced by how they look (8 px between bordered chips, about 12 px around filled controls, about 24 px between bare icons); input text is at least 16 px; zoom is never disabled; paste is never blocked.
4. One primary action per screen, solid. Secondary is outlined or quiet, tertiary looks like a link.
5. Every screen has its loading, empty, error and long-content states designed, not just the happy path.
6. Contrast follows WCAG: 4.5:1 for normal text (placeholders included), 3:1 for large text (at least 24 px, or 18.66 px bold) and for controls, icons and focus rings; focus is always visible.
7. Motion animates `transform` and `opacity` only, can be interrupted, stays under 300 ms (shared-element morphs and page slides up to 400 ms, a drag settle up to 500 ms), has a reduced-motion variant, and is absent from anything used dozens of times a day.
8. Labels sit outside fields and above them. Errors say what happened and how to fix it, inline next to the field.
9. Nothing moves unless the person moved it: image and late-arriving boxes are reserved before they load, skeletons match the real layout, numbers that change in place use `tabular-nums` in a box sized for their widest value, and nothing changes weight or size between states.

## Workflow

1. **Read** the task's spec, the project's CLAUDE.md or AGENTS.md, and its design system or tokens if it has them (and its glossary or copy guidelines, for the words). If a reference site matters, study it through screenshots in the browser tool and adapt the pattern; never copy assets, copy text or brand colours.
2. **Reuse before creating.** Look in the project's component library and the feature's own components first.
3. **Structure first, in the browser, at a phone width (412 px) and then at desktop (1440 px)**, or at the widths the project already tests. Semantic elements, real copy, real longest-case data.
4. **Build the states** (loading, empty, error, long content, disabled, focus) before polishing the happy path.
5. **Verify with `/verify-ui`**: measured facts (overflow, target sizes, contrast, computed spacing) beat looking. A model reads images in coarse patches and cannot see a 2 px misalignment, so measure instead of squinting; when you do look, use viewport-sized shots or element crops, never a tall full-page image.
6. **Walk `references/craft.md`**: every section that applies to what is on screen, measuring the rules marked **Measure**. Then **self-review against `references/anti-slop-review.md`** and ask the `reviewer` subagent, given that rubric and the screen, for a fresh-context review. Fix one thing per round; stop after about three rounds and list what is left for a human. Taste, copy tone and brand feel are the human's call and go under "left for you to check"; the words themselves go through the `ux-copy` skill and the `reviewer` subagent.

## Read the reference you need, not all of them

| Reference                                   | Read when                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `references/craft.md`                       | the small details, by topic, with sources: motion, layout stability, loading, optimistic updates and undo, touch, pointer and keyboard (targets, tooltips, menus, sheets), visual restraint (icons, colour budget, empty states, scroll fades, surfaces), type and language. Read the section for what you build; walk it before calling a screen done |
| `references/mobile-forms.md`                | forms, bottom navigation, sheets, touch                                                                                                                                                                                                                                                                                                                |
| `references/search-and-listing-patterns.md` | search results, filters and ranges, sorting, no-results states, detail pages, saved searches and alerts                                                                                                                                                                                                                                                |
| `references/states-a11y.md`                 | loading, empty and error states, focus, contrast, error wording, validation timing                                                                                                                                                                                                                                                                     |
| `references/motion.md`                      | any animation or transition                                                                                                                                                                                                                                                                                                                            |
| `references/tokens.md`                      | adding or naming a token, theming                                                                                                                                                                                                                                                                                                                      |
| `references/anti-slop-review.md`            | before calling a screen done; reviewing someone else's screen                                                                                                                                                                                                                                                                                          |
| `references/vendor/`                        | the original texts behind much of `craft.md` (Vercel web interface rules, Emil Kowalski on motion, Jakub Krehel on surfaces and icons, accessibility fixes); `VENDORED.md` lists where they do not apply or were found wrong                                                                                                                           |
