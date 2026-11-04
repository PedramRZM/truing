# Craft details: the small things that add up

Each rule here is small; together they decide whether a product feels alive, fast and trustworthy. They come from practitioners whose published work independently agrees on most of them (Vercel's Web Interface Guidelines, Apple's HIG and WWDC sessions, Jakub Krehel, Emil Kowalski, then Adam Argyle, Rauno Freiberg, NN/g, Vercel Geist, Benji Taylor, Josh W. Comeau), from platform specs, and from the source of the libraries named below.

**How to use it.** While building, read the section for what you are building. Before calling a screen done, walk every section that applies to what is on screen; the measurable rules are marked **Measure** and are also rows in `anti-slop-review.md`. Values are defaults: write the project's token, never the number, and where the project's CLAUDE.md or AGENTS.md, lint config or design system disagree with a value here, the project wins. This file outranks `vendor/`; where they disagree, the reason is given here.

Class names are Tailwind v4 examples; translate them to the project's own utilities and tokens. Library names (Base UI, Radix, Vaul, Sonner, Floating UI and so on) appear because their source or defaults were the evidence: use whichever the project already has, and never add a library for one of these details. Version-specific claims (Tailwind 4.3.3, Next.js 16.3.5, React 19.3) were checked in September 2026; recheck them against the installed versions before relying on them.

## 1. Motion

### Whether to animate

