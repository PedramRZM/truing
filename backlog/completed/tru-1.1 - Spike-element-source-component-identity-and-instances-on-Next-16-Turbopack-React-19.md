---
id: TRU-1.1
title: 'Spike: element → source, component identity and instances on Next 16 + Turbopack + React 19'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-10-31 14:46'
labels:
  - spike
  - inspector
  - adapters
dependencies: []
type: spike
ordinal: 10010
parent_task_id: TRU-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every feature of Truing starts from "the designer clicked this element: what is it, and where is it in the code?". React 19 removed `fiber._debugSource`, and we run Turbopack. So the older click-to-source tools don't work, and the tool that best matches our needs (Airship) has never been shown working on Turbopack.

The research (`docs/research/element-to-source-react19.md`) says React 19's runtime owner stacks, read through **bippy**, map exactly through Turbopack's source maps. Offline, all 24,102 JSX call sites in our `.next/dev` output mapped to the compiler's recorded positions. One walk gives both locations: the primitive's JSX and the feature's call site. It also lists the weak spots:

- a 10,000-element cap on captured stacks;
- Next's undocumented stack-frame endpoints for Server Component frames;
- Radix `asChild` and `cloneElement`;
- cva configs that can only be parsed from source.

This spike proves or disproves that, live, before TRU-1.3 picks a base and TRU-2.1 builds on it. It is throwaway code on a scratch branch. The result is a short write-up and a decision, not a feature.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Accuracy.** (Accepted by the maintainer, 2026-10-31. Every location the resolver returns is exact. Strictly counted, 81% of the 68 locations are returned; the rest are package-rendered elements or JSX in route files, which are accepted as correct. Cold under 300 ms holds with a warm-up. Owner choice on signed-in screens moved to TRU-2.1. See Result.): Sample 30 elements across 5 routes: a client component, Server Component HTML, an `asChild` Button, rows from a `.map`, and contents of a Radix Dialog or Popover; Include a `<Button>` written directly in a server `page.tsx`. Our shadcn primitives carry no `'use client'`, so that Button has **no client fiber**. Its call site depends on React's server debug info plus Next's stack-frame endpoint, and its props must come from parsing the source (, ); For each, the resolver returns the primitive's JSX location and the feature call site; Compare against the compiler's recorded `{fileName, lineNumber, columnNumber}`; Pass: at least 95% exact; cold lookup under 300 ms.
- [x] #2 **The 10,000-element cap.** (Counted, and the loader isn't needed for the routes measured. The signed-in heavy screens moved to TRU-2.1, the maintainer, 2026-10-31.) Render one commit with more than 10,000 elements and count the elements without a trusted stack. Record whether the compile-time fallback (an HTML-only Turbopack loader) is needed.
- [x] #3 **Server frames.** A Playwright contract test resolves Server Component frames through `/__nextjs_original-stack-frames`, for the `Server` and `Prerender` environments. It runs on 16.2.9 and also on 16.4.x.
- [x] #4 **Instances.** A page with 20+ Buttons (including `asChild`, ones inside a Dialog, and memoised rows) groups them correctly; It still does after an edit to `button.tsx` hot-reloads; Server Component instances are grouped by name plus definition location.
- [x] #5 **cva.** All 15 `cva()` configs are parsed statically. A Jest test checks that `buttonVariants(combo)` equals the classes rebuilt from the parsed config, for every combination.
- [x] #6 **Picking inside Radix overlays.** Picking inside an open Dialog or Popover works without the app's click handlers firing.
- [x] #7 **Fallback loader (only if the cap or the endpoints fail).** (Not triggered, so there was nothing to build or check; see Result.): No hydration warnings across 10 routes; `data-src` is present in the served HTML; Cold-compile and HMR times are recorded; Owner-stack positions still match with the loader on; `next build` output is unchanged.
- [x] #8 **Recommendation.** One paragraph with the chosen mechanism and its known gaps, carried into TRU-1.3's ADR.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Throwaway spike code on a scratch branch, measured against a real Next 16 app. The code is not part of this repo. Paths under `spike/` below are kept only as a record of how each number was produced.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The spike code is under `spike/` and `spike routes`, with bippy 0.7.3 pinned as a dev dependency and loaded from `src/instrumentation-client.ts`. None of it was meant to merge. Each check names the script that reproduces it.

