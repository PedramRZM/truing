# States, accessibility, focus, contrast and error wording

Sources: WCAG 2.2 (W3C Recommendation, 2024-12-12), in particular SC 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.7, 3.3.1, 3.3.3, 3.3.7, 3.3.8; WAI-ARIA Authoring Practices (dialog, combobox, tabs patterns); NN/g on response times (1993, updated 2023), skeleton screens and empty states (2021), ten usability heuristics (reviewed 2024-01-30); GOV.UK Design System error message and error summary guidance; Deque on automated coverage ("on average 57 % of WCAG issues"); Refactoring UI ("empty states are a separate UI", 2018-11-02); Vercel Web Interface Guidelines and `vendor/fixing-accessibility.md` for the fix list.

## Every screen has five states, designed before polish

| State               | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading             | Under about 1 s show nothing new: an update keeps the old content and dims it after the stale delay (about 200 ms); a first-load skeleton or spinner fades in only after the pending delay (about 400 ms) and, once shown, stays at least 300 ms. 1 to 10 s: a skeleton for a view's first load, a spinner or dimming for one module. Over 10 s: named steps with progress and a cancel (NN/g). Skeletons are built from the component's own frame so nothing jumps; the shimmer stops within five seconds. Reserve every image's box. `craft.md` sections 2 and 3 have the full rules.                                                           |
| Empty               | First decide which kind it is: first use, no results, cleared, error-caused or all-clear. Say what this area is, why it is empty, and offer one next action ("You haven't saved any searches yet. Start from the results list."); the rule is no dead ends, so an all-clear state ("Nothing new since your last visit") may offer only a quiet link. No results keeps the query and the filter chips, replaces only the list, and names the filter to relax with its count. Design it as its own screen, not a blank list (Refactoring UI). No decorative illustration unless the design system supplies one. `craft.md` section 6 has the rules. |
| Error               | What happened and what to do, with a retry. A failed request keeps what the person typed. Full-page errors only when nothing on the page can work.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Long content        | The longest real title, the 12-line description, 99+ in a badge, a 40-character organisation name, a 12-digit number. Truncate only where a full view exists one tap away.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Success and pending | Confirmation stays visible until dismissed or the next action; pending buttons keep their label and width and ignore repeat presses. Errors never disappear on a timer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Plus the per-control states: default, hover (pointer only), focus-visible, active/pressed, disabled (rare; prefer enabled with an explanation), selected, invalid.

## Semantics first

- Native elements before ARIA: `<button>`, `<a href>`, `<input>`, `<select>`, `<dialog>`, `<details>`, `<nav>`, `<main>`, `<h1>`…`<h3>` in order. A `div` with `onClick` is never a button. Custom widgets follow the APG pattern for their role, including arrow-key behaviour.
- One `<h1>` per page, headings in order, landmarks named when there are two of a kind (`<nav aria-label="Categories">`).
- Icons that carry meaning have a text alternative; decorative icons are `aria-hidden`. Icon-only buttons have an `aria-label` and a tooltip or visible label where space allows.
- Images from data have `alt` from data (the item's title); decorative ones `alt=""`.
- Live updates (saved count, "Saved") are announced through a polite live region, not by focus theft.

## Focus

- Focus is always visible: never `outline: none` without a replacement. The ring is solid, at least 2 px, contrasts 3:1 with what it sits on and with the control (WCAG 2.4.13), and uses `outline-offset` so it clears rounded corners. `:focus-visible`, not `:focus`, so pointer users do not see rings on click.
- The focused element is never hidden under sticky bars (WCAG 2.4.11): `scroll-padding-block-start/end` equal to the bar heights.
- Dialogs and sheets move focus in, trap Tab, close on Escape, and return focus to the trigger (APG). Skip link to `<main>` as the first focusable element.
- Tab order follows visual reading order (top to bottom, along the reading direction); no positive `tabindex`.

## Contrast and colour

- WCAG ratios: 4.5:1 for normal text including placeholders and helper text, 3:1 for large text (at least 24 px, or 18.66 px bold). 3:1 for input borders, icons that carry meaning, focus rings and state indicators (SC 1.4.11).
- Colour is never the only signal: an error field also has a message and an icon; a selected chip also has a check icon and a fill (never a weight change, which widens the label and moves its neighbours).
- No grey text on a coloured background; lighten with a tint of the background colour instead (Refactoring UI). Disabled text may drop below 4.5:1 but still has to be readable in the sun on a phone; prefer not disabling.
- Check with numbers, not eyes: run axe with the `wcag22aa` tag, and compute the contrast for a specific pair (the `/verify-ui` skill shows how) instead of estimating it from a screenshot.

## Error messages

- Plain language, no codes, say the problem and the fix (NN/g heuristic 9; GOV.UK). Avoid "invalid": "Password must be at least 12 characters" instead of "Invalid password".
- Inline, directly below the field, in the error colour with an icon, associated through `aria-describedby`; `aria-invalid="true"` only after validation ran.
- On submit with several errors: an error summary at the top that receives focus and links to each field (GOV.UK), or focus on the first invalid field (WAI); pick one per form and keep it.
- Errors never delete input (SC 3.3.7) and never time out a form silently (a one-time code that expires keeps the screen and offers a resend).

## Touch and motion accessibility

- Every drag and swipe has a single-pointer alternative (SC 2.5.7). Long-press reveals nothing that a visible control does not.
- Honour `prefers-reduced-motion` (`motion.md`) and `prefers-contrast`; never lock orientation.
- Autoplaying carousels have pause controls or, better, do not autoplay.

## What automation catches and what it does not

axe finds roughly half of WCAG issues (Deque: "on average 57 %"). It cannot judge whether the alt text is right, whether the reading order makes sense, whether an error message helps, whether focus order matches the visual order after a layout change, or whether the copy is understandable. Those go through the keyboard walk (Tab through every screen, operate everything with the keyboard) and a human read of the copy. A fresh-context reviewer checks the first four; copy is always "left for you to check".
