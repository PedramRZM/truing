# Motion

Sources: Apple, "Designing Fluid Interfaces" (WWDC18) and "Animate with springs" (WWDC23), and the HIG on motion and accessibility; Emil Kowalski, `vendor/emil-design-eng.md` and his articles; Rauno Freiberg, "Invisible Details of Interaction Design" (2023-07); Jakub Krehel, `vendor/make-interfaces-feel-better/animations.md`; Material Design on speed, easing and choreography; NN/g on animation duration; Matt Perry's performance tier list; Chrome and MDN on view transitions, `@starting-style` and `prefers-reduced-motion`; the Next.js 16.3.5 guide "Designing view transitions" (bundled in `node_modules/next/dist/docs/`). The full, sourced list of motion details is `craft.md` section 1.

## When not to animate

- Anything used dozens of times a day or driven from the keyboard: list rows, dropdown items, tab switches, filter chip edits, search suggestions, sort changes. Emil: "You should never animate them." Rauno removed motion from core interactions and "suddenly felt like I was moving much faster." At most a 100 to 150 ms colour or opacity change.
- Anything that delays reading data (a price fading in, a skeleton-to-content cross-fade longer than 150 ms). This overrides the copied Next.js Suspense-reveal recipe, which shows content only after 360 ms.
- Loading states beyond a skeleton or spinner; no bouncing logos.
- Attention-seeking motion (pulsing badges, shaking buttons) is a bug unless the spec asks for it.

State feedback is not decoration: saving an item may cross-fade its icon in 200 ms or less, with no pop or bounce. Animate what helps orientation: where a sheet came from, that a button was pressed, that a saved item was removed and can be undone.

## Tokens (values are tokens, never inline numbers)

Suggested starting values. If the project already has motion tokens, use those and keep their names; if it has none, define a set like this one in the same place as its other tokens (`tokens.md`).

