# Tokens in Truing: the token table, off-token detection, creating tokens, and Figma (2026-10-31)

Feeds Truing (TRU-1.4, TRU-11.6, TRU-11.2, TRU-11.5, TRU-19.3). The design team asked for five things:

- every app token visible;
- a click on anything showing its tokens and colours;
- an easy way to spot values that don't use our tokens;
- designers able to **create** a token in Truing, written into the app's tokens automatically;
- Figma kept in step.

This note answers how, on our stack: Tailwind CSS 4.3.1 with the theme in the project's token stylesheet, shadcn semantic variables in `:root`, and the project's spacing rule. Everything marked "verified" was run on 2026-10-31 in scratch folders outside the repository (`/tmp/tw-ds-spike`, `/tmp/eslint-spike`, `/tmp/next-hmr-spike`, `/tmp/sd-spike`), against a real project's token stylesheet.

## Questions

1. How do we load our design system in Node to list every token with its resolved value, resolve a class to a token, and tell whether a class is registered?
2. Which static lint flags off-token classes, and what does today's code base look like against it?
3. How does an inspector map a clicked element's computed styles to tokens?
4. How does Truing write a new token into the token stylesheet safely, and does it appear in `next dev` at once?
5. How do code tokens get to Figma, given our Professional plan?

## Research placeholders