### Accuracy: every location returned is exact, but 81% of locations are returned. Cold lookup under 300 ms only with a warm-up

`spike/e2e/accuracy.mjs` samples 34 elements over 5 routes:

- `/spike` (13 elements):
  - `<Button>`s written straight in the server `page.tsx`;
  - a Button inside a Server Component;
  - server `.map()` rows;
  - Server Component HTML;
  - a client Button and an `asChild` Button;
  - memoised `.map()` rows;
  - a Button and the content box inside an open Dialog;
  - a Button inside an open Popover.
- `/list`, `/projects`, `/profile` and `/saved`: 21 visible elements spread evenly down each page.

Each element is looked up in a fresh browser context. The resolver returns:

- **the primitive's JSX**: the first owner-chain location in `ui/`, else the element's own JSX;
- **the feature call site**: the next project location outside `ui/`.

Ground truth is the compiler's own record. For each frame, the script reads the generated chunk at the frame's position and takes the `{fileName, lineNumber, columnNumber}` that SWC wrote into that `jsxDEV(...)` call. It also checks that the file on disk has a `<` at that position.

- **Every location the resolver returned was exact, in every complete run after the two resolver fixes.** That includes server Buttons, `asChild`, memo rows, Dialog and Popover content, and the real routes. The last run returned 55 of 55 exact; only the last run per mode was kept, in `/tmp/spike/accuracy-*.json`. One more warm-up run lost 2 samples when the page re-rendered under the harness; that harness bug is fixed.
- **Strictly counted, it is 55 of 68 locations (80.9%), under the 95% bar.** The other 13 are absent. The count varies from 11 to 14 between runs, because `/list` renders different results. Each absence is checked independently of the resolver's own tag:
  - **9 have no project primitive.** The element is rendered inside a package: the `<a>` of `next/link`, or a lucide `<svg>`. The script checks that the element's own frame resolves into `node_modules`. The resolver returns the project call site, such as `app-header.tsx:281:11` for `<Link>`.
  - **4 have no call site.** The JSX is written straight in a `page.tsx` or `layout.tsx`. The script checks that the element's file is a route file and that no owner above it resolves into the project. Next creates those owners.
  - Of the 21 elements on real routes, **10 come back with both locations.**
