---
id: TRU-1.4
title: 'A token manifest and class ↔ token resolver generated from the token stylesheet'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-10-31 21:35'
labels:
  - tokens
dependencies: []
type: feature
ordinal: 10040
parent_task_id: TRU-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Most of Truing needs one answer: for any token or class, what is it, and what is its value? The inspector shows token names (TRU-2.1), off-token flags need the nearest tokens (TRU-11.2), the panels offer only tokens (TRU-4.2, TRU-4.3), token creation checks for clashes and near-duplicates (TRU-11.5), the lint needs the scale (TRU-11.6), and the Figma export reads every token (TRU-19.3). Today nothing in the repo can answer it. Figma Make's own variable picker only lists the variables the page happens to emit, Tailwind internals included (`docs/research/figma-make-teardown.md`).

The research (`docs/research/token-inspection-and-authoring.md`, verified on our real the token stylesheet) settles how:

- **Theme tokens.** Tailwind 4.3.1's `__unstable__loadDesignSystem` (through `@tailwindcss/node`) loads our CSS in about 60 ms. `theme.entries()` returns 158 of ours, 98 `@theme inline` aliases and 359 Tailwind defaults.
- **Semantic variables.** A PostCSS pass resolves the shadcn semantic variables in `:root` and `.dark`, which the design system never sees.
- **Lookups.** `parseCandidate`, plus a root → namespace table, maps classes to tokens. `candidatesToCss` tells whether a class is registered.

The manifest must report **effective** values. `--radius-sm/md/lg` are declared twice, and the later `@theme inline` block wins. It must also mark Tailwind defaults as such: `px-401` and `bg-red-50` compile, but they aren't ours.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **The manifest.** A module in the package (ADR 0001), which reads the token stylesheet named in `truing.config.ts`, loads the project's token stylesheet and produces a manifest. For every token it gives: name and category: colour, spacing, radius, text style (with line height and weight), shadow, font, container, animation; origin: ours, inline alias or Tailwind default; source file and line; effective light and dark values; normalised values: hex, oklab and px.
- [x] #2 **Semantic chains.** Semantic tokens resolve through their chains. `--color-primary` → `--primary` → `--color-brand-1-600` → `#1c68d4` (dark `#3d82f2`) is a test case.
- [x] #3 **Lookups.** `tokenForClass('bg-primary/50')` returns `primary` at 50% opacity. `tokenForClass('px-401')` returns "compiles, not a token". `isRegistered(c)` uses `candidatesToCss`, not `getClassList`.
- [x] #4 **tailwind-merge from the manifest.** The tailwind-merge groups in the project's class-merge helper (`font-size`, `shadow`) are generated from the manifest, or checked against it by a test, so they can't drift when tokens are added.
- [x] #5 **Version pinned.** `@tailwindcss/node` is a pinned dev dependency, matched to `tailwindcss`. A snapshot test of the manifest fails loudly when an upgrade changes it.
- [x] #6 **Command.** `pnpm tokens:manifest` (name may change) writes the JSON for Truing and prints a summary: counts by category and origin, plus shadowed declarations.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
The maintainer asked for the Tailwind bump in this task too, so the version change lands here (its hot-reload timing and screenshot criteria stay with the Tailwind bump).