- `[local]` the installed `node_modules/tailwindcss` and `@tailwindcss/node` 4.3.1: `__unstable__loadDesignSystem`, `theme.entries()`, `candidatesToCss`, `parseCandidate`, `canonicalizeCandidates`
- `[github]` how tailwindcss-intellisense (`packages/tailwindcss-language-server/src/util/v4/design-system.ts`), prettier-plugin-tailwindcss (`src/versions/v4.ts`) and eslint-plugin-better-tailwindcss (`src/tailwindcss/context.async.v4.ts`) load the design system
- `[web]` eslint-plugin-better-tailwindcss and eslint-plugin-tailwindcss changelogs; tailwindcss CHANGELOG (canonicalisation, #20310); vercel/next.js#93052
- `[web]` W3C DTCG 2025.10; Figma Variables REST API and rate-limit pages; Figma's native variable import and export; Style Dictionary 5.x; Tokens Studio; TokensBrücke
- `[local]` re-run the baseline with the commands under "Baseline" below

## Findings

### 1. The token table (verified)

**The API.** Tailwind 4.3.1 exposes its compiler's design system, and the editor tools all use it:

- IntelliSense, prettier-plugin-tailwindcss and better-tailwindcss all call `__unstable__loadDesignSystem`.
- Through `@tailwindcss/node`, it loads our the token stylesheet in about 60 ms. `@tailwindcss/node` is only a transitive dependency today, so add it as a dev dependency pinned to the tailwindcss version.
- `theme.entries()` returns every theme variable with an origin flag. We have **158 of our own, 98 `@theme inline` aliases and 359 Tailwind defaults**. Called with a `from` path, it also returns source offsets.
- **Registered?** Use `candidatesToCss([c])[0] !== null`. `getClassList()` (29,325 entries) is a suggestion list, not a registry.
- **Class → token.** Use `parseCandidate('hover:bg-primary/50')` (root `bg`, value `primary`, modifier `50`) with a small table from utility root to theme namespace. That worked on all 16 test classes, including `bg-primary/50`, `shadow-pane`, `-mt-400` and `max-w-reading`.

  Reading the `var()` name out of the generated CSS does not work. It fails for inline aliases, because `bg-primary` compiles to `var(--primary)`, and for shadows, which are inlined.

- **Semantic variables.** The design system never sees `:root`/`.dark`, so `resolveThemeValue('--color-primary')` stops at `var(--primary)`. A PostCSS pass over `:root` and `.dark`, plus a small resolver, completes every chain. Example: `--color-primary` → `--primary` (`:root`, line 669) → `--color-brand-1-600` → `#1c68d4`, or `#3d82f2` in dark.
- **Arbitrary → token.** `canonicalizeCandidates` maps exact-value arbitrary classes to our tokens for colour, radius and shadow:

  | Arbitrary class                            | Token class            |
  | ------------------------------------------ | ---------------------- |
  | `bg-[#1c68d4]`                             | `bg-brand-1-600`       |
  | `rounded-[12px]`                           | `rounded-xl`           |
  | `shadow-[0_4px_12px_0_rgb(24_27_36/0.05)]` | `shadow-floating-card` |

  **Spacing does not canonicalise.** `p-[12px]` stays, because the multiplier (`p-3`) and our named step (`p-400`) tie. Adding `@theme { --spacing: initial; }` to a copy of the CSS makes `p-[12px]` → `p-400`, but also removes `h-10`/`size-9`, so apply it to spacing roots only. The first canonicalise call costs about 5 s, and then about 60 µs per class.

- **"Compiles" is not "on token".**

  - `px-401` compiles, as 401 × 4 px, through the spacing multiplier.
  - A typo like `p-450` would be 1,800 px.
  - **243 Tailwind default colours** (`bg-red-50`, `bg-white`) stay registered next to our 72.

  The table must mark origin (ours, alias, Tailwind default) and the effective value.

- **Tailwind emits only used theme variables.** A page has no `--spacing-500` unless something uses it. That is why Figma Make's variable picker showed only a handful (`figma-make-teardown.md`). The inspector must read the table, not the page.

**Problems in the token stylesheet the table exposes**:

- `--radius-sm/md/lg` are declared as 4/6/8 px in `@theme` (lines 126–128), then overridden by `@theme inline` (lines 860–863) from `--radius: 0.75rem`. In effect `rounded-sm` and `rounded-md` are **8 px** and `rounded-lg` is **12 px**, the same as `rounded-xl`. `--radius-md` uses `- 4px` where shadcn's default is `- 2px`.
- `--color-app-br-neutral-static` exists only in `:root`, so one class in a component generates no CSS.
- `html { line-height: 25px }` (line 871) is not a token, and every element without a text style inherits it.
- The API is `__unstable__` with no semver promise, and canonicalisation output changes in most 4.x patches. Pin the version and snapshot-test whatever we build on it.

### 2. Static off-token lint (verified)

**eslint-plugin-better-tailwindcss 4.10.0** (2026-10-19; MIT; ESLint 7–10; tailwindcss ^4.1.17):

- It loads the design system from `entryPoint: 'the project's token stylesheet'`, in a worker via synckit, since ESLint rules are synchronous.
- Useful rules:
  - `no-unknown-classes` (renamed from `no-unregistered-classes`);
  - `no-restricted-classes`: regex plus message plus autofix, with capture groups;
  - `enforce-canonical-classes`: about 5 s startup.
- It finds classes in `className`, `cn`, `clsx`, `cva` (base strings, `variants.*` values, `compoundVariants`), `tv`, `twMerge`, and in variables named `className(s)`, `classes` or `styles`.
- There is no dedicated arbitrary-value rule. The pattern its docs suggest misses `bg-(--x)` and false-flags `group-data-[x]/tabs:` variants.

**Run against the project's components folder and the project's feature folders** (388 files, 14.9 s), it found:

| Finding                                                                                      | Count |
| -------------------------------------------------------------------------------------------- | ----- |
| Arbitrary values                                                                             | 1,503 |
| Standard-scale spacing classes, each with a correct the project's spacing convention autofix | 713   |
| Tailwind default colours                                                                     | 294   |
| Classes that generate no CSS                                                                 | 37    |
| Raw colours in `style`                                                                       | 8     |

The the project's spacing convention autofix rewrites, for example, `md:gap-2` → `md:gap-300`, `-ml-1` → `-ml-100` and `[&>*]:px-2` → `[&>*]:px-300`. Raw colours in `style` come from ESLint's built-in `no-restricted-syntax` with two selectors:

```js
{ selector: "JSXAttribute[name.name='style'] Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(/]" },
{ selector: "JSXAttribute[name.name='style'] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(/]" }
```

**The the project's spacing convention map** is one fixable `no-restricted-classes` entry per step, plus one non-fixable catch-all that allows `0`, `px`, `8` and `10` (the project's spacing 32 px and 40 px exceptions):

```js
const V = '^((?:[^\\s]*:)?)(-?)';
const SP =
  '(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)';
const ADR = {
  0.5: '50',
  1: '100',
  1.5: '200',
  2: '300',
  3: '400',
  4: '500',
  4.5: '600',
  5: '650',
  6: '700',
  7: '750',
  7.5: '800',
  9: '850',
  12: '900',
  15: '1000',
};
Object.entries(ADR).map(([s, t]) => ({
  pattern: `${V}${SP}-${s.replace('.', '\\.')}(!?)$`,
  fix: `$1$2$3-${t}$4`,
}));
```

