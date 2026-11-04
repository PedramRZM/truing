# Mobile-first: touch, navigation, sheets and forms

Sources: WCAG 2.2 SC 2.5.8 Target Size (Minimum), SC 3.3.7 Redundant Entry, SC 3.3.8 Accessible Authentication, SC 1.4.10 Reflow, SC 2.2.1 Timing; Apple Human Interface Guidelines (layout, buttons); Material Design 3 (touch targets, navigation bar, bottom sheets); Steven Hoober, "How Do Users Really Hold Mobile Devices?" (2013-02-18, n=1,333); Luke Wroblewski, "Obvious Always Wins" (2015-04-27), "Web Form Design" label research (2007) and inline validation study (2009); NN/g on form labels (2014), bottom sheets (2023-06-11) and input steppers (2026-03-19); Vercel Web Interface Guidelines (vendored); web.dev on SMS one-time codes (2020-12-09); MDN on `inputmode` (2026-04-17).

## Targets and grip

- Minimum 44 × 44 CSS px per control (Apple 44 pt; WCAG 2.2 AA only requires 24 px, which is too small for an app used on the go); the primary action is 48 px tall (Material 3). Space targets by how they look: at least 8 px between bordered chips, about 12 px around filled controls, about 24 px between bare icons (`craft.md` section 5). Icon-only buttons get a padded hit area, not a bigger icon: `after:-inset-2.5` on a `relative` button, never a pseudo-element centred with a logical `inset: 50%` and a translate, which lands beside the button when the layout mirrors.
- 49 % of people hold the phone one-handed, 36 % cradled, 15 % two-handed, and they switch grip constantly (Hoober). Do not design for one grip: the primary action and the controls used most sit in the lower half of the screen, destructive actions do not.
- Hover reveals nothing that touch cannot reach. Define Tailwind's `hover:` variant as `(hover: hover) and (pointer: fine)`, so hover styles apply to real mice only; behaviour that depends on hover (tooltips, hover-opened menus) checks `event.pointerType`, because touch laptops defeat media queries. Every swipe or drag has a tap alternative (WCAG 2.5.7): a swipe-to-delete row also has a visible delete button.
- Design and test at 412 px first, then 1440 px. No horizontal scroll at 320 px (WCAG 1.4.10); a browser test that compares `scrollWidth` with `clientWidth` at 320 px enforces it.

## Navigation

- Primary destinations are visible, not behind a hamburger: "Hiding critical parts of an application behind these kinds of menus could negatively impact usage" (Wroblewski). A bottom navigation bar with three to five labelled destinations in fixed positions (Material 3: "Don't remove the labels").
- Sticky bars (bottom navigation, a sticky action bar) reduce the visible area: set `scroll-padding-block` on the scroller to the bar heights so focused elements are never hidden under them (WCAG 2.4.11), and keep sticky content under about 20 % of the viewport height.
- Back always works and always goes back. Sheets and dialogs close on Back and Escape.

## Sheets and dialogs

- A bottom sheet is for a short, single task (choose a sort order, apply filters, confirm a removal). "Do not use a bottom sheet to replace typical page-to-page user flows" (NN/g). Never stack sheets.
- Every sheet has a visible close button, a title, and returns focus to what opened it. Prefer the native `<dialog>` element (focus trap, Escape and `inert` background come free) and the APG dialog pattern for anything custom.
- Sheets slide in on the block axis (from the bottom).
- Confirmation only for destructive or costly actions; everything else is undoable (removed a saved item: show "Removed" with "Undo").

## Forms

- Labels are visible, sit above the field and outside it (NN/g: "clear, visible labels that are placed outside empty form fields"; top-aligned labels are fastest and tolerate long labels, Wroblewski). Placeholders are examples, not labels, and they still need 4.5:1 contrast.
- One column. Fields in the order a person thinks (country before region before city). Ask only what the flow needs (a sign-up or an alert form needs a handful of fields); one full-name field; never ask for data the app already has (WCAG 3.3.7).
- Input text at least 16 px so iOS does not zoom; zoom itself is never disabled (`maximum-scale`, `user-scalable=no` are forbidden); paste is never blocked (Vercel guidelines, WCAG 3.3.8).
- Right keyboard per field: `inputmode="numeric"` for amounts, quantities, years and codes, `type="tel"` for phone numbers, `type="email"` or `type="url"` for those. `inputmode` only picks a keyboard, it validates nothing (MDN).
- `autocomplete` on every field it applies to (`tel`, `one-time-code`, `name`, `organization`, `postal-code`, `street-address`).
- Use `type="text"` with `inputmode="numeric"` for amounts and codes rather than `<input type="number">`, which steals scroll-wheel events.
- A one-time code is one field, not six boxes, so pasting works (`inputmode="numeric" autocomplete="one-time-code"`); show where the code was sent with an "Edit" link, a visible countdown to resend, and resend enabled after it. An expired code shows a message and keeps the screen; it never wipes the form (WCAG 2.2.1). The SMS ends with `@<domain> #<code>` so browsers can offer autofill (web.dev).
- Explain why a sensitive field is asked, right under it ("Only used to send you alerts" under a phone field).
- Validation timing (sources disagree, this is the synthesis): validate on submit by default; validate on blur only a non-empty, format-constrained field (phone, postal code); clear the error on the keystroke that fixes it; never validate while the person is still typing in an empty field. Wroblewski measured "a 22 % increase in success rates" with inline validation done this way.
- Error text says what happened and how to fix it, inline under the field, in plain words ("Password must be at least 12 characters"). No "invalid", no error codes (GOV.UK, NN/g heuristic 9). On submit, move focus to the first invalid field and set `aria-invalid` only after validation ran. `states-a11y.md` has the full error rules.
- Submit buttons keep their label and width while pending: `aria-disabled` (not `disabled`, so focus is not lost), repeat presses ignored in the handler, a spinner that overlays the button's inline-end padding (so the label stays centred) and fades in after the pending delay, and a wait longer than about a second named in the status line beside the button ("Sending…"). A request that failed is retryable without retyping.

## Ranges and steppers

Ranges (price, size, year) are two typable fields with words between them ("From … to …"); each accepts thousands separators. Common bands may appear as chips next to the fields, never instead of them (_inference_). A stepper, where one is needed, has − and + buttons of 44 px with a typable field between them. A value that is clamped or rounded is announced, never changed silently.
