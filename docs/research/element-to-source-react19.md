# Clicking an element to get its source, component and instances on React 19 + Turbopack (2026-10-31)

Feeds Truing (TRU-1.1, TRU-2.1, TRU-2.2, TRU-4.1). Truing needs four things for any element a designer clicks:

1. the `file:line:col` of the JSX that rendered it, and of the component call site that owns it (where `<Button>` is used, not only `button.tsx`);
2. the component's name, props and cva variant;
3. every other instance of the same component on the page;
4. a way to write a change back to that source.

React 19 removed the old `_debugSource` path, and we run Next 16.2.9 on Turbopack. This note says what works now. Everything was checked against a real project's dev output on 2026-10-31; scratch scripts and downloads stayed outside the repo.

## Questions

- What replaced `fiber._debugSource`, and how reliable is it under Turbopack?
- Which existing libraries resolve elements to source on our stack?
- Runtime fibers or compile-time attributes: which gives both the primitive's location and the call site?
- How do we find all instances of a component, including those rendered by Server Components?
- Can we read props and cva variants?
- How should a change be written back?

## Research placeholders

- `[github]` react/react: `packages/react/src/jsx/ReactJSXElement.js`, `ReactFlightClient.js`, `CHANGELOG.md`; PRs #28265, #29032, #32426, #32529
- `[github]` vercel/next.js at `v16.2.9`:
  - `packages/next/src/client/app-find-source-map-url.ts`
  - `packages/next/src/server/lib/source-maps.ts`
  - `packages/next/src/server/dev/middleware-turbopack.ts`
  - `crates/next-core/src/next_shared/transforms/swc_ecma_transform_plugins.rs`
- `[github]` aidenybai/bippy (`bippy/source`), aidenybai/react-grab (`next-server-frames.ts`, primitives), zh-lx/code-inspector, shadcn-ui/ui (`packages/registry/src/codemod/edits.ts`, `transformers/transform-tw-prefix.ts`)
- `[docs]` `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md` (rules, conditions)
- `[local]` re-run the offline check: map every `jsxDEV` call site in `.next/dev` through its `.js.map` and compare with the compiler's recorded position

## Findings

### The real project, as it was on 2026-10-31

- **React version.** The App Router runs Next's bundled React **19.3.0-canary** (`node_modules/next/dist/compiled/react`), not the 19.2.7 in `package.json`. The internals Truing reads come from that build.
- **Source positions still exist.** SWC still emits `{fileName: "[project]/src/…", lineNumber, columnNumber}` into every `jsxDEV(...)` call, in both client and RSC chunks. React ignores it.
- **Dev source maps.** They are index maps with `sections`. Sources are absolute `file:///…` paths, `sourcesContent` is inlined, and every chunk ends with `//# sourceMappingURL=<chunk>.js.map`. Columns are 1-based UTF-16, the same units as Babel.
- **Button:**

  - `Button` is a `forwardRef` with `displayName = 'Button'`;
  - `asChild` goes through Radix Slot;
  - it sets `data-slot="button"`.

  Only 9 of the 22 primitives set `data-slot`. cva is used in 15 files.

- **Class merging and formatting.** `cn` is clsx plus `extendTailwindMerge`, with custom font-size and shadow groups. Prettier is `{singleQuote: true}` with no Tailwind plugin, so class order is as written.
- **Build tooling.** No React Compiler and no Babel config. Sentry wraps the Next config.
- **Stale build output.** `.next/dev` holds chunks of mixed age: one was built for a file version older than the file on disk. **Positions must be re-checked against the file on disk before any write.**

### What replaced `_debugSource`