**Two gaps:**

- **Module-level class constants** (`const panelTab = '…'`) are invisible to the lint. About 18% of arbitrary values (around 390) live in such constants, in at least 15 files. Closing this needs a naming convention or extra variable selectors.
- **Tailwind defaults dwarf everything else.** 1,281 default colours (`bg-white` 192, `text-gray-700` 138) and 2,050 default font sizes, including `text-sm` 976 and `text-base` 174, which match the project's body styles. Deciding which defaults count as tokens is a design call, needed before the lint can be an error.

**eslint-plugin-tailwindcss** has a stable 4.x line (4.4.0, 2026-08-21) with `cssConfigPath` and spacing-aware `no-unnecessary-arbitrary-value`. Its `no-arbitrary-value` regex misses `(--x)` and `[prop:value]`. better-tailwindcss is the better fit.

### 3. Runtime: from a clicked element to tokens (verified in Chromium 156)

| Authored                               | `getComputedStyle`                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `bg-primary`                           | `rgb(28, 104, 212)`                                                                |
| `bg-primary/50`                        | `oklab(0.535952 -0.0359195 -0.177948 / 0.5)`: CSS Color 5 mixes in the given space |
| `bg-red-50` (Tailwind default)         | `oklch(0.971 0.013 17.38)`                                                         |
| `px-400`, `rounded-lg`, `text-title-m` | `12px`, `12px`, `16px / 18px / 700`                                                |
| `shadow-floating-card`                 | four transparent placeholder layers, then the real shadow                          |

- **Match on classes first, values second.** Values alone are ambiguous: `#fff` is grey-100, white and primary-foreground at once. So the inspector reads the element's classes through the table first. It matches by value only for styles that don't come from classes, and labels them "matches by value".
- **Value matching** uses colorjs.io (already in `node_modules` through axe-core) and ΔE2000:
  - `oklab(… / 0.5)` resolves to brand-1-600 at 50%;
  - `rgb(51, 51, 51)` is off-token, nearest grey-700 at ΔE 16.2.
- **Authored, inherited or default.** Under Playwright or an extension, CDP's `CSS.getMatchedStylesForNode` returns three kinds of rule:

  - authored rules (with `var(--spacing-200)` intact);
  - user-agent rules;
  - inherited rules per ancestor.

  Tailwind's reset also shows as authored, so classify by cascade layer.

  In the page itself:

  - classes and the `style` attribute are authored;
  - an equal inherited value on the parent means inherited;
  - a blank element of the same tag gives the browser default.

- **No open-source tool does this.**
  - VisBug shows resolved values and says it is not a design-system enforcer.
  - Project Wallace doesn't understand `@theme`.
  - Design System Inspector (MIT, 3 stars) has the closest "does this `var()` produce the rendered value" logic.
  - Figma's Design Lint and "Check designs" are good references for ranking suggestions.
- **Dark mode is out of scope.** Nothing toggles `.dark` today: next-themes is installed but unused, and there are only 3 `dark:` classes.

### 4. Creating a token from Truing (verified)

**Where each kind goes:**

| Token          | Location in the token stylesheet                                                                              | Also needs                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Palette step   | `@theme`, its family group (lines 35–121)                                                                     | —                                                                        |
| Spacing step   | `@theme` spacing block (136–152), in numeric order                                                            | —                                                                        |
| Radius         | `@theme` (124–133), but sm/md/lg are overridden in `@theme inline` (860–863)                                  | —                                                                        |
| Text style     | `@theme` (204–226), with `--x--line-height` and `--x--font-weight`                                            | the tailwind-merge `font-size` group in the project's class-merge helper |
| Shadow         | `@theme` (195–200, 230)                                                                                       | the tailwind-merge `shadow` group                                        |
| Semantic alias | `:root` (652) **and** `.dark` (736) inside `@layer base`, plus `--color-x: var(--x)` in `@theme inline` (817) | —                                                                        |

Stock tailwind-merge drops a new text-style token next to `text-primary`, and doesn't merge a new shadow. **Generate the tailwind-merge config from the token table** so it can't drift.

**Writing it.** A PostCSS AST edit that copies the neighbouring declaration's whitespace is surgical. An unedited round-trip is byte-identical, and the diff is only the inserted lines. shadcn's own CSS merge would create duplicate `:root`/`.dark` blocks for our file, because ours sit inside `@layer base`.

**Checks before writing:**