| Token                           | Value                            | Use                                                                                                                 |
| ------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--transition-duration-press`   | 120 ms                           | button press, toggle                                                                                                |
| `--transition-duration-popover` | 160 ms                           | popovers, tooltips, menus                                                                                           |
| `--transition-duration-sheet`   | 240 ms                           | sheets and drawers opened by a tap                                                                                  |
| `--transition-duration-modal`   | 280 ms                           | dialogs                                                                                                             |
| `--transition-duration-morph`   | 350 ms                           | shared-element morphs and page slides (sources: 300 to 400 ms)                                                      |
| `--transition-duration-settle`  | 500 ms                           | a sheet settling after a drag, with `--ease-settle`; or derive it from the release velocity                         |
| `--transition-duration-shimmer` | 1.5 s                            | one pass of a skeleton's shimmer (three passes end before 5 s)                                                      |
| `--transition-delay-pending`    | 400 ms                           | before a spinner or a first-load skeleton appears (sources: 100 to 500 ms)                                          |
| `--transition-delay-stale`      | 200 ms                           | before stale content dims during an update                                                                          |
| `--ease-out`                    | `cubic-bezier(0.16, 1, 0.3, 1)`  | entering and responding; the default                                                                                |
| `--ease-in-out`                 | `cubic-bezier(0.65, 0, 0.35, 1)` | movement from one on-screen place to another                                                                        |
| `--ease-settle`                 | `cubic-bezier(0.32, 0.72, 0, 1)` | the settle after a drag (Vaul); a gentler start than `--ease-out`, whose initial slope lurches after a slow release |

Tailwind 4.3.3 has its own `--ease-out`, `--ease-in-out`, `--default-transition-duration` (150 ms) and `--default-transition-timing-function`, which every bare `transition-*` class uses; redefine all four in the project's global CSS so utility classes pick up the project's curves. The token names follow Tailwind's namespaces, because it builds utilities only from them: `duration-press` exists only for `--transition-duration-press` (a `--duration-press` token produces no class; checked on 4.3.3), `delay-pending` for `--transition-delay-pending`, `ease-settle` for `--ease-settle`. Adjust values in the design system's token file, not per component.

Rules behind the numbers: stay under 300 ms except shared-element morphs and page slides (300 to 400 ms) and a drag settle (up to 500 ms); exits take 50 to 85 % of the enter time and travel less far; never ease-in on an enter, but an element leaving the screen for good (a dismissed sheet, a swiped toast) may accelerate out; press feedback scales to 0.97 (0.95 to 0.98); popovers enter from scale 0.9 to 0.97, never from 0; springs start with no overshoot and allow a little (bounce about 0.15, never above 0.4) only after a gesture with momentum.

## How

- Animate `transform` (through the individual `translate`, `scale` and `rotate` properties) and `opacity`. No `width`, `height`, `top`, `margin` or `box-shadow` transitions. For reveals, `grid-template-rows: 0fr → 1fr` animates layout (a reflow every frame), so keep it to one small element; `interpolate-size` works only in Chromium, as progressive enhancement. Never `transition: all`; list the properties.
- Transitions for anything that can be interrupted or re-triggered (hover, open and close, toggles); keyframes only for one-shot entrances. A transition retargets from where it is, but when reversed it replays its whole curve in less time, so its speed jumps; only a velocity-keeping spring (a library) turns around smoothly. Never block input until an animation ends.
- Enter and leave `display: none`, popovers and dialogs with `@starting-style` (written after the base rule) and `transition-behavior: allow-discrete` on `display` and `overlay`. Firefox cannot transition `display` and `overlay` is Chromium-only, so this is progressive enhancement; `@starting-style` also plays on first render, so keep it off server-rendered lists.
- Hover effects only for a real mouse: redefine Tailwind's `hover` variant once to `(hover: hover) and (pointer: fine)`; behaviour that depends on hover checks `event.pointerType`. Touch gets press feedback instead.
- `transform-origin` takes physical keywords: for popovers use the positioning library's `var(--transform-origin)` so they grow from their trigger.
- Reduced motion means reduce, not remove (Apple's list): slides along x, y and z become 150 to 200 ms fades; drop scale zooms, shared-element morphs, parallax, blur, staggers and autoplay; springs go to bounce 0; keep opacity and colour changes, state feedback, progress and one-to-one gesture tracking. Author movement inside `motion-safe:` so an unknown preference gets the still version. Never the global `animation-duration: 0.01ms !important` reset. A browser test run with `reducedMotion: 'reduce'` checks that nothing depends on motion to become visible.
- View transitions: the Next.js 16.3 App Router runs React 19.3 canary, so `<ViewTransition>` and `addTransitionType` from `react` work without configuration (`<Link transitionTypes>`, `router.push(href, { transitionTypes })`). A component that renders them can be unit-tested when the unit-test run uses the same React 19.3 build; the animation itself is checked in end-to-end tests. Use them only for navigations and rare reveals: they cannot be interrupted (a new one skips the running one to its end) and swallow taps while running, so add `::view-transition { pointer-events: none; }` and never name elements people tap rapidly. If a direction variable is needed, set it on `:root`, because their pseudo-elements originate from `html`. Transition types need Chrome 125, Safari 18.2 or Firefox 147; elsewhere React applies the change without animation. React ignores `prefers-reduced-motion` for them, so add:

  ```css
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-group(*) {
      animation-duration: 0s;
    } /* no travel, no resize */
    ::view-transition-old(*) {
      animation: 150ms ease-out both vt-fade-out;
    } /* explicit: Chrome 140+ inherits from the group */
    ::view-transition-new(*) {
      animation: 150ms ease-out both vt-fade-in;
    }
  }
  ```

  Class-specific rules such as `::view-transition-old(.nav-forward)` outrank `(*)`, so put their movement inside `no-preference`. On iOS Safari a swipe back may animate twice, because neither Next.js nor React checks `hasUAVisualTransition`; test it on a device before shipping page slides.

- Never set `html { scroll-behavior: smooth }` globally: Next.js 16 no longer overrides it on navigation.

## Checklist for a review

Duration within its token (under 300 ms except the named morph and settle exceptions); `transform`/`opacity` only; exits quicker than entrances; reduced-motion variant present, including view transitions; no motion on high-frequency actions; no view transition on a control tapped repeatedly; nothing blocks reading or tapping while it animates. Test in slow motion, on a mid-range Android phone and in iOS Low Power Mode.