- **Whether these absences fail the criterion is a judgement for review.** My view: they are the right answer, not misses. A designer clicking a `next/link` gets the `<Link className>` call site, and that is what they edit.
- **What this ground truth doesn't prove.** It shows that the source map agrees with SWC for the frame the resolver chose. It doesn't show that the resolver chose the right owner. The owner choice was checked by hand for the 13 fixture elements only, all correct, as the reviewer confirmed. On the real routes it is plausible from the names (for example `card/index.tsx:298:15` for a paper card's button) but unverified.
- **How the real routes were sampled.** Signed out, so `/profile` and `/saved` show the sign-in hint and the layout. Most samples are header and footer chrome; `socials.tsx:59:9` was picked three times. The feature-rich signed-in screens still need sampling, with a signed-in session.
- **"Cold" means a fresh browser context only.** The dev server's own caches, such as the stack-frame endpoint's source maps, are warm after the first sample.
- **Two resolver bugs were found and fixed on the way:**
  - Turbopack's client maps give percent-encoded `file:///` paths (`%28main%29`).
  - `window.__spike` exists before hydration, so a lookup has to wait for the element's fiber.

Lookup time, in ms (median / p90 / max, and how many of the 34 took 300 ms or more):

| Mode                                               | Dev server             | Median  | p90     | Max     | ≥ 300 ms |
| -------------------------------------------------- | ---------------------- | ------- | ------- | ------- | -------- |
| Cold, every link resolved                          | long-running, load 2–9 | 136–315 | 218–623 | 238–950 | 0–19     |
| Cold, every link resolved                          | fresh                  | 173     | 279     | 453     | 3        |
| Cold, resolved upward and stopped at the call site | fresh                  | 96–105  | 242–253 | 368–374 | 1–3      |
| Same, machine at load 10                           | fresh                  | 163     | 371     | 1,035   | 8        |
| After a warm-up when the page opens                | fresh                  | 3       | 101     | 179     | 0        |
| After a warm-up (every link resolved)              | long-running           | 84      | 101     | 108     | 0        |

- **Where the cold time goes.** Almost all of it is fetching a client chunk and its map the first time: Next and react-dom maps are 1.8–2.5 MB, while project maps have a median of 66 KB. Resolving the chain upward and stopping at the call site skips the large library maps of the owners above it, and cuts the median by about 40%.
- **The 300 ms target.** It is **not met on an empty cache**: 1 to 19 of 34 lookups over 300 ms, depending on the dev server and the load. It **is met with a warm-up** when Truing opens: 0 of 68 lookups over 300 ms, max 179 ms. The warm-up fetches the maps of the loaded client chunks and resolves one frame per server chunk. It takes about 1.0 s (max 1.7 s) in the background.
- **Repeat lookups** take 1–35 ms.
- **The dev server matters.** One that had run for an hour at 8 GB doubled the cold times.

### Server `<Button>` in a `page.tsx`: works, with props

- **Location.** The host `<button>` has a Flight-made `_debugStack` (`about://React/Server/file:///…/.next/dev/server/chunks/ssr/…js?N`). Its `_debugOwner` is a `ReactComponentInfo` named `Button`, whose `debugStack` gives the call site. Both resolve exactly through `/__nextjs_original-stack-frames`, for example `button.tsx:70:7` and `spike-spike/page.tsx:16:9`.
- **Props.** `spike/e2e/props.mjs` parses the JSX at each of the 18 Button call sites on the page with `@babel/parser`. **18 of 18:** every literal attribute in the source (`variant`, `size`, `disabled`, `asChild`, `aria-label`) equals what React holds at run time. That is `memoizedProps` for client instances and Flight's dev snapshot (`ReactComponentInfo.props`) for server ones.
- **Expressions.** The dev snapshot also carries the evaluated values of expressions, such as a template `aria-label`, which the source can't settle. So server props can be shown from the snapshot and edited from the source.
- **Props the source doesn't have.** Radix adds `aria-expanded` and `data-state` through `asChild`; these are runtime-only.

### The 10,000-element cap: real, but no measured route comes near it. The loader isn't needed for these routes; signed-in screens are still open

`spike/e2e/cap.mjs` counts host elements without a trusted stack. They get React's shared "unknown owner" stack, which the resolver detects (`unknown: true`).

| Route                                                                 | Host elements | Without a trusted stack                                              |
| --------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `/spike/cap-client` (12,000 spans, one client render)            | 12,028        | **2,132** (2,129 of the 12,000)                                      |
| `/spike/cap-server` (12,000 spans, one server render)            | 12,026        | **2,025** (2,022 of the 12,000; the server has its own cap)          |
| `/list`                                                             | 1,258         | 3–29: `<script>`, `<meta>`, `<link>` in `<head>`, one hidden `<div>` |
| `/projects`, `/profile`, `/saved`, `/spike` | 68–253        | 3, the same Next bootstrapping nodes                                 |

- **No visible project element on these routes lost its location.** The largest commit measured has about 1,300 elements.
- **So the compile-time fallback loader isn't needed for these routes**, and the "Fallback loader" check was not triggered. All of them were measured signed out, and the largest has about 1,300 elements.
- **What is left:** the heavy signed-in screens were not measured, because the spike had no login. TRU-10.1 carries this.
- **What Truing should do:** say "location unavailable on a page this large" when the stack is the shared one, rather than guess.

### Server frames: contract test passes on 16.2.9 and 16.4.3

`spike/e2e/server-frames.pw.ts` (Playwright, run with `-c spike/e2e/playwright.config.ts`):

- reads the `about://React/<Env>/…` frames from the page's fibers;
- posts them to `POST /__nextjs_original-stack-frames`;
- asserts that every frame has a compiler record (a frame without one fails rather than being skipped);
- asserts that every project frame comes back at exactly the compiler-recorded `file`, `line1` and `column1`.

It ran on a real app and on a minimal app (`spike/next-fixture-app/`, with `cacheComponents: true` so that `Prerender` frames exist) on both versions:

| App                   | Next   | Environments seen     | Project frames exact (last run) | Runs passed |
| --------------------- | ------ | --------------------- | ------------------------------- | ----------- |
| a real app `/spike` | 16.2.9 | `Server`              | 21 / 21                         | 3 / 3       |
| a real app `/list`     | 16.2.9 | `Server`              | 3 / 3                           | 2 / 2       |
| fixture               | 16.2.9 | `Prerender`, `Server` | 7 + 3 / 10                      | 5 / 5       |
| fixture               | 16.4.3 | `Prerender`, `Server` | 7 + 3 / 10                      | 5 / 5       |

These are the figures from the last runs, after skipping was removed. Earlier runs checked 19 frames on a real app and 8 on the fixture, before a client island and a shared module were added; they passed too. In every run, all frames had a compiler record. The runs counted are those after the readiness fix below; before it, the fixture runs failed because the test read the page before the `Server` part had hydrated.

Things to know about these frames:

- **Two URL formats.**
  - A real app, without `cacheComponents`, gives `…/chunks/ssr/%5Broot-of-the-server%5D__x._.js?N`, with lines counted in the chunk.
  - With `cacheComponents`, on both versions, the URL is double-encoded and carries a module id: `…%255Broot-of-the-server%255D__x._.js?id=%255Bproject%255D%252Fapp%252Fpage.tsx+…?N`. Lines count from the module's first line in the chunk.
  - The endpoint resolves both. Our own code must never parse positions out of these URLs.
- **Environment names.** A component's environment is the stage it **started** in. An async component that awaits `connection()` stays `Prerender`; only components it renders afterwards are `Server`.
- **Readiness.** A frame is readable only once its element has hydrated. A Suspense boundary hydrates after the body, so the test waits for the last streamed element's fiber.

### Instances: grouped correctly. After an edit to `button.tsx`, server instances sometimes need `router.refresh()`

`spike/e2e/instances.mjs` runs with the Dialog open on `/spike`:

- **Groups.** Client fibers are grouped by resolved type, server instances by name plus definition file. This gives:
  - **one client `Button` group of 12**: 2 plain, 1 `asChild`, 5 memo rows, the 2 overlay triggers, and the 2 inside the Dialog's portal;
  - **one server `Button` group of 8**;
  - two server `Item` groups, `a/item.tsx` and `b/item.tsx`, kept apart although the names are equal (asserted from the last run on; printed before that);
  - `ServerCard` × 2 and `MemoRow` × 5.
- **Membership.** Members are checked by accessible name against the expected lists.
- **One component, two groups.** The same `Button` appears as a client group and a server group, because the client key is the type object and the server key is name plus file. TRU-2.2 has to merge them by definition file (`ui/button.tsx`) to show "12 + 8 instances of Button". Nothing here tested that merge.
- **The edit.** It then adds an attribute to `<Comp>` in `button.tsx`, waits until every Button carries it, groups again, reverts and groups again. **The groups were identical before, after and after the revert in 6 runs out of 6:** there was no split into old and new types after Fast Refresh.
- **Hot reload.**
  - Client instances updated in about 1 s every time.
  - **The server instances missed the RSC refresh on 5 of the 12 edits or reverts.** They stayed stale on the open page, although a fresh request already rendered the edit. Calling the App Router's `refresh()` (`window.next.router.refresh()` here) updated them every time, in about 0.6 s.
  - Edits to server-only files (`server-card.tsx`, `page.tsx`) and to a small shared module always refreshed.
  - A minimal app on 16.2.9 and 16.4.3 did not reproduce the miss.
  - The root cause is not found. **Truing must call `router.refresh()` after each of its own writes**, and re-select afterwards.

### cva: all 23 configs in the 15 files parsed, and identical for every combination

`spike/cva/parse-cva.ts` reads each `cva()` call with `@babel/parser`: strings, arrays, objects, and template literals over same-file constants, which `chipVariants` needs for `${smallChip}`. Anything else is reported as dynamic instead of guessed.

`spike/cva/parse-cva.test.ts` (Jest, `pnpm exec jest spike/cva`) wraps `cva` while each module loads, so the real functions are caught, the unexported ones included. **46 of 46 tests pass:**

- every config is read as a literal;
- the parsed config deep-equals the one the module passes at run time;
- for **566 combinations**, each also run with a `className`, the classes rebuilt from the parsed config equal the real function's output. A combination is each variant's values plus "not passed" and `null`.

To check the test can fail, the rebuild's compound-variant step was broken on purpose; the test then failed on `review-sections-panel.tsx`.

The test mocks `uuid`, because uuid 13 is ESM-only and Jest's CommonJS runtime can't load it. It is reached through `AnalyticsProvider`.

### Picking inside Radix overlays: works

`spike/e2e/pick-overlays.mjs` turns pick mode on: window capture listeners for pointer, mouse, click and touch events, which call `preventDefault` and `stopImmediatePropagation`. **6 of 6 checks pass.**

- **Inside.** Picking a Button inside the open Dialog, and inside the open Popover, returns the right primitive and call site. The `onClick` counter doesn't move, focus stays on the same element, and the overlay stays open.
- **Outside.** Picking the Dialog's backdrop and a heading outside the Popover resolves them. Neither overlay closes, although those clicks would normally dismiss them.
- **Control.** With pick mode off, the same click increments the counter.
- **Keyboard.** It isn't blocked, so `Escape` still closes an overlay while picking. TRU-2.1 decides whether it should.

### Recommendation (for TRU-1.3's ADR)

**Use React 19's runtime owner stacks, read through bippy 0.7.3 pinned exactly, as the only mechanism, with no build plugin or loader.**

- One walk of the `_debugOwner` chain gives the primitive's JSX and the feature call site. Every location it returned was exact; owner choice was checked by hand on the fixtures. It covered:
  - Server Components and `asChild`;
  - memo rows;
  - content portalled by Radix.
- Client frames resolve through Turbopack's dev source maps, server frames through `POST /__nextjs_original-stack-frames`.
- Resolve from the element upward and stop at the call site.
- Warm the caches when Truing opens; that is what keeps a click under 300 ms.

Around the walk:

- instances grouped by resolved `fiber.type`, with server instances grouped by name plus definition file;
- props from `memoizedProps` or Flight's dev snapshot, with edits made against the parsed JSX at the call site;
- variants from a static index of the `cva()` configs;
- picking through window capture listeners;
- after every write, `router.refresh()` and a re-select.

Known gaps:

- **Internal APIs.** The mechanism depends on React internals (`_debugStack`, `_debugOwner`, `ReactComponentInfo`) and on Next's undocumented endpoint. Both are guarded by the contract test, which must run on every Next or React upgrade, and by the exact bippy pin.
- **The cap.** It drops locations after 10,000 elements in one render. None of the measured routes come close, and the heavy signed-in screens are unmeasured.
- **Without a warm-up**, cold lookups miss 300 ms on 3–56% of clicks.
- **Coverage.** 19% of the sampled locations have no project primitive or no call site. That is correct, but a TRU-2.1 panel must say so plainly, not show an empty field.
- **Owner choice.** It is unverified on the real routes, and the signed-in screens are unsampled.
- **Two groups per primitive.** A primitive used from both sides shows as a client group and a server group; TRU-2.2 merges them by definition file.
- **Stale server instances.** They can miss a hot reload after an edit to a shared primitive.
- **Elements without a full pair.** Elements rendered inside packages (`next/link`, lucide) have a call site but no project primitive; JSX written straight in a route file has no call site.
- **Chromium only.** It relies on V8 call sites.

**What would change this:**

- a signed-in route that loses locations to the cap, in which case build the HTML-only Turbopack loader from the research note;
- the contract test failing on an upgrade;
- React Compiler being switched on.

### Left for a person to check

- The cap on signed-in heavy screens: run `node spike/e2e/cap.mjs` with those routes added, in TRU-10.1.
- Whether the missed RSC refresh after a `button.tsx` edit is worth reporting upstream. It wasn't reproduced outside a real app.
- **What happens to the spike code.** It lives in its own commits on this branch. The candidates TRU-2.1 might keep are:

  - the inspector;
  - the contract test;
  - the cva parser and its test.

  Those get rebuilt there properly, not merged from here.

- **Risks if the spike commits ever merged:**

  - `src/instrumentation-client.ts` imports bippy and the inspector without a `NODE_ENV` guard, so they would ship to production;
  - `/spike`, including the 12,000-element pages, would become a public route;
  - Jest's default match would run `spike/cva/parse-cva.test.ts`, which loads app modules and connects to app services;
  - adding `@babel/parser@7.29.7` collapsed `@babel/core`'s `@babel/parser` and `@babel/types` from 7.24/7.25 to 7.29.7 in the lockfile.


- **The Turbopack dev cache.** Killing a dev server mid-compaction corrupted `.next/dev/cache/turbopack`: the restarted server panicked on missing `.sst` files and hung compiling `/list`. Deleting that folder fixed it. Stop a dev server before deleting or switching branches.
<!-- SECTION:FINAL_SUMMARY:END -->