- the name matches the patterns, and spacing goes between its neighbours;
- the key doesn't already exist. If it is ours, edit instead of adding. If it is a Tailwind default, adding it changes every existing use (e.g. `--color-orange-950`);
- the new class doesn't already compile to something else. `p-450` means 1,800 px today, so scan the source for uses;
- shared roots are handled: `text-` is colour and size, `shadow-` is shadow and colour;
- near-duplicates: propose reuse under ΔE2000 ≈ 1.0. Our closest existing pair, grey-200/grey-300, is 1.13. `#1d69d5` → brand-1-600 (ΔE 0.36). For spacing, an exact px match means reuse; otherwise show the nearest step;
- the edited CSS compiles before saving.

**Hot reload: a bug in our installed version.**

- On **tailwindcss 4.3.1**, editing the token stylesheet under Turbopack lags one edit behind. A new `@theme` variable doesn't apply within 20 s, nor after a full page reload. A new class in a `.tsx` file applies in about 250 ms.
- Cause, isolated in plain Node: `@tailwindcss/postcss` 4.3.1 chooses a full or incremental rebuild from the file's mtime, not its content.
- **4.3.3 fixes it** (#20310, 2026-07-16; within our `^4.3.1` range): a new variable shows in 1.35 s, and a token plus class change in about 2.8 s, with no reload. Related next.js#93052 ("CSS HMR lags one revision") is still open.
- On 4.3.1, a second write with changed content works around it; touching mtime alone doesn't. **Upgrade before TRU-11.5**.

**Applying the token to the element.** In the code base:

| How `className` is written | Share                  |
| -------------------------- | ---------------------- |
| Plain strings              | 80.1% (4,737 of 5,917) |
| Identifiers or props       | 9.6%                   |
| `cn()`                     | 8.1%                   |
| Template literals          | 1.4%                   |

There are also 23 `cva()` calls. One cheap, robust editor: ESLint's Node API with a one-off `no-restricted-classes` `{pattern, fix}`, applying only the fix whose range sits inside the selected element. The edit engine (TRU-4.1) chooses between this and a Babel + MagicString splice.

**Existing tools don't do this.** tweakcn copies or installs whole shadcn-shaped themes. Onlook needs `tailwind.config` and has no `@theme` support. The writer is ours to build.

### 5. Figma (partly verified)

- **DTCG.** W3C DTCG 2025.10 is the first stable format (2025-10-28). Colours are `{colorSpace, components, alpha, hex}`; dimensions are `{value, unit: px|rem}`.
- **The Variables REST API** (read and write) is **Enterprise only**; Professional gets a 403. View/Collab seats get up to 20 Tier-1 requests a month, and the Figma MCP on a View seat is "up to 20 per month". Full or Dev seats on Professional get "up to 200 per day".
- **Native import and export.** Figma imports and exports variables as DTCG JSON per mode on Professional: px only, sRGB/HSL colours, no text or effect styles. View seats can't run plugins.
- **Style Dictionary 5.7.1** can emit an `@theme` block from DTCG.
- **Cheapest one-way sync** for the code-first decision: generate DTCG files per mode (px, hex) from the token table, and a designer with a Full seat runs Figma's native "Import mode". It costs nothing. Text and effect styles stay manual, or go through Tokens Studio's free export. For a one-off Figma → code backfill, TokensBrücke opens a PR with DTCG files.

### Baseline

Run once on one real project of about 600 `.tsx` files, the regex count found about 2,200 arbitrary values, 2,000 standard-scale spacing classes, 150 raw colours in classes and 140 `style={{}}` objects. An AST cross-check of the contexts a lint can see found about 1,800, 1,930 and 143. So a project like this starts with thousands of findings. That is why TRU-11.6 starts at warn, with a recorded baseline and a ratchet.

# from the repository root

files() { find "$1" -name '_.tsx' -not -path 'src/shared/icons/_' -print0; }
ARB='(?<![\w-])-?[a-z][a-z0-9]_(?:-[a-z0-9]+)_-(?:\[[^\]\s]+\]|\((?:[a-z-]+:)?--[\w-]+\))(?!(?:/[\w-]+)?:)(?![\w-])|(?<![\w\]-])\[(?:--)?[a-z][a-z-]_:[^\]\s]+\](?!(?:/[\w-]+)?:)(?![\w-])'
COLOR='#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\('
SP='(?<![\w-])-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy])-(?!(?:50|100|200|300|400|500|600|650|700|750|800|850|900|1000|1100|1200|1300)(?![\w.]))(?:\d+(?:\.\d+)?|px)(?![\w.-])'
STYLE='style=\{\{(?:[^{}]|\{[^{}]_\})*?\}\}'
for d in src the project's components folder the project's feature folders src/app; do
print -- "$d a=$(files $d | xargs -0 grep -ohP "$ARB" | wc -l) b_class=$(files $d | xargs -0 grep -ohP "$ARB" | grep -cP "$COLOR") b_style=$(files $d | xargs -0 grep -ozhP "$STYLE" | tr '\0' '\n' | grep -oP "$COLOR" | wc -l) c=$(files $d | xargs -0 grep -ohP "$SP" | wc -l) d=$(files $d | xargs -0 grep -oh 'style={{' | wc -l)"
done

```

## Recommendation

1. **Token manifest (TRU-1.4).** One Node module built from the design system (`@tailwindcss/node`, pinned), plus PostCSS for `:root`/`.dark`, a chain resolver, and the root → namespace table. For each token it outputs:

   - the origin (ours, alias, Tailwind default);
   - the source line;
   - light and dark values;
   - normalised values (hex, oklab, px).

   It serves JSON to the inspector, a function API to the lint and the writer, and generates the tailwind-merge groups. It is snapshot-tested.

2. **Static lint (TRU-11.6).**
   - better-tailwindcss with `no-unknown-classes`, and `no-restricted-classes` covering the the project's spacing convention map with autofix, arbitrary values (including `(--x)` and `[prop:value]`) and Tailwind default colours.
   - `no-restricted-syntax` for `style`.
   - Start as **warn** on the project's UI folders and new files, per the project's spacing grandfathering.
   - Before any error level: decide which Tailwind defaults count as tokens (`text-sm`, `text-base`), and settle a convention for class constants.
3. **Runtime inspector (TRU-2.1, TRU-11.2).** Classes → table first. Inline styles are flagged. Values matched by ΔE or px only where no class explains them.
4. **Token writer (TRU-11.5).** A PostCSS edit at the right block, with the checks above. Upgrade to tailwindcss and @tailwindcss/postcss **4.3.3** first.
5. **Figma (TRU-19.3).** Code → DTCG JSON → Figma's native variable import, by a designer with a Full seat.

**What we accept:** reliance on an `__unstable__` API (pinned, behind one tested adapter), in exchange for exact parity with what Tailwind actually compiles.

**What would change this:** Tailwind publishing a stable design-system API (we would switch to it), or a Figma plan moving to Enterprise (REST sync becomes possible).

## Not verified

- Hot-reload behaviour inside a real app itself and on macOS. It was tested in a minimal Next 16.2.9 app on Linux, and the bug is intermittent.
- Whether a View seat can use Figma's native variable export.
- Whether `get_variable_defs` counts toward the MCP limit (likely).
- TokensBrücke's licence.
- The status of `@tailwindcss/turbopack`.

## Sources

- Installed packages: `node_modules/tailwindcss` 4.3.1 and `@tailwindcss/node` 4.3.1 (APIs exercised directly). Primary.
- tailwindcss CHANGELOG and PR #20310 (2026-07-16): `https://github.com/tailwindlabs/tailwindcss`. Primary.
- vercel/next.js issue #93052. Primary.
- eslint-plugin-better-tailwindcss 4.10.0: `https://github.com/schoero/eslint-plugin-better-tailwindcss` (`src/tailwindcss/context.async.v4.ts`, rules docs, CHANGELOG #244). Primary, and run.
- eslint-plugin-tailwindcss 4.x: `https://github.com/francoismassart/eslint-plugin-tailwindcss` (CHANGELOG, README). Primary.
- tailwindcss-intellisense `packages/tailwindcss-language-server/src/util/v4/design-system.ts`; prettier-plugin-tailwindcss `src/versions/v4.ts`. Primary.
- CSS Color 5 §10.1 (Working Draft, 2026-10-29): `https://www.w3.org/TR/css-color-5/`. Standard.
- W3C Design Tokens Community Group format 2025.10: `https://www.designtokens.org/tr/2025.10/`. Standard.
- Figma REST API variables and rate-limit pages: `https://developers.figma.com/docs/rest-api/variables/`, `https://developers.figma.com/docs/rest-api/rate-limits/`. Official.
- Style Dictionary 5.7.1: `https://styledictionary.com/`. Official, and run.
```