1. **Bump.** `tailwindcss` and `@tailwindcss/postcss` go from `^4.3.1` to exactly `4.3.3` in the root; Truing pins `tailwindcss`, `@tailwindcss/node`, `postcss` and `colorjs.io` (0.5.2, already in the lockfile through axe-core). The compiled CSS for every candidate in `src` is diffed before and after (oxide scanner plus `compile`, the same path `@tailwindcss/postcss` takes) and the difference is recorded in the Tailwind bump.
2. **Loading** (`src/tokens/design-system.ts`). `tailwindcss`'s own `__unstable__loadDesignSystem` with `from` set and a small stylesheet resolver (the `style` export condition), so every theme entry carries its source file and offset; `@tailwindcss/node`'s wrapper drops `from`. Its `loadModule` handles any `@plugin`. The loader refuses to run when the app's installed `tailwindcss` differs from Truing's pin.
3. **The manifest** (`manifest.ts`, `values.ts`). One PostCSS pass over the token stylesheet collects every `@theme` / `@theme inline` declaration (so shadowed ones are reported) and the `:root` and `.dark` variables. Each token: key, name, category, origin (`ours`, `alias` for our `@theme inline`, `default` for Tailwind's, `library` for an imported stylesheet such as tw-animate-css), source file and line, the effective value, light and dark values resolved through their `var()` chains, and hex, oklab and px. Text styles carry their line height and weight. The semantic variables are listed beside the tokens.
4. **Lookups** (`lookup.ts`). `tokenForClass` parses with `parseCandidate` and maps the utility root to theme namespaces through one table; `isRegistered` is `candidatesToCss(...)[0] !== null`.
5. **tailwind-merge.** `pnpm tokens:manifest` writes the generated `tailwind-merge-tokens.json` (our text styles and shadows), which the project's class-merge helper imports in place of its hand-written lists. A studio test fails when the committed file differs from what the manifest gives.
6. **Command.** `pnpm tokens:manifest` writes the manifest to `node_modules/.cache/truing/tokens.json` and prints counts by category and origin, the declarations shadowed inside our stylesheet, and how many of the project's tokens replace a Tailwind default.
7. **Tests** (Vitest, `test/unit/tokens*.test.ts`): the `--color-primary` chain on the real the token stylesheet; `bg-primary/50`, `px-401` and `isRegistered`; effective radius values; the tailwind-merge drift check; the pinned-version check; and a file snapshot of the manifest built from a frozen fixture stylesheet, which changes only when Tailwind does. Truing's CI job also runs on the project's token stylesheet, the generated `tailwind-merge-tokens.json`, `package.json` and `pnpm-lock.yaml`, and installs the app's packages, since the manifest reads the app's `tailwindcss` and `tw-animate-css`.

**Proof per criterion:** manifest and chains, lookups and tailwind-merge by the unit tests above; version pin by the version test and the lockfile; command by its printed output; app unchanged by `pnpm typecheck`, the `cn` Jest tests and the CSS diff.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No PR yet.

**What changed**

- **Tailwind 4.3.3** . `tailwindcss` and `@tailwindcss/postcss` are now exact pins in the root, no longer `^4.3.1`. Truing pins `tailwindcss`, `@tailwindcss/node`, `postcss` 8.5.15 and `colorjs.io` 0.5.2. The lockfile also moved some transitive versions: vite's `postcss` 8.5.6 → 8.5.15, `nanoid` 3.3.11 → 3.3.15 under `postcss@8.4.31`, and `@jridgewell/trace-mapping` 0.3.25 → 0.3.31. The CSS comparison and the hot-reload timings are in the Tailwind bump.
- **`src/tokens/`.**
  - `design-system.ts` holds the only calls to the `__unstable__` API, plus the version check.
  - `manifest.ts` and `values.ts` do the PostCSS pass, the `var()` chains, and the hex, oklab and px forms.
  - `lookup.ts` has `tokenForClass` and `isRegistered`.
  - `table.ts` has `loadTokens` and `tailwindMergeGroups`.
  - `report.ts` and `cli.ts` are `pnpm tokens:manifest`.
- **tailwind-merge.** the project's class-merge helper reads the generated the generated `tailwind-merge-tokens.json`. Both it and the fixture snapshot are in `.prettierignore`: Prettier rewrote the snapshot and would churn the generated file.
- **Config and CI.** `truing.config.ts` gains `tailwindMerge`. Truing's CI job also runs on the token stylesheet, the generated file, `package.json` and the lockfile. It now installs the app's packages as well, since the token stylesheet imports `tailwindcss` and `tw-animate-css` from there.

**Decisions taken here (say if any should change)**

- Theme entries come from `tailwindcss`'s own loader with a small stylesheet resolver. `@tailwindcss/node`'s wrapper accepts only `{ base }` and drops `from`, so its entries carry no source line. `@tailwindcss/node` is still pinned, and its `loadModule` handles any `@plugin`.
- A fourth origin, `library`, covers tokens from an imported stylesheet (49 from tw-animate-css). They are neither ours nor Tailwind's.
- Truing's pins sit in its `dependencies`, like its other runtime packages; the whole package is dev-only (ADR 0001). The criterion said "dev dependency".
- The root → namespace table is derived from the design system on the first lookup (about 120 ms), not written by hand. Only the four shadow roots are listed, because Tailwind inlines shadow values.
- Dark values assume `.dark` sits on the root element. Nothing applies `.dark` today.

**Per criterion**

- **Manifest: met.** It holds 587 tokens: 143 ours, 43 aliases, 352 Tailwind defaults, 49 library. Each has its category, origin, file and line, effective value, light and dark values, and hex, oklab and px where they apply. Text styles carry their line height (in px) and weight. The semantic variables are listed beside the tokens. Effective values come from the last declaration: `rounded-sm` and `rounded-md` are 8 px, `rounded-lg` 12 px.
- **Chains: met.** `--color-primary` → `--primary` → `--color-brand-1-600` gives `#1c68d4`, and `--color-brand-1-500` gives `#3d82f2` in dark. This is a test.
- **Lookups: met.** `bg-primary/50` is `primary` at opacity 0.5. `px-401` is `{ status: 'compiles', reason: 'bare-value' }`. `isRegistered` uses `candidatesToCss`, and a test shows `px-401` registered while missing from `getClassList()`.
- **tailwind-merge: met.** The groups are generated. A studio test fails when the committed file differs; tried by removing `label-xs`, and it failed. A new test on the project's side (21 cases) pins `cn()` and passes before and after the switch.
- **Version pinned: met, but the pins are in `dependencies`; see the decisions above.** A test fails unless the four pins agree. The loader refuses an app whose installed `tailwindcss` differs. The file snapshot of a frozen fixture holds Tailwind's defaults, so an upgrade changes it: 4.3.3 prints `oklch(97% 0 none)` where 4.3.1 printed `oklch(97% 0 0)`.
- **Command: met.** `pnpm tokens:manifest` prints counts by category and origin, the three radius keys declared twice (`@theme` lines 130–132, overridden by `@theme inline` at 864–867), and that 54 of ours replace a Tailwind default. It writes `node_modules/.cache/truing/tokens.json` and the tailwind-merge file.
- **PR: not opened.**

**How it was verified**

- `pnpm --filter truing test`: 106/106, 48 of them in `tokens.test.ts`.
- `pnpm --filter truing typecheck` and `pnpm typecheck`: clean.
- `pnpm exec eslint` on the changed files: no errors; the only warnings are `no-console` in the CLI, as in Truing's existing `cli.ts`.
- The integration suites were not run: they need the Docker test containers, and they touch `cn` only through imports.

**What the task review found, and what was done**

- The hand-written root table missed roots that read the project's tokens (`pbs-`, `inset-bs-`, `scroll-pe-`, `border-spacing-`, `min/max-inline-`, `columns-`, `translate-z-`). **Fixed** by deriving the table. A test now walks every root against every emitted token of ours (over 1,000 classes) and expects each to resolve.
- `w-100/2` was read as `spacing-100` with a modifier. **Fixed**: it is a fraction.
- Theme colours overridden in `.dark` were listed as variables with no light value. **Fixed**. The fixture snapshot caught a first attempt that also hid our `:root` `--radius`; it is now tested.
- The pins in `dependencies` and the unopened PR are left as above.

**Left for a person**

- Whether `library` as a fourth origin, and the pins in `dependencies`, are what you want.
- Truing has no token UI yet; that starts with TRU-2.1. The manifest is a library for it, the lint (TRU-11.6) and the writer (TRU-11.5).
- TRU-11.5 note: Truing's `writable` list will need the generated `tailwind-merge-tokens.json` when token creation regenerates it.

### Decisions

- **Origins:** keep `library` as a fourth origin (tw-animate-css's 49 tokens), beside ours, alias and default.
- **Pins:** exact `4.3.3` in the root; Truing's pins stay in its `dependencies`.
- **CI:** keep Truing job's extra triggers (the token stylesheet, the generated file, `package.json`, the lockfile) and the app install.
- **Token UI:** a read-only Tokens section in Truing becomes its own task, TRU-11.1, rather than waiting for TRU-2.1.
<!-- SECTION:FINAL_SUMMARY:END -->