- **Decide by frequency first.** Dozens of times a day: no motion, or at most a 100 to 150 ms colour or opacity change (toggling a filter chip, changing sort, results refreshing, switching tabs within a page, the suggestion highlight, submitting with Enter). Occasionally: standard motion (the filter sheet, the image viewer, a toast, a dialog). Rarely: delight is allowed (the first-run walkthrough, the first saved search). Test: would it still feel fast the fiftieth time today? (Emil, Rauno, Apple HIG, Benji Taylor)
- **Frequently used menus open instantly** (sort, a row's overflow menu). If they animate at all, they fade out over 100 to 150 ms, and the chosen row flashes for about 100 ms first (values are inference). (Rauno, Jakub)
- **Never block input while something animates**: no control is disabled "until the animation ends", and state never waits for `transitionend`. (Apple HIG)

### Interruptible, and honest about it

- **Everything a person can reverse uses a CSS transition**, which retargets from the current value; keyframes and one-shot WAAPI are for one-time entrances only. A reversed transition replays its whole curve in less time, so its speed jumps; only a velocity-keeping spring turns around smoothly, and that needs a library. (Apple WWDC18 and WWDC23, Base UI, CSS Transitions spec, Josh W. Comeau)
- **View transitions cannot be interrupted**: a new one skips the running one to its end, and the overlay swallows taps. Use them only for navigations and rare reveals, never for chips, sort, a save toggle or tabs; add `::view-transition { pointer-events: none; }` and keep them at 400 ms or less. (Chrome, React, Next.js guide, Matt Perry)
- **After a drag, settle at the finger's speed.** Pass the release velocity to a spring, or pick the CSS duration from the curve's initial slope (clamped to 150 to 500 ms; inference). Vaul settles in 500 ms with `cubic-bezier(0.32, 0.72, 0, 1)`. Measure velocity over the last 100 ms of pointer samples, never over the whole drag. (Apple, Motion, Vaul)

### Timing, easing, springs

- **Duration grows with distance and area**: press, switches and icons about 100 to 120 ms; popovers, chips and a sheet opened by tap 150 to 250 ms; full-screen slides and shared-element morphs 300 to 400 ms (a morph duration token of about 350 ms); a drag settle up to 500 ms. These are the named exceptions to "under 300 ms". (Material, NN/g, Emil, Next.js guide)
- **Exits are quicker and quieter than entrances**: about 50 to 85 % of the enter time (Material: dialog fade 150/75 ms, sheet 250/200; NN/g: 300 in, 200 to 250 out), over a shorter distance. The exception is a decorative hover lift, which enters fast and settles back slower (Josh: 150 and 450 ms).
- **Easing by role**: entering or responding, a strong ease-out; moving across the screen, ease-in-out; leaving the screen for good (a dismissed sheet, a swiped toast), an accelerating curve is allowed; a popover closing near its trigger, ease-out. Tailwind 4.3.3 ships its own `--ease-out`, `--ease-in-out`, `--default-transition-duration` (150 ms) and `--default-transition-timing-function`, which every bare `transition-*` class uses, so override all four in `@theme` when the project defines its own curves. (Emil, Material, Josh)
- **Springs start with no overshoot** (bounce 0) for anything a tap triggers; a little (bounce about 0.15, never above 0.4) only after a gesture that carried momentum; opacity and colour never overshoot. Without a library, `linear()` curves from a generator give a spring's shape (Baseline) but not its velocity. (Apple WWDC18 and WWDC23, Material 3, Josh)
- **Press feedback on the down event, action on release**: `active:scale-97` (range 0.95 to 0.98), the press-duration token (about 120 ms), ease-out, using the individual `scale` property. Wide surfaces such as result cards and list rows change their background instead of scaling. (Apple, Emil, Jakub)
- **Use the individual `translate`, `scale` and `rotate` properties** so a press effect and an entrance never overwrite each other's `transform`.
- **`will-change` only on the one element about to move, and only while it moves**; never on a list of cards. Per-frame motion writes the moving element's own style, never an inherited CSS variable (that recalculates every child). (MDN, Matt Perry, Emil)

### Popovers, entrances and staggers

- **Popovers, menus and tooltips grow from their trigger**: start at scale 0.9 to 0.97 with opacity 0, never from 0, with `transform-origin: var(--transform-origin)` from the positioning library (the physical `origin-left` and `origin-right` classes do not mirror). Modals stay centred; bottom sheets translate from 100 % without scaling. **Measure** while it opens: `getComputedStyle(popup).transformOrigin` sits on the trigger's side, and the first scale is 0.9 to 0.97 (`popup.getAnimations()`). (Emil, Base UI, Material)
- **Enter and leave `display: none`, popovers and dialogs in plain CSS**: `@starting-style` after the base rule, `transition-behavior: allow-discrete` on `display` and `overlay` (Tailwind: `starting:` and `transition-discrete`). It is progressive enhancement: Firefox cannot transition `display` and `overlay` is Chromium-only. `@starting-style` also plays on first render, so never on server-rendered lists. (Chrome, MDN)
- **Stagger only first-time or rare entrances** (a summary panel on first view, empty and success states, a home page's first load), never results after a filter change or rows added by a "Show more" button. Order: reading order grouped by importance, so the most valuable content arrives first (the headline fact and its status in the first group, no delay). That holds only while the layout itself reads in order of importance; never stagger against reading order. Gaps of 20 to 80 ms per item (the sources differ), about 100 ms between groups, only the first four to six items, the whole sequence within about 300 ms, and none under reduced motion. IBM Carbon recommends ending on the most important information instead; reading order grouped by importance is the choice made here. (Material, Emil, Jakub)

### Morphs and shared elements

- **Morph the container, not a pile of parts**: animate the container's bounds while its contents cross-fade inside it (a "Save search" pill becoming its confirmation card, a filter summary becoming the filter sheet); only for rare moments; consecutive steps differ in height so each change reads. (Material, Benji Taylor, Rauno)
- **Shared-element images (card to detail page)**: React `<ViewTransition name={`item-image-${id}`} share="morph" default="none">` around the card's first image and the detail page's main image, with `<Link transitionTypes={['nav-forward']}>`. The Next.js 16.3 App Router runs React 19.3 canary, so it works without configuration. One mounted element per name (a duplicate cancels the morph). The pair forms only when the detail page's image renders in the navigation's commit: the detail page reads its id and the item at the top and keeps the image and title outside any Suspense boundary (which also lets it answer a real 404), and the first screen's cards prefetch it fully with `prefetch={true}`; a card without the prefetch waits for the server before the morph plays; give both the same aspect ratio or crop through `::view-transition-old/new(.morph) { height: 100%; width: auto }` with `overflow: clip` on the group; 300 to 400 ms; never cross-fade into an image that has not loaded. Images are never stretched. A component that renders `ViewTransition` can be unit-tested when the unit-test run uses the same React 19.3 build; check the morph itself in end-to-end tests. (Next.js 16.3 guide, Jake Archibald, React 19.3)
- **Inside a page, prefer an anchor-based CSS transition for a morph people may interrupt** (a chip growing into its panel): anchor positioning with `@starting-style` and `interpolate-size`, as progressive enhancement. (Adam Argyle; low confidence, single source)
- **Never show a duplicate of something that persists into the next step**; move the original. (Benji Taylor)
- **Animate list reflow only to explain the person's own action** (a removed saved item collapsing, with undo), using committed state for the order, not `useOptimistic`; background refreshes never animate (`default="none"`).

### Icons and labels that change

- **Cross-fade an icon in place instead of swapping it**: both icons stay mounted in one grid cell; opacity 0↔1, scale 0.25↔1, blur 4 px↔0, about 300 ms with `cubic-bezier(0.2, 0, 0, 1)` and no bounce; a save or like toggle at 200 ms or less because it is tapped often; never on first render; the toggle carries `aria-pressed`. (Jakub, Emil)
- **When a label changes only in part, keep the shared words still** and animate only what changed: "234 results" to "241 results" changes digits only (with tabular figures); alternative labels stack in one grid cell so the width does not jump. (Benji Taylor, Adam Argyle)
- **Blur is a 2 to 4 px bridge inside a short cross-fade**, nothing more; it is dropped under reduced motion and on weak devices. (Emil, Next.js guide, Matt Perry, Apple)

### Direction of motion

- **Leave along the path you arrived on, and let the animation teach its gesture**: a toast rises, leaves downwards and is swiped down; a sheet opened upwards closes downwards; a removed row slides the way its swipe goes; tab content slides towards the tapped tab's side. (Apple WWDC18, Emil, Benji Taylor)
- **Photo carousels use native scroll snapping** (`scroll-snap-type: x mandatory; overscroll-behavior-x: contain`); clamp Safari's overshoot in any code that reads scroll positions; never autoplay. (MDN, Material, Val Head)

### Rubber-banding

- **Soft edges with growing resistance**: keep the browser's own scroll bounce (never `overscroll-behavior: none` on the page; `contain` on sheet scrollers), damp custom drags past a limit (Vaul: `8 * (Math.log(v + 1) - 2)`; Sonner: `delta / (1.5 + Math.abs(delta) / 20)`, which never exceeds 20 px), return without bounce, and clamp any code that reads scroll positions, because Safari reports positions past the edge while it bounces. (Apple WWDC18, Emil, MDN)

### Reduced motion and weak devices

- **Author motion inside `motion-safe:`** (`prefers-reduced-motion: no-preference`), so an unknown preference gets the still version. Under reduce: slides along x, y and z become 150 to 200 ms fades; scale zooms, shared-element morphs, parallax, blur, staggers and autoplay go; springs drop to bounce 0; opacity and colour changes, state feedback, progress and one-to-one gesture tracking stay. Never the global `animation-duration: 0.01ms !important` reset, which can speed motion up. (Apple HIG, MDN, Chrome, Josh, WCAG)
- **React's view transitions ignore the preference**: add the reduced-motion rules for `::view-transition-group/old/new(*)` yourself (`motion.md` has the recipe) and test with Playwright's `reducedMotion: 'reduce'`. (react.dev)
- **A weak phone is a performance tier, not a motion preference.** Pick the tier once at start from `navigator.deviceMemory` (below 4 is low; Chromium only) plus `hardwareConcurrency`. The low tier drops blur, `backdrop-filter`, morphs (fades instead), staggers and looping shimmer, never information or state feedback. Do not use the Battery Status API, Compute Pressure, `prefers-reduced-data` or frame-rate sampling, and never send the raw values anywhere. Browsers already throttle (iOS Low Power Mode caps animation at 30 fps), so script animations run on elapsed time, never on frame counts. (MDN, Chrome, WebKit, Matt Perry)
- **Pause loops that are off-screen** with an IntersectionObserver (a shimmer, a pulse). (Rauno, Vercel)
- **Switching theme suspends all transitions** for that one frame (inject `* { transition: none !important }`, switch, force a style flush, remove). (Rauno, Paco Coursey)
- **Never set `html { scroll-behavior: smooth }` globally**: Next.js 16 no longer overrides it on navigation, so every route change would scroll smoothly to the top. If in-page smooth scrolling is wanted, add `data-scroll-behavior="smooth"` to `<html>` and scope it to `no-preference`.
- **Test motion where it breaks**: slowed down in the DevTools Animations panel, on a mid-range Android phone over USB, in iOS Low Power Mode, with 4× CPU throttling, with reduced motion, and, if the product supports a mirrored layout, with every horizontal direction checked in it.

## 2. Layout stability: nothing moves unless the person moved it

- **Budget zero layout shift for every swap we design** (image, font, skeleton to content, a filter update) and **Measure** it: a `layout-shift` `PerformanceObserver` registered before navigation sums entries without `hadRecentInput`, read after the content is visible plus two animation frames (Chromium projects only). (web.dev)
- **Reserve every image's box before it loads.** A content image whose size is stored gets `width` and `height` attributes, which browsers map to `aspect-ratio: auto w / h` so a wrong guess corrects itself; a fixed design slot gets an `aspect-*` frame with `object-cover` (a result thumbnail) or `object-contain` on a token background (a gallery, where the whole picture must show). **Measure**: every `img` has a non-zero box while its response is held back. (Jake Archibald, web.dev, MDN)
- **Images of unknown size**: `next/image` with `fill` inside a positioned `aspect-*` frame; an item without an image renders a same-size placeholder, never nothing; an image that fails to load falls back to the same placeholder, never to its alt text.
- **Reserve space for every block that arrives late** (related items, an explanation panel, a chart): a `min-block-size` token on the frame around the Suspense boundary, or `aspect-*` for charts; an empty result renders inside the same box, because removing reserved space shifts as much as inserting it. (Next.js guide, web.dev)
- **Insert new content only on the person's tap, and reserve its space within 500 ms** (shifts within 500 ms of input are expected): a "Show more" button renders the new rows' skeletons at once; results that arrive while someone reads appear as an overlaid pill ("3 new results") and are inserted on tap; toasts, banners and prompts are overlays, never in the flow. (web.dev)
- **Move and resize with transforms only.** An element that grows pushes whatever follows it along the line, so a variable-width value (a price, a count) sits at the inline end of its row or has a fixed width. (Layout Instability spec)
- **Text boxes keep their size when state changes**: a pending button keeps its label, where it is, and its indicator is an always-rendered overlay in the button's inline-end padding, toggled by opacity, so the label stays centred whether the button is idle, pending or disabled; the message line under a field is always there (reserve its line height); font weight never changes between rest, hover and selected (use colour, a background or an indicator; if bold is required, reserve its width with a hidden bold duplicate); client-only text has a fixed box; nothing autofocuses on phones. (Vercel, Rauno, Next.js)
- **`scrollbar-gutter: stable` on the root** and on containers that can grow into scrolling (the filter sheet list, side panels), so desktop pages and scroll-locked dialogs never jump sideways. Never compensate with `padding-right`. (MDN, Ahmad Shadeed, Base UI)
- **A web font must not reflow text when it arrives.** Choose the loading strategy together with the font and measure its layout shift; a fixed line height does not fix swap reflow. Next.js 16.3.5's automatic fallback computes its metrics from Latin letters against Arial, which Android does not have, so check on Android. (web.dev, Chrome, Next.js source)
- **Long result lists** get `content-visibility: auto` with `contain-intrinsic-size: auto <row height token>`, as one `@utility`, from the second page on; off-screen rows stay in the accessibility tree. (web.dev, Vercel)
- **Numbers that change in place get `tabular-nums` and a box sized for their widest value**: the filter sheet's "Show 128 results" button, a stepper's value, a countdown, a count badge, chart axes, comparison tables. Tabular figures equalise digits only; a new digit or separator still widens the number, so give it a measured `min-inline-size` (`ch` is the width of the zero). Numbers that never change (a card's price) and running text stay proportional; the vendored typography file lists static display numbers under "don't use". **Measure**: `getComputedStyle(el).fontVariantNumeric` includes `tabular-nums`. (MDN, Vercel, Jakub)
- **Keep decorations from creating sideways scroll**: browsers clip overflow only at the inline start, so a shape bleeding past the inline-end edge makes the page scroll sideways; keep it inside or clip it with `overflow-x-clip`. (Ahmad Shadeed)

## 3. Waiting: loading states that never flash

- **Response bands**: visible feedback within 100 ms (press state, optimistic state, the chip highlight); nothing more under about 1 s; from 1 to 10 s a skeleton for a view or a spinner or dimming for a module; beyond 10 s, named steps with progress and a Cancel button ("Finding similar results… 2 of 4"). Aim for results within about 400 ms and mutations under 500 ms. (NN/g, Laws of UX, Vercel)
- **Delay pending indicators, then hold them.** An always-rendered indicator fades in after the pending delay (about 400 ms; sources range from 100 to 500 ms) and, once shown, stays at least 300 ms (a small timer; the `spin-delay` package does this). React does not delay new Suspense fallbacks (it only throttles reveals to one per 300 ms), whatever Vercel's page says, so a prerendered skeleton fades in through a CSS `animation-delay` while its space stays reserved. (Vercel, `spin-delay`, Epic Stack, React docs)
- **Updates keep the old content on screen**: they run in a transition (App Router navigations already do) and the stale part dims after about 200 ms (the stale-delay token) instead of turning into a skeleton; the filter chip itself is optimistic; the new count is announced politely. Search-as-you-type: `useDeferredValue` for rendering, a debounce of about 200 ms (never over 300) only for the request, stale responses dropped with an `AbortController`, and a spinner only after the debounce plus 300 ms. (React docs, Next.js guide, Algolia)
- **Per boundary, decide whether new data is different content** (reset with `key`) **or the same view refined** (keep and dim). In Next.js 16.3.5 a search-param change keeps the tree and a new `[id]` remounts; lock that with an end-to-end test before relying on it.
- **Skeletons are for the first load of a view or section** during a page load, and not for filter changes, anything cached under about a second, processes (a report being generated, a pasted-link import), errors, empty states or frame-only placeholders. (NN/g limits skeletons to page loads, and Viget and Adrian Roselli question them as a default.)
- **A skeleton is built from its component's own frame, in the same module**: `ResultCard` and `ResultCardSkeleton` both render `ResultCardFrame`, so their geometry cannot drift; no `isLoading` props and no `ResultCard.Skeleton` statics. The frame alone is not enough: measured at 412 px in one product, real rows came out 20 px taller because the facts line wrapped, so every slot has a fixed number of lines (a clamp on the content and a two-line minimum block size on the slot). **Measure**: skeleton rows and real rows have the same height at 412 px, within 1 px. (react-loading-skeleton, Vercel, Next.js guide; measured)
- **A skeleton text line is one line box of the real text style** (a block size of `1lh`) with a bar centred in it; text that may wrap reserves its lines (`2lh`). Shapes copy the element: image tiles keep their ratio, chips are rounded, avatars are pills. (MDN, Vercel Geist)
- **The skeleton copies the first screen of the real result**: as many rows as fill 412 × 915 under the header, with fixed keys; its box never collapses when fewer results arrive.
- **Shimmer is subtle, stops under reduced motion (a static block remains) and is finite**: three runs of 1.5 s end before the five seconds of WCAG 2.2.2; it pauses off-screen. (NN/g, Apple, WCAG, Adrian Roselli)
- **Skeletons are inert and quiet**: shapes are `aria-hidden`, nothing inside is focusable, one visually hidden `role="status"` sentence says what is loading ("Loading results…"), and the result region announces once. (Adrian Roselli, MDN, Vercel Geist)
- **Suspense boundaries follow the designed loading sequence** (one for a detail page's secondary column, one for the results list), never one per card; every boundary has an error partner that fits the same box. (React docs, Next.js Learn)
- **`loading.tsx` only where nothing meaningful renders without data**; elsewhere Suspense next to the data. The LCP element and the main content (an item's title, price, status and first image) are never inside a fallback: on the detail page they render in the blocking response, which a real 404 needs; on other pages they sit in the static shell. (Next.js guides, Remix)
- **Pre-render what the person will probably open next** inside a hidden `<Activity>` (a related-items drawer, an explanation panel). Next.js keeps the last three routes alive in hidden Activity, so Back is instant. (React docs, Next.js)
- **A link without prefetch still answers the tap**: a fixed-size `useLinkStatus` hint inside the link fades in after about 100 ms. In one project Partial Prefetching was turned off so that detail pages could answer a real 404; links then prefetch one by one, and the first screen's result cards use `prefetch={true}`, a full prefetch, so a tap opens the item at once. (Next.js)
- **A spinner sits in a place reserved from the start and turns only once the action starts** (`group-data-pending:animate-spin`, so it never appears mid-turn), 16 px, in the padding at the inline end of the button, out of the row, so it never moves the label (an in-flow slot beside the label pushed a centred label 14 px off centre); a button that holds one takes 2 rem of padding on both sides so the spinner keeps 8 px from the label; after about a second the work is named in the status line next to the control ("Saving…"), never by swapping the button's label; the finished state has no dots ("Saved"). (Vercel Geist; the reserved place is an addition made here, because Geist's mounting on demand would resize the button)
- **Pending state lives on the control as `data-pending`**, and ancestors style themselves with `has-data-pending:` or `group-data-pending:` (dimming after the stale delay) instead of receiving `isLoading` props. (Next.js guide)

## 4. Optimistic updates, undo and confirmation

- **Be optimistic only when the next state is predictable, the URL stays and a failure can be shown and undone**: saving and unsaving an item, an alert switch, a threshold someone typed, hiding an item, renaming a saved search, the chosen filter chip. (Remix, React Router, Luke Wroblewski, Linear, Vercel)
- **Never optimistic about what the server computes, creates or sends**: scores, totals and result counts; a new record's id; emails, messages and one-time codes. (Remix)
- **`useOptimistic` inside an Action**, reading the optimistic value so a quick second tap undoes the first; a `pending` flag per changed item in lists; one pure reducer shared by the client and the action. (React docs, Next.js guides)
- **The action's response must carry the new truth**: `updateTag` or `refresh()`, never `revalidateTag(tag, 'max')`, which sends no re-render, so the control snaps back when the action ends. Measured in Next.js 16.3.5: with `updateTag` a bookmark flipped 25 ms after the tap and held; with `revalidateTag(tag, 'max')` it flipped at 20 ms and jumped back at 451 ms, and a reload still served the stale value. (Next.js 16.3 server-actions guide; measured)
- **Send the target state, not a toggle** (`setItemSavedAction({ itemId, saved })`); a once-only effect carries an idempotency key generated in the event handler and checked on the server; never run Server Actions with `Promise.all` (they queue). (Stripe, Vercel, Next.js, React docs)
- **The rollback is visible, specific and recoverable, and moves nothing**: the control is already back to the truth; the message goes to an overlaid toast with "Try again", or to the field's reserved message line; a row being removed stays visible and dimmed ("Removing…") until the server confirms. (React docs, Vercel)
- **Undo instead of confirmation for anything reversible**: act at once, soft-delete, show "Weekly digest deleted · Undo" for at least five seconds and while it has focus, and keep a lasting way back (a recently removed list), because a disappearing toast is otherwise a time limit. Confirm only what is irreversible, such as deleting the account. (Aza Raskin, NN/g, Vercel, WCAG 2.2.1)
- **Toggles take effect immediately**, with no confirmation step. (Rauno)
- **Confirm at the trigger**: "Copy link" cross-fades to a check for about 1.5 to 2 s with a polite announcement, instead of raising a toast. (Rauno; the duration is inference)
- **Errors never disappear on a timer**, an undo stays until it is dismissed or the next action, and timed toasts are for pure confirmations only. (Apple HIG; Sonner's 4 s default is for confirmations)
- **Transient feedback is cleared when Next.js hides a route**, because hidden routes stay alive after Back: reset it in a `useLayoutEffect` cleanup or derive it from the attempt. (Next.js guide)
- **Double submission is harmless**: submit stays enabled until the submission starts, then is busy (`aria-disabled`, label kept, repeat presses ignored in the handler), and the server is idempotent. (GOV.UK, Vercel, React docs, Base UI)
- **Buttons are not disabled silently**: keep them enabled and explain on press ("Select at least one filter", with focus moved to the message), or use `aria-disabled` with the reason visible next to the button, never only in a tooltip. (Axess Lab, Adam Silver, GOV.UK, APG, Vercel)

## 5. Touch, pointer and keyboard

### Targets

- **Every control is at least 44 × 44 px (`min-h-11 min-w-11`) and the primary action 48 px.** 44 is Apple's default and WCAG AAA; Material asks for 48 dp; WCAG AA's 24 px is the legal floor, not the target. Dense desktop-only surfaces may use 40 px only with `pointer-coarse:min-h-11`. Size in rem so targets grow with the reader's font size. **Measure** the hit area with `document.elementFromPoint` 21 px from the centre (one pixel inside a 44 px target's edge), not the glyph. (Apple, W3C, Google, NN/g, Ahmad Shadeed)
- **Grow the hit area, not the glyph**: `relative after:absolute after:-inset-2.5` turns a borderless 24 px icon button into a 44 px target (the pseudo-element is placed inside the border, so a bordered button needs the border width added). Prefer the negative inset to centring the pseudo-element with `50%` and a translate: with a logical inset on a mirrored layout the translate does not flip and the target lands beside the button (measured in Chromium), and the vendored Krehel snippet centres this way. Hit areas never overlap. (W3C, Google, Vaul, Ahmad Shadeed)
- **Space targets by how they look**: at least 8 px between 44 px bordered targets such as chips; about 12 px around filled or bordered controls; about 24 px between bare icons. A destructive action never sits next to a frequent one. This replaces the flat 8 px rule. (Apple HIG, Material, W3C, NN/g)
- **Bars and lists are one continuous target**: padding goes on the link itself, not on the `<li>` or the container; bottom-navigation items fill their cells; a label and its control share one target; no dead gaps between rows or chips. (Apple, Ahmad Shadeed, NN/g, Vercel, Rauno)
- **Targets at the screen's edges and corners get bigger, not smaller**: on touch the edges are the hardest place to hit. (NN/g, Steven Hoober)
- **A result card is clickable as a whole** by stretching its title link over it (`after:absolute after:inset-0`); the card's own buttons come after that link in source order with their own 44 px targets; text people copy lives on the detail page. (Heydon Pickering, Ahmad Shadeed)
- **Decorative overlays never take taps**: fades and gradients over images are `pointer-events-none`; test by tapping the last chip under a fade. (Rauno)
- **Icons and units inside a field are absolutely positioned decorations with matching padding** (a search field's magnifier at the start edge with matching start padding; a unit label such as "USD" at the end edge with matching end padding), and a tap on them focuses the input. (Rauno)

### Press

- **Highlight on touch-down, act on release, cancel when the finger slides off or the list scrolls**: native `<button>` and `<a>` with `onClick`; never commit on `pointerdown` or `touchstart`; custom gestures use pointer capture and handle `pointercancel`. Opening a menu may happen on mouse down, because it is reversible. (Apple WWDC18, Devon Govett, W3C 2.5.2, Base UI)
- **Every custom pressable has a press state** (`active:scale-97`, returning in 100 to 160 ms); the tap highlight is removed only where an `active:` style replaces it. `:active` can stick after a finger slides off, and on iOS it may never show on a quick tap, so check on a real iPhone and use a script press state where it matters. (Apple, Emil, Jakub, Devon Govett)
- **`touch-action: manipulation` on controls** keeps taps instant at every zoom level and stops two quick taps on a "+" button from zooming; never `maximum-scale` or `user-scalable=no`, even though Vercel's page and the Next.js `generateViewport` example show them. (WebKit, MDN)
- **`select-none` only on interface chrome** (buttons, chips, tabs, the bottom navigation, drag handles) and during drags; never on prices, phone numbers, identifiers or descriptions. (Devon Govett, Vercel, Base UI, Rauno)

### Hover

- **Hover styles only for real mice**: redefine Tailwind's `hover` variant once in the global CSS, `@custom-variant hover { @media (hover: hover) and (pointer: fine) { &:hover { @slot; } } }` (verified on Tailwind 4.3.3, whose own `hover:` checks only `(hover: hover)`). Behaviour that depends on hover (tooltips, hover-opened menus) checks `event.pointerType === 'mouse'`, because touch laptops and iPads defeat the media queries. (Tailwind, MDN, Devon Govett, Emil)
- **A hover-lift card keeps the element that detects hover still** and moves an inner layer, so it never slides out from under the pointer. (Emil, Josh)

### Tooltips

- **Tooltips are desktop hints**: never on touch, never the only place for information someone needs. What a metric means or why an item has a given status goes inline or in a popover opened by an info button. A tooltip explains why, not what, and never wraps a labelled input. (Base UI, React Aria, NN/g, Heydon Pickering, Vercel Geist)
- **Delay group**: the first tooltip waits (about 600 ms; libraries use 500 to 1500), and its neighbours open at once and without an entry animation while the pointer keeps exploring, within a window counted from when the previous tooltip closed (about 400 ms; libraries use 300 to 400). Base UI's defaults are exactly this: Trigger `delay` 600, Provider `timeout` 400, and `data-instant` to set `transition-duration: 0ms`. By hand: a module-level `lastClosedAt`, and a delay of `performance.now() - lastClosedAt < 400 ? 0 : 600`. **Measure** in a desktop browser test: closed at 300 ms and open by 750 ms, the neighbour open at once, delayed again after the window, and never opened by a tap in a phone-sized touch test. (Emil, Vercel, Radix, Base UI, React Aria, Ariakit, Floating UI)
- **Every icon button has its own `aria-label`**; the tooltip repeats it for sighted mouse users and never supplies the name. A tooltip that only repeats the name is hidden from screen readers, which already hear it; one that adds information is wired with `aria-describedby`, as the APG pattern says. Buttons that show their label get no tooltip. (Base UI, APG, NN/g)
- **Tooltips can be hovered, close on Escape without moving focus, close when the trigger is pressed, and open at once on keyboard focus but not on focus caused by a click** (WCAG 1.4.13). (W3C, Radix, React Aria)

### Menus and popovers

- **Submenus stay open while the pointer travels to them by a safe triangle, not by long delays**: use the library's polygon (Floating UI `safePolygon()`; Base UI's submenu trigger with `blockPointerEvents: true`); by hand, Ben Kamens's triangle from the pointer to the submenu's two near corners (jQuery-menu-aim: tolerance 75 px, 300 ms). Hover-opened menus: about 100 ms open delay with a polygon, 300 to 500 ms without one, a close grace of at most 500 ms, and no hover opening on touch. **Measure** with a desktop browser test that moves the pointer diagonally towards the submenu and asserts it stays open. (Ben Kamens, Floating UI, Base UI, NN/g)
- **Place tooltips, popovers and submenus by logical side** (`inline-end`), let them flip on collision, and scale them from `var(--transform-origin)`. (Base UI, Radix, Emil)
- **Menus follow the APG keyboard model**: one Tab stop; arrows move; ArrowRight opens a submenu and ArrowLeft closes it (swapped when the layout mirrors); Enter and Space activate; typeahead; Home and End; Escape closes one level and returns focus; Tab leaves. Auto-repeat is ignored for keys that open or toggle. (APG, Radix, Base UI, React Aria)
- **Each group of related controls is one Tab stop with arrow keys inside** (filter chips, sort options, tabs, a card's actions). (APG)

### Sheets and gestures

- **Drags are faithful**: recognised only after about 10 px, then axis-locked; the grab offset is kept and the finger tracked one to one (`transition: none` while dragging, `translate` written on the element itself). A sheet closes on a flick or on distance (Base UI's drawer: 50 % of its size or 0.5 px/ms; Vaul: 25 % or 0.4 px/ms; Sonner's 45 px or 0.11 px/ms is for toasts, not sheets), commits only on release, and a reversal cancels the dismissal. (Apple WWDC18, Base UI, Vaul, Sonner, Rauno)
- **A sheet never starts dragging while its content is scrolled**, while it is being scrolled (for 100 ms after reaching the top) or while text is selected; `touch-action: none` goes only on the drag surface; extra pointers are ignored until release. (Emil, Base UI, MDN)
- **No double-tap handlers on content people also tap once**: a double-tap listener delays every single tap by about half a second. The image viewer zooms with a button and a pinch, around the pinch midpoint, responding from the first pixel. (Apple WWDC18, Rauno)
- **Library swipe directions are physical** (`left`, `right`), so a drawer anchored to the inline end needs its direction set deliberately if the layout can mirror, with a comment; start no custom horizontal swipe within about 20 px of the screen edges, where the system's back gesture lives; every swipe has a button too. Swipe-to-act rows have no momentum and a little elasticity, reveal their actions progressively (Jakub: 44 and 88 px, committing at 58 px) and fire a destructive action only on release, with undo. (Base UI, MDN, Apple, Jakub, Rauno)
- **The on-screen keyboard never covers a sheet's fields**: Base UI's `Drawer.VirtualKeyboardProvider`, or size the sheet from `visualViewport`; bottom bars pad by `env(safe-area-inset-bottom)` with `viewportFit: 'cover'`. (Base UI, MDN, Emil)
- **Scroll locking never shifts the page**: `scrollbar-gutter: stable`, never `padding-right`. Overlays, lists and chip rows contain their scrolling with `overscroll-behavior: contain` (`overscroll-x-contain` on horizontal rows); the page itself never does. (MDN, Base UI, Bramus, Vercel)
- **Escape and the phone's Back gesture close only the topmost layer**, and focus returns to what opened it, or to the next sensible place when that element is gone (the next row, the list heading). (APG, Floating UI, MDN)

### Keyboard and search

- **Keyboard shortcuts use a modifier or work only inside a focused component**, never a global single letter; they match `event.code`, the physical key, because `event.key` changes with the keyboard layout; they skip IME composition (`isComposing`, keyCode 229) and auto-repeat; the control shows its shortcut. (W3C 2.1.4, APG, MDN, Vercel)
- **Quick search and command menus**: Ctrl+K or ⌘K, arrows, Enter and Escape, the active option kept in view with `scrollIntoView({ block: 'nearest' })`. cmdk depends on Radix; if the project avoids Radix, build the menu from an autocomplete primitive in a dialog. (Paco Coursey, Base UI, Rauno)
- **The search box is a real search form**: `type="search"` in a `role="search"` form (Next.js `<Form>`), `enterKeyHint="search"`, text at least 16 px, `autoCorrect="off"`, `spellCheck={false}`, `name="q"`, and `autocomplete="off"` only where the product's own suggestions appear; `enterkeyhint="next"` and `"done"` in forms with several fields. (MDN, CSS-Tricks, Next.js, Vercel)
- **The cursor on buttons is one decision for the whole app, made once in the global CSS**: enabled buttons and `role="button"` elements get `cursor: pointer`, and disabled or `aria-disabled` ones the arrow (Tailwind v4 alone leaves buttons on the arrow). Components never set a cursor themselves. The default here is the hand. (Tailwind, Adam Silver, Heydon Pickering)
- **No sound or haptics on routine actions** (search, filter, save); if ever, one short cue on a rare completion, always paired with a visible change. (Apple HIG, Benji Taylor)

## 6. Visual restraint

### Icons

- **One icon family for the whole product**, chosen by testing it against the concepts the product needs, each in outline and filled form (for example calendar, map pin, bookmark, bell, trending-down, sliders, share, chevrons, close, search), registered once, with imports of any other set blocked (ESLint's `no-restricted-imports` does it). Never mix sets on one product. (Apple, Jakub)
- **The rendered stroke matches the stem of the label beside it, measured on the real font.** Rendered stroke = stroke in viewBox units × rendered size ÷ grid size. Jakub's table is a starting point (1.5 px beside regular text, 2 px beside semibold, on a 24 px grid), but stems differ between fonts: measure a straight vertical stem of the product's own font at the rendered size and match it. **Measure**: each icon within ±0.25 px of its label's stem. (Apple SF Symbols, Material, Jakub)
- **Hold the stroke constant across sizes with `vector-effect: non-scaling-stroke`** (Lucide v1: `nonScalingStroke`; `absoluteStrokeWidth` is deprecated and ignores CSS sizing), and keep non-scaling strokes at 1.5 px or less on 16 px icons so detailed glyphs do not clog. (Lucide source and docs, Material)
- **Size inline icons in em from their text** (start at 1.25 em and compare on the real text) **and standalone icons at the set's native 16, 20 or 24 px**. Never scale a small icon up: a large spot in an empty state is a 24 px icon in a tinted circle. (Lucide, Apple, Jakub, Material, Refactoring UI)
- **Icon and label sit a fixed `gap` apart**: 8 px inside controls and chips, 12 px in menus and fact rows, 16 px in list rows with a leading icon; the icon side has 2 px less padding (`ps-4 pe-3.5` when a chevron trails at the inline end). (Material, Jakub, Vercel)
- **An icon aligns with the first line of a wrapped label** (`items-start`, the icon inside an `h-lh` box), and asymmetric glyphs are centred optically (1 px nudges with logical margins such as `ms-px` or `me-px`). (Apple, Vercel, Ahmad Shadeed)
- **A visible word beats an icon whenever the concept fails a five-second test**: a status, a category or a type is a word; the bottom navigation and primary actions are icon plus label; icon-only is for universal glyphs (search, close, back, share), each with an `aria-label`. (NN/g, Linear)
- **Choose the icon for the concept the product's own word names**, and search the set's tags rather than guessing; check outline, filled, disabled, 16 px, dark theme and same-meaning-everywhere (and mirroring, where the layout mirrors) before it ships. (Apple, NN/g, Jakub)
- **Icons draw with `currentColor` in their label's colour**, outline by default and filled only for the selected state (a saved item's bookmark). (Jakub, Apple, Material)

### Colour and hierarchy

- **A hue budget per view**: tinted neutrals everywhere, one action hue (primary button, links, focus ring, selected state), status hues only on the badges and marks they belong to, and error or success colours only while that state exists; no decorative gradients, no coloured backgrounds on several controls. The action hue is never one of the status hues. The palette itself has many shades; the limit is per view. **Measure**: bucket the computed colours of visible elements whose OKLCH chroma exceeds 0.04 by 30° of hue; any bucket beyond the action hue and the states on screen is a finding. (NN/g, Apple, Refactoring UI, Material, Linear)
- **An ordered status scale (ratings, severity levels) is one ordinal ramp** whose lightness changes steadily, so every step stays distinct in greyscale and under a deuteranopia simulation; badge text uses the paired on-colour; "not rated" is neutral; the word always shows. (Datawrapper, Material, Apple, Vercel)
- **Neutrals lean towards the action hue with low chroma** (OKLCH about 0.003 to 0.01 at the ends of the scale and 0.015 to 0.045 in the middle), and every step has a fixed role (backgrounds, fills, borders, solid, text). (Radix, Vercel, Linear, Geist, Refactoring UI)
- **Never grey text on a coloured surface**: secondary text inside a coloured badge uses that hue's on-container step at 4.5:1, never opacity or an alpha colour, which dodge the contrast check (`tokens.md`). (Steve Schoger, Refactoring UI, Vercel)
- **Hierarchy comes from weight and colour before size**: at most three text colours and two weights per component, 400 with 600 or 700 (500 for 12 to 13 px labels). Underline only links. (Refactoring UI, Rauno, Apple, Emil, Ahmad Shadeed)
- **Fold labels into values** in fact rows ("3 bedrooms", "12 min read", "Due Friday"); labels stay only where values are compared side by side, and then they are the muted part. (Refactoring UI)
- **Content leads and chrome recedes**: header and bottom-navigation text use the secondary colour, and every surface uses the lowest elevation that still reads. (Linear, Vercel Geist)

### Empty states

- **Classify an empty state before designing it**: first use (no saved searches yet), no results (the filters emptied the list), cleared (everything was removed), error-caused (the activity feed failed to load), all-clear (nothing new since the last visit). Each has its own words and way out. (Vercel Geist, Atlassian, IBM Carbon, NN/g)
- **No dead ends**: one primary action and at most one secondary link; several empty modules on one page get tertiary links, never a wall of primary buttons; an all-clear state may offer a quiet link or nothing. (Geist, Carbon, GitHub Primer, Rauno, Vercel, NN/g)
- **No results keeps the query and the removable filter chips**, replaces only the list, hides the sort control, names the filter to relax with its count from the database ("Without the colour filter: 42 results"), and announces the change through a polite live region. (NN/g, Carbon, Geist)
- **Plain, neutral wording that says what will appear**, never what the person failed to do: no "invalid", "wrong", jokes or emoji. (NN/g, Carbon)
- **Laid out for its container**: a small module gets one sentence and a link; a full page gets one start-aligned block; illustrations only when the design system supplies them, with `alt=""`. (Steve Schoger, Carbon, Geist)

### Scroll fades

- **A fade is a hint**: it shows only on a side where more content exists, disappears at that end and when nothing overflows, and where the browser cannot drive it there is no fade at all (the chip cut at the edge is the cue). (Chrome, Apple, Kevin Hamer; measured)
- **The recipe**: `mask-image` driven by the rail's own scroll timeline, inside `@supports`. Without the guard, a browser that lacks scroll timelines runs the animation as a zero-length one and can fade the first chip (measured). The gradient keyword is physical, so set it for the layout's direction on purpose (`to right` when the inline start is the left edge, `to left` when the layout mirrors); the rail itself is the scroller (`overflow-x: auto`):

  ```css
  @property --fade-start {
    syntax: '<length>';
    inherits: false;
    initial-value: 0px;
  }
  @property --fade-end {
    syntax: '<length>';
    inherits: false;
    initial-value: 0px;
  }
  @keyframes inline-edge-fade {
    0% {
      --fade-start: 0px;
    }
    10%,
    100% {
      --fade-start: var(--fade-size);
    }
    0%,
    90% {
      --fade-end: var(--fade-size);
    }
    100% {
      --fade-end: 0px;
    }
  }
  @supports (animation-timeline: scroll()) {
    .chip-rail {
      /* Physical keyword on purpose: left-to-right, the inline start is the left edge. Use "to left" if the layout mirrors. */
      mask-image: linear-gradient(
        to right,
        transparent,
        #000 var(--fade-start),
        #000 calc(100% - var(--fade-end)),
        transparent
      );
      animation: inline-edge-fade linear; /* no fill mode */
      animation-timeline: scroll(self inline);
    }
  }
  ```

  Tailwind's `mask-l-*` and `mask-r-*` utilities are physical and have no logical form. (CSS Scroll-driven Animations spec, Chrome; measured)

- **Fade about one gap plus a sliver** (24 to 32 px, a fade-size token), leave a chip cut at the inline end at both 320 and 412 px, set `scroll-padding-inline` to the fade size, and give mouse users "Previous" and "Next" buttons or let the chips wrap. (NN/g; measured)
- **No visible scrollbar on a row, and no scroll area inside a panel** (a house preference with no published source): a row that scrolls sideways hides its scrollbar (`scrollbar-width: none`), shows the fade above, swipes and snaps natively for a finger, lets focus move along it for a keyboard, and for a fine pointer offers "Previous" and "Next" buttons that move the row by about 85 % of its width with a smooth scroll (instantly under reduced motion). The buttons show only where the row has more, are ordinary buttons in the Tab order, and say `aria-disabled` rather than vanishing under focus. A row that fits is not scrollable and has no buttons. Build this once as a shared component. A filter list never scrolls inside a rail or a sheet: it shows its first few options and grows in place with a "Show more" button, and a side rail is pinned beside the results only while all of it fits the window. A modal sheet has one scroll area, never a second one around it. **Measure**: list every scroll region (an element with `overflow: auto` or `scroll` whose content overflows) and flag a visible scrollbar, a scroll area inside another, or a vertical scroll area outside a dialog, at 412 and 1440 px with real scrollbars drawn.
- **Edge effects only where content scrolls under a floating bar, one per view** (the filter sheet above its sticky "Show 128 results" bar); check fades into dark surfaces for banding; every overlay is `pointer-events-none`. (Apple, Vercel, Chrome, Lea Verou, Rauno)

### Surfaces

- **Every image has a 1 px inset outline in black alpha** (white alpha in dark: a token such as `light-dark(oklch(0 0 0 / 0.1), oklch(1 0 0 / 0.1))` with `outline-offset: -1px`), never a tinted neutral, and its frame has a neutral background. (Jakub, Steve Schoger, Ahmad Shadeed)
- **Concentric radii**: inner radius = max(outer radius − padding, a minimum), and past about 24 px of padding the layers are separate surfaces. (Jakub, Apple, Vercel)
- **Separate with space first, then a background step, then a divider**; shadows only for what floats (the sheet, a menu, a sticky bar with content under it), layered (ambient and direct), with no horizontal offset, from a closed set of three or four elevations; in dark themes a 1 px light ring replaces depth. (Refactoring UI, Josh W. Comeau, Vercel, Geist, Linear)
- **Never a card inside a card**; if a surface must sit on a surface, they are at least two surface steps apart and the inner one has no shadow. (Material, NN/g)
- **Hairlines come from colour, not sub-pixel widths**: Chromium paints `border: 0.5px` as a full CSS pixel (measured); a line one device pixel thin is `box-shadow: 0 0 0 0.5px`. (CSS Values; measured)

### Text and spacing

- **`text-balance` on headings and result titles that have no visible box, `text-pretty` on multi-line body text**; never inside badges or on one- and two-line labels. A number stays with its unit through a no-break space (`10&nbsp;MB`). (Chrome, Jakub, Vercel)
- **States without reflow**: a selected chip shows a check icon, a fill and `aria-pressed`, never a weight change (or it reserves the bold width). (Rauno, Apple)
- **Space on a 4 px base with a curated, non-linear set of named steps** (4, 8, 12, 16, 24, 32, 48, 64, or the project's own scale), and group by proximity: more space between groups than inside them. (Material, Nathan Curtis, NN/g)
- **One inline-start keyline per list**: title, value, facts and badge share it; dividers start at it or run full width, one choice per list. **Measure**: those edges match within 1 px. (Vercel, Linear, Material)

### Defensive layout

- **`min-w-0` on every text-bearing flex child and `minmax(0, 1fr)` for grid tracks**, then decide per string: titles wrap (clamped to two lines only where the full title is one tap away), names truncate, URLs and long identifiers get `overflow-wrap: anywhere`. (Ahmad Shadeed, Vercel)
- **Image frames have a fixed `aspect-ratio` token, `object-fit: cover`, `max-width: 100%` and a neutral background**, with `alt` from the item's title; the no-image placeholder is the same frame. Inside a flex row the frame needs `self-start`: a stretched flex item ignores its aspect ratio (measured: a 4:3 thumbnail grew to the row's height). (Ahmad Shadeed, Vercel; measured)
- **Design for the longest and the shortest string**: `gap-4` before a trailing action so a long title never touches it, a `min-inline-size` token on buttons so a short label such as "OK" stays easy to hit, `min-height` instead of `height`. (Ahmad Shadeed)
- **Flex rows wrap unless they are deliberately a scroll rail**; space with `gap`, not `justify-between`; scroll with `overflow-x: auto`, never `scroll`. (Ahmad Shadeed)

## 7. Type and language

### Line height and containers

- **Size and line height are one token pair** (`--text-base` with `--text-base--line-height` in `@theme`), never set per component. Line height is one unitless multiplier per type role, falling as the size grows. (Tailwind source, Material 3)
- **A control's height comes from `min-block-size` and padding, not from its line height.** `overflow: hidden` (`truncate`, `line-clamp-*`, fixed-height badges) cuts whatever ink leaves the line box, so test truncated and clamped text with the longest strings. (Ahmad Shadeed, Apple WWDC22, Material 3)
- **Centre a label with its box, not with line height**: `inline-flex items-center`, a `min-block-size` and inline padding; accept 1 px of rounding and check icon and label together in a screenshot. (Google Fonts Knowledge)
- **Text containers survive WCAG 1.4.12 overrides** (line height 1.5, paragraph spacing 2 em, word spacing 0.16 em): `min-block-size` and padding, never a fixed height with `overflow: hidden` except where truncation is intended, and then at line height 1.5 or more. (W3C)
- **Never leave body text at `line-height: normal`**: `normal` is the font's own ascent plus descent, so the lines move when the fallback font replaces the web font; set the unitless number from the type role. The `font` shorthand silently resets `line-height` and `font-variant-numeric`: write `font:` only with `/<number>`, and declare `font-variant-numeric` after it. (MDN; measured)
- **Keep the font's vertical metrics as shipped.** `ascent-override` and `descent-override` have no Safari support (as of September 2026), so a fix there misses every iPhone; if a font sits off-centre, patch its metrics at build time, but only where the licence allows modifying the font (OFL does; a bought commercial licence may not, so check before relying on it). (Google Fonts, Microsoft OpenType, MDN)
- **Re-check type numbers whenever the font changes**: line heights, icon strokes (section 6) and clipping all depend on the font's own metrics; record the results next to the tokens.

### Measure and alignment

- **Cap reading width on desktop**: Tailwind's `max-w-prose` is 65ch, and WCAG 1.4.8 (AAA) asks for no more than 80 characters per line; a phone column needs no cap. (WCAG 1.4.8, MDN)
- **Start-aligned, not justified** (WCAG 1.4.8, AAA).
- **Text colours are solid tokens, not alpha colours**: `rgb(0 0 0 / .5)`, Tailwind's `text-neutral-900/60`, opacity and `color-mix()` derive a colour, and derived colours dodge the contrast check (`tokens.md`); a solid secondary or tertiary text token is the way to set a lighter colour. **Measure**: list text whose computed colour has alpha.

### Language and locale

- **Set `lang` on `<html>` and on any passage in another language**: language picks the quotation marks of `<q>` and the screen reader's voice. (W3C Internationalization)
- **Format numbers, money, dates and relative times with `Intl` for the person's locale** (`Intl.NumberFormat`, `Intl.DateTimeFormat`), never by hand; storage and APIs keep machine formats (ISO 8601 dates, plain numbers). (Vercel)
- **Prefer logical CSS properties** (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`; in Tailwind `ms-*`, `pe-*`, `text-start`) so layouts can mirror if an RTL locale is added. Things that do not mirror by themselves: `translateX`, `transform-origin`, horizontal shadow offsets, gradient directions, `background-position`, scroll maths and library props with physical names.
