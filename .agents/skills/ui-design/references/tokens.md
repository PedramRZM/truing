# Design tokens

Sources: Material Design 3 token guidance ("component tokens should point to a system or reference token, and not contain hardcoded values"); Nathan Curtis, "Naming Tokens in Design Systems" and "Don't Globalize Decisions Prematurely" (EightShapes); Tailwind CSS v4 docs on `@theme`, `@theme inline` and theme variables; MDN on `color-scheme`, `light-dark()` (Baseline newly available 2024-05) and `oklch()`; Design Tokens Community Group format (2025.10, stable but "not a W3C Standard"); Refactoring UI on defining shades up front ("8-10 shades", no preprocessor `lighten`/`darken`); Hardik Pandya, 2026-03-01 (n=1 practitioner report: a closed set of named variables took an agent's hard-coded values "418 across 28 files → 0"). Anthropic's own model guidance: generic taste words move a model to another fixed palette, concrete named values do not.

The project's design system defines its palette, type roles, spacing, radius, elevation and motion scales; find where (a tokens file, `@theme` in the global CSS, a theme config) and follow it. This file is about **how** tokens are structured and named, so every component uses them and nothing else. If the project has no token system yet, build one on this structure before styling components.

## Three tiers

1. **Reference (primitives)**: raw values named by scale: `--gray-600`, `--space-4`, `--radius-2`, `--transition-duration-2`. Components never use these directly.
2. **System (semantic)**: named by role: `--color-surface`, `--color-text-muted`, `--color-action`, `--color-on-action`, `--color-danger`, `--color-border-control`, `--color-focus-ring`, `--space-field-stack`, `--radius-control`, `--shadow-raised`, `--font-ui`, `--text-body`, `--leading-body`, `--transition-duration-press`. This is the only tier that changes per theme.
3. **Component**: aliases of tier 2 scoped to one component (`--button-bg: var(--color-action)`), created only when a component genuinely needs its own knob (Curtis: do not globalise a decision one component made). Most components need none.

Shades are defined up front as a scale (Refactoring UI); no `color-mix()` or opacity tricks to derive text colours in components, because derived colours dodge the contrast check.

## Naming

- Role, not appearance: `--color-action`, never `--color-teal` outside tier 1; `--color-text-muted`, never `--color-gray-600` in a component.
- Prefer `start` and `end` to `left` and `right` in token names (`--space-control-inline`, `--radius-control`; a corner token such as `--radius-ss` is start-start), so tokens survive a mirrored layout.
- Pairs stay pairs: every coloured surface token has an `on-` partner that meets 4.5:1 on it (`--color-action` / `--color-on-action`), so contrast is decided once.
- Type roles, not sizes, in components: `--text-body`, `--text-label`, `--text-title`, each with its `--leading-*`, so line height comes with the role (`craft.md` section 7).
- Duration and easing tokens per motion kind (`motion.md`), not per component.

## Where they live (Tailwind v4)

- In a Tailwind v4 project, tier 1 and tier 2 are CSS custom properties in the global CSS file. Primitives are plain properties on `:root`, so no utility exists for them and a component cannot reach them. Roles go in `@theme` (values) or `@theme inline` (roles that point at a primitive, Tailwind's guidance when a theme variable references another). A project that wants a closed set resets Tailwind's own palette, sizes, radii, shadows and easings (`--color-*: initial` and so on). A later theme overrides roles in plain CSS on `:root` with `light-dark()`, or `[data-theme]` selectors.
- `oklch()` for the shade scales so steps are perceptually even; hex is acceptable in tier 1 only if the design system is delivered that way.
- Components use utilities generated from tokens (`bg-surface`, `text-muted`, `rounded-control`, `duration-press`) or `var(--…)` in the rare CSS file. Tailwind 4.3.3 builds a utility only from its own namespace, so the token's name decides whether the class exists: `--text-*` for sizes, `--transition-duration-*` for `duration-*`, `--transition-delay-*` for `delay-*`, `--ease-*` for `ease-*`. For colours, a per-utility namespace keeps a role to its one utility: `--text-color-*` makes only `text-*`, `--background-color-*` only `bg-*`, `--border-color-*` only `border-*`, `--outline-color-*` only `outline-*`; `--color-*` makes all of them and is kept for colours used several ways (a status ramp). Name a text colour and a type size apart (`text-muted`, `text-label`). A `--duration-press` token silently produces no `duration-press` class. Never `bg-[#…]`, `text-[13px]`, `rounded-[6px]`, `duration-[180ms]`: an arbitrary value is a missing token. A lint rule that rejects arbitrary values, spacing off the rhythm steps and any class Tailwind cannot build from the tokens keeps this honest; add one where the project has none.
- Dark mode is a token concern, not a component concern: roles change per theme (tier 2), so components need no `dark:` variants. If the project's component library already uses `dark:` variants, follow its convention.

## Adding a token

1. Prove the need: two components want the same value, or one component needs a value the design system does not define.
2. Add it at the right tier with a role name; if it is a colour, add its `on-` partner and record the contrast ratio in the design system's docs.
3. Use it; delete the arbitrary values it replaces in the same change.

A token no component uses after a month is removed.