- **Removal.** React removed `fiber._debugSource` and stopped using `__source` in [react#28265](https://github.com/react/react/pull/28265) (2024-02-07).
- **Replacement.** Dev builds now capture `Error("react-stack-top-frame")` on every JSX call as `element._debugStack` (with `Error.stackTraceLimit = 10`), plus a `console.createTask`. This came in #29032 (2024-05-09) and lost its flag in #32426 (2025-03-04). Fibers copy `_debugOwner`, `_debugStack` and `_debugTask`.
- **Walking the chain.** For a `<button>` rendered by `Button`:

  - the host fiber's stack points at the primitive's JSX (`ui/button.tsx:70:7`);
  - its owner (the `Button` fiber) points at the feature call site;
  - the chain continues upward.

  **One walk gives both locations Truing needs.**

- **`captureOwnerStack()` doesn't help.** It arrived in React 19.1.0, but returns `null` outside React-controlled functions such as a custom DOM event handler ([react.dev](https://react.dev/reference/react/captureOwnerStack)). A click-time inspector reads `fiber._debugStack` directly, as bippy, React DevTools, React Grab and LocatorJS v2 do.
- **Resolving a stack to `file:line`:**
  1. Parse the V8 stack. bippy uses `Error.prepareStackTrace` call sites, which also give the enclosing function's start, i.e. the definition.
  2. Drop React's own frames.
  3. For each remaining frame, fetch the chunk's `.map` (index maps included) and look the position up.
  4. Server frames arrive as `about://React/<Env>/file:///…/.next/dev/server/chunks/ssr/…js?N`. `<Env>` can be `Server`, `Prerender`, `Prefetch` or `Prefetchable` in 16.2.9, so never hardcode it. Next resolves these through `POST /__nextjs_original-stack-frames` (`middleware-turbopack.ts`), which React Grab already calls.
- **Accuracy.** Offline, all 24,102 JSX call sites in the existing `.next/dev` output (13,285 client, 10,817 server) mapped through Turbopack's own maps to exactly the position the compiler recorded.
- **Known weak spots:**
  - **The owner-stack cap.** After 10,000 elements created since the last reset (resets come at render start, at most once a second), React stops capturing and shares an "unknown" stack (#32529). A very large first render can lose locations.
  - **`cloneElement`.** It keeps the original element's stack. With Radix `asChild` the owner becomes Slot, so walk the parent chain (`.return`) to find the Button.
  - **Internal endpoints.** Next's `/__nextjs_original-stack-frames`, `/__nextjs_source-map` and `/__nextjs_launch-editor` are undocumented. They are unchanged between 16.2.9 and 16.4.3, but need a contract test.
  - **A possible Next change.** Draft [vercel/next.js#96071](https://github.com/vercel/next.js/pull/96071) would add an option to drop `sourcesContent` from maps.
  - **React Compiler.** It breaks client maps today (#94450, open). It isn't enabled here.
  - **Browsers.** Firefox and Safari lack the call-site API. Tools fall back to string parsing there and lose definition positions; Truing can target Chromium.

### The building blocks

| Library (latest)                                      | Works on Next 16 + Turbopack + React 19                         | How it finds source                                                                                                                                                                                                                                                                                           | Verdict                                                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **bippy** 0.7.3, MIT                                  | Yes; 0.7.1 fixed activation under Next dev's react-refresh hook | `bippy/source`: `getSource`, `getOwnerStack`, index maps, server-frame marking. Core: `getFiber`, `getLatestFiber`, `traverseFiber`, `getType` (unwraps memo/forwardRef)                                                                                                                                      | **Base layer.** Pin the exact version: it reads React internals, and 0.7.0 removed APIs                                                                            |
| **react-grab** 0.2.0, MIT                             | Yes; its e2e app runs `next dev --turbopack` on Next 16         | bippy plus client maps; server frames via `/__nextjs_original-stack-frames`; treats `components/ui/` as shared UI and reports the feature call site                                                                                                                                                           | Reuse `react-grab/primitives` (`getElementContext`, `getElementAtPoint`, `freeze`). It has no props, variants, instances or editing; 0.2.0 removed its style panel |
| **code-inspector-plugin** 2.0.9, MIT                  | Yes, through `turbopack.rules`                                  | A loader adds `data-insp-path="file:line:col:tag"`, preferring the caller's value: **the DOM keeps the call site and loses the primitive's location**. Its loader passes the input map through unchanged, so columns after an insertion drift. It once prepended `'use client'` to server files (#521, fixed) | Precedent only. **Its Claude SDK mode defaults to `bypassPermissions`**                                                                                            |
| LocatorJS (0.5.1 on npm; v2 merged 2026-10-30)        | Turbopack rule documented                                       | Babel loader adds `data-locatorjs`; v2 also reads `_debugStack`                                                                                                                                                                                                                                               | No: built for opening the IDE                                                                                                                                      |
| click-to-react-component 1.1.3                        | **No**                                                          | Reads `_debugSource` only                                                                                                                                                                                                                                                                                     | Dead on React 19                                                                                                                                                   |
| Agentation 3.1.2 (PolyForm Shield)                    | React 18+                                                       | `_debugSource`, else parses `e.stack` **without source maps**; likely chunk paths under Turbopack (not verified live)                                                                                                                                                                                         | Copy its queue-plus-MCP pattern                                                                                                                                    |
| React DevTools 8.0.0 / `react-devtools-cdt-mcp` 0.1.0 | Yes                                                             | Owner stacks; Server Components as virtual entries; the experimental MCP returns raw, unmapped stacks                                                                                                                                                                                                         | Watch it; `react-devtools-inline` could power a props panel later                                                                                                  |
| Next dev overlay and `/_next/mcp`                     | Yes, on by default in 16.2.9                                    | Fixed tools: `get_project_metadata`, `get_errors`, `get_page_metadata`, `get_logs`, `get_server_action_by_id`, `get_routes` (16.4.3 adds compile and request tools)                                                                                                                                           | Route, segment and error context only. It can't carry a selection                                                                                                  |

### Runtime fibers vs compile-time attributes

- **Locations.** Runtime gives both locations: the host JSX plus the owner chain. One injected attribute gives one location, and whichever comes last in `{...props}` order wins. Two attributes would work, but carrying the call site down depends on every component spreading its props.
- **Where attributes win.** They don't depend on React internals, they survive the 10,000-element cap, and they locate HTML from Server Components without Next's internal endpoints.
- **The fallback, if needed.** Use a **Turbopack loader** (`turbopack.rules` with `{not:'foreign'}` and `development` conditions; parse with `@babel/parser`, edit with MagicString, return a precise map). It annotates **HTML elements only**, behind its own env flag. Rules for it:
  - Don't add a Babel config, because Turbopack switches Babel on when it finds one.
  - Don't limit it to `browser`: the attribute must be identical in the RSC, SSR and client passes, or hydration breaks.
  - Expect roughly 50 bytes per element in the HTML and RSC payload.
- **Not SWC Wasm plugins.** Their binary interface is tied to Next's embedded swc_core: 57 in 16.2.9, 73 in 16.3, 79 in 16.4.3. A plugin breaks with every minor upgrade.
- **An untested option.** A `jsxImportSource` wrapper could capture the source argument SWC still emits. That would give exact positions with no cap and no parsing, if Turbopack honours it in every layer.

### Instances

- **Group by the resolved `fiber.type`, not `elementType`.**

  - After a Fast Refresh edit, React re-resolves `type` but keeps the old `elementType`.
  - ForwardRef (tag 11, our Button): `type` is the `{render}` object.
  - Simple memo (tag 15): `type` is the inner function. Full memo (tag 14): the inner component is a child fiber.
  - Lazy: `type` is the resolved component.

  Read through `getLatestFiber`, since the DOM's `__reactFiber$` can point at the stale copy. Keep a second key (display name plus definition file) for selections held across an edit.

- **Collecting the DOM.** Walk every root and group fibers by that key. Collect each instance's top-level host nodes, and descend into portals (a Radix dialog's DOM lives elsewhere).
- **Server Components** have no client fiber. The RSC client attaches `ReactComponentInfo {name, env, key, owner, stack, props, debugStack, debugLocation}` to `fiber._debugInfo`, and sets it as `_debugOwner` on the elements they created. Group by name plus definition location, since names alone collide.

### Props and variants

- **Client props.** `getLatestFiber(f).memoizedProps` gives the call-site props (`variant`, `size`, `className`, …), not the final merged class.
- **cva variants have to be parsed from source.** cva 0.7.1 returns a plain closure and keeps its config private. Parse each `cva()` call's `variants`, `defaultVariants` and `compoundVariants` statically; shadcn's `transform-tw-prefix.ts` is a template. Link components to their cva function by file. The effective variant is the prop, falling back to the default.
- **Server Component props** are a dev-only, depth-limited snapshot. Show them read-only.

### Writing a change back

**Tools that already do this:**

- **shadcn's registry.** It moved from ts-morph to a Babel parse plus splicing text at offsets (`codemod/edits.ts`).
- **Onlook.** It regenerates from the Babel AST with `@babel/generator`, then runs Prettier.
- **recast/jscodeshift.** It reprints only the nodes you change.
- **SWC and oxc printers.** They reprint whole files.

**The recipe:** `@babel/parser` → MagicString splice → the repo's own `cn`/tailwind-merge config → `prettier.format` with `resolveConfig`. Hash-check the file against what the overlay saw before writing, and re-select after hot reload.

| At `file:line:col`                               | Edit                                                                                                    | Deterministic?                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `className="…"`, or a literal inside `{…}`       | splice the merged literal                                                                               | yes                                          |
| `cn('base', cond && 'x', className)`             | edit the unconditional string, or insert a new one **before** the pass-through `className` (last wins)  | yes, unless the class comes from a condition |
| a variant's classes inside `cva()`               | edit the literal under `variants.variant['tonal-neutral']`, after showing how many instances it affects | yes, with an impact preview                  |
| `variant="x"`                                    | splice, checked against the parsed variant names                                                        | yes                                          |
| plain JSX text                                   | splice, keeping whitespace and escaping `{ } < >`                                                       | yes                                          |
| `variant={expr}`, `{props.title}`, computed text | hand to Claude Code                                                                                     | no                                           |

## Recommendation

**Runtime owner stacks through bippy are the primary mechanism**, with a server-frame adapter over `/__nextjs_original-stack-frames` guarded by a contract test. Add the parts around it:

- instances grouped by resolved type, with Server Components grouped from `_debugInfo`;
- a static index of cva configs;
- write-back by Babel parse, MagicString and Prettier, for literals only.

Everything else goes to Claude Code. **The HTML-only Turbopack loader is the fallback** if the spikes show the 10,000-element cap or the internal endpoints are a problem.

The trade-off we accept: we depend on React internals, pinned through bippy, and on Next's undocumented dev endpoints, guarded by a contract test. In return, we get both locations and Server Components without touching the build.

What would change this:

- the owner-stack spike (TRU-1.1) missing more than 5% of elements;
- Next removing or changing its stack-frame endpoints;
- React Compiler being switched on (it breaks client maps today).

Two operational notes:

- The write-back service must accept only local or allowed origins. The app sometimes runs behind a remote proxy (`allowedDevOrigins`), so "localhost" can't be assumed.
- Next's latest stable is 16.4.3 (2026-10-23). Upgrading keeps the dev endpoints but changes the SWC plugin ABI, which is one more reason to avoid SWC plugins.

## Not verified

- Whether Turbopack composes a loader's returned source map into the final map (matters only for the fallback).
- Agentation's real output under Turbopack (code read only).
- The Fast Refresh `elementType` staleness, which was read in React's source, not observed.
- Adding `/_next/mcp` directly to Claude Code as an HTTP MCP server (should work; untried).
- oxc-parser's offset units.
- The `jsxImportSource` wrapper idea.

## Sources

All read on 2026-10-31 by a research agent (primary sources, plus experiments on this repo's `.next/dev` output with the SWC binary that ships with Next).

- React: PR #28265, #29032, #32426, #32529; `ReactJSXElement.js`; `ReactFlightClient.js`; `CHANGELOG.md` (19.1.0); `https://react.dev/reference/react/captureOwnerStack`. Primary.
- Next.js `v16.2.9` sources: `app-find-source-map-url.ts`, `source-maps.ts`, `middleware-turbopack.ts`, `swc_ecma_transform_plugins.rs`, `Cargo.toml` at the v16.2.9, v16.3 and v16.4.3 tags; PR #96071; issue #94450. Primary.
- Bundled docs: `node_modules/next/dist/docs/…/turbopack.md`. Official, for the installed version.
- bippy `https://github.com/aidenybai/bippy` (0.7.3). React Grab `https://github.com/aidenybai/react-grab` (0.2.0; `packages/react-grab/src/core/next-server-frames.ts`, `skills/react-grab/SKILL.md`). Primary.
- code-inspector `https://github.com/zh-lx/code-inspector` (2.0.9; issue #521; `docs/en/guide/feature/ai.md`). Primary.
- LocatorJS `https://github.com/infi-pc/locatorjs`. click-to-component issue #99. Agentation `https://github.com/benjitaylor/agentation` (`mcp/README.md`). Primary.
- React DevTools `packages/react-devtools-shared/src/backend/fiber/renderer.js`; Chrome blog "DevTools for agents: third-party tools" (2026-06-18). Primary or official.
- shadcn `packages/registry/src/codemod/edits.ts`, `transformers/transform-tw-prefix.ts`; Onlook `packages/parser/src/code-edit/style.ts`. Primary.
- swc-plugin-jsx-source-attrs `https://github.com/thedv91/swc-plugin-jsx-source-attrs` (changelog). Primary.
- `vercel/next-devtools-mcp` v0.4.0 release notes. Primary.
