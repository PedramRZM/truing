---
id: TRU-2.1
title: 'Select and inspect: component, variant, source locations and tokens for any element'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-11-01 10:44'
labels:
  - inspector
dependencies:
  - TRU-1.1
  - TRU-1.4
  - TRU-1.5
  - TRU-1.6
type: feature
ordinal: 20010
parent_task_id: TRU-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design team asked to click on anything and get its tokens and colours, and to detect the same component easily. Figma Make's inspector does three things worth copying (`docs/research/figma-make-teardown.md`):

- a hover outline;
- a selection chip;
- a layers tree with tag and classes.

It also has two gaps we close:

- It shows raw px and hex.
- It knows only DOM elements and classes, not components.

Ours shows, for every element:

- the component;
- its variant;
- both source locations (the primitive's JSX and the feature call site);
- every style as a token name with its value.

TRU-1.1 settles the mechanism: owner stacks through bippy, with a server-frame adapter, unless the spike says otherwise. TRU-1.4 provides the class → token resolver.

### Carried over from TRU-1.6

- Build on the `selection` module (`src/modules/selection/`), through the contract in `docs/modules.md`. It already outlines on hover, picks on click in Select mode and shows the tag in the Design dock.
- Deselecting: Esc can't reach a probe, because in Select mode the frame never takes focus. It needs a shell key that asks the probe, through a probe command.
- The Selection empty text, "Press V, then pick an element in a frame to see its design.", is true once this task shows the design (the copy review, 2026-10-31).
- From TRU-1.6's design review (2026-10-31):
  - a failed section says to reload but has no control: add a Reload frame button;
  - side by side shows one identical failure per frame: group them;
  - text colours from opacity and raw values in `styles.css` (`.menu-heading`, `.menu-size`, the segmented buttons at 0.65, `5px 10px`, `30px`, `62px`, the body's `#141414`): move them to `--ds-*` tokens;
  - the bottom bar sits outside any landmark (axe's `region` rule).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Hover and select.** In Select mode, hovering outlines an element and shows its tag and component name. Clicking selects it. Truing's own UI is never selectable.
- [x] #2 **Identity.** The inspector shows: the component name and its variant props (e.g. `Button · variant tonal-neutral · size sm`), with the variant read from the parsed cva config; the **call site** (`search/components/…tsx:42`) and the **definition** (`ui/button.tsx:70`); the owner chain above them, collapsed by default.
- [x] #3 **Styles as tokens.** Each applied style shows the token's name, the token it resolves through, and the final value. For example: `padding-x · px-400 → spacing-400 · 12px`, `background · bg-primary → primary → brand-1-600 · #…`. Values that aren't tokens go to TRU-11.2.
- [x] #4 **Server Components.** For HTML rendered by a Server Component, the component and location still show. Props show as "read-only snapshot" or "not available", never as an empty panel.
- [x] #5 **Layers tree.** A layers tree shows components and elements for the current route. Selecting in the tree selects in the frame, and the reverse.
- [x] #6 **Go to source.** It opens the call site or the definition in the developer's editor (through Next's launch-editor endpoint), or copies `path:line` for a designer.
- [x] #7 **Selection survives reloads.** After a hot reload, the same source element stays selected where it still exists.
- [x] #8 **Picking inside overlays.** Picking inside open Radix overlays (Dialog, Popover, Select) works without triggering the app.
- [x] #9 **Signed-in screens (carried from TRU-1.1).** (Moved to TRU-10.1, which waits on a signed-in session; the maintainer, 2026-11-01.) These need a signed-in session.: On the heaviest signed-in screens , count the elements past React's 10,000-element owner-stack cap, as TRU-1.1's `cap.mjs` does. If visible project elements lose their location, build the HTML-only Turbopack loader from TRU-1.1; Sample 20 elements there and check by hand that the resolver picks the right owner; Where a location is absent by design (an element drawn inside a package, JSX written in a route file), the inspector says why instead of showing an empty field.
- [x] #10 **Tests.** A Playwright test on a fixture page covers a server-rendered element, a client component, a shadcn primitive with cva, an `asChild` Button and a mapped list. It asserts the component, both locations and two token names.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Everything lives in the package; the app is untouched.

**The split.** Each part does the work it is placed for:

- **Probe (in the frame).** It walks the fiber and owner chain through bippy (TRU-1.1's walk, rebuilt): host fiber → `_debugOwner` → … including Flight's `ReactComponentInfo`. It reads the props (`memoizedProps`, or Flight's dev snapshot for a Server Component) and the element's classes. It resolves each frame through Next's `POST /__nextjs_original-stack-frames` on its own origin, client and server frames alike, and caches every answer by frame. It warms up when the page loads, resolving every component's creation frame once, which is also what the layers tree needs.
- **Server (Node).** It turns paths into project paths (`file://`, `[project]/`, `webpack-internal:///(…)/./`, then relative to `ctx.root`; the spike's hard-coded `a real app/` strip goes). It applies the primitive and call-site rule with `config.primitives`. It reads the variant from a static parse of the definition file's `cva()` config (`@babel/parser`, rebuilt from TRU-1.1's parser). It maps each class to its CSS property, its token, the chain and the light and dark values through the TRU-1.4 table. It opens a location through Next's `/__nextjs_launch-editor`.
- **Panel (shell).** It asks the server's `inspect` op for the picked element's raw description and shows the answer.

**Decisions (2026-10-31):**

- **One module, both docks.** The contract lets a module's panel have a section in each dock (`panel: { docks: ['left', 'right'] }`, `definePanel(module, { left, right })`). Selection stays one module, so the tree and the frame share one selection.
- **Esc through `ctx.onEscape`.** In Select mode, outside a field, the shell forwards Esc to every frame's runtime, and probes subscribe with `ctx.onEscape`. It works with the Design dock closed. In Select mode the app never sees Esc, so an open Dialog stays open while picking.
- **Next's endpoint resolves every frame,** client and server, behind a Next adapter, so webpack and Turbopack take one path. Cold and warm lookups get timed on a real app against TRU-1.1's 300 ms target; if the endpoint is slower, bippy/source becomes the Turbopack client path.

**Steps (one commit each, or close to it):**

1. **Contract additions** (`src/module.ts`, the runtime, the shell, docs/modules.md), with the two decisions below.
2. **Carried over from TRU-1.6:** a Reload frame button on a failed section; one grouped failure when every frame failed the same way; the raw values and opacities in `styles.css` moved to `--ds-*` tokens; the bottom bar inside a landmark.
3. **Resolver in the probe:** the chain, raw frames, the Next frames adapter (`src/adapters/next.ts`), the cache, the warm-up, the shared "unknown owner" stack detected (the cap). Hover shows the tag and the nearest component, which fills in once resolved.
4. **Server side:** paths, the rule and the reasons for an absent location (`library`: drawn inside a package; `route`: JSX in a route file; `cap`: past React's 10,000-element stack cap; `server-props`: no snapshot). Then the cva index, the class → property → token mapping, and the `inspect` and `open` ops.
5. **Inspector panel:** `Button · variant tonal-neutral · size sm`; the call site and the definition, each with Open in editor and Copy path; the owner chain, collapsed; the styles as `padding-x · px-400 → spacing-400 · 12px`; props as a read-only snapshot or "not available"; a plain reason for anything absent.
6. **Layers tree:** components and elements for the route, with Next's and the packages' components (those created inside `node_modules`) folded into their children. Selecting in the tree selects in the frame, and the reverse; it is rebuilt after commits (throttled).
7. **Survives reloads:** the selection's identity is the element's own location, its call site file, the owner names and its index among same-location elements. After Fast Refresh, an RSC refresh or a full reload, the probe finds it again or reports that it is gone.
8. **Tests.**
   - Vitest: path normalising; the rule and its reasons; the cva parser against the real `buttonVariants` for every combination; class → property → token.
   - Playwright (`inspect.spec.ts`) on a new fixture route, `/inspect`: a Server Component's HTML, a client component, a cva primitive (`fixture-app/components/ui/button.tsx`), an `asChild` Button, a mapped list and an open Radix Dialog. It asserts the component, both locations and two token names, plus the tree in both directions, Esc, reselection after an edit, and that picking inside the Dialog fires nothing.
   - `real-app.spec.ts`: one element on a signed-out a real app route resolves on Turbopack.
9. **Signed-in screens** (cap count, the 20-element owner check) need a signed-in session. TRU-13.1 is pending, so this stays open unless a login exists by then.

**How each criterion is proved:** hover, select, identity, tokens, Server Components, layers, go to source, reloads and overlays by `inspect.spec.ts` and the unit tests; Turbopack by `real-app.spec.ts`; the UI by a browser check screenshots and the a design review and a copy review agents.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The contract and the TRU-1.6 carry-overs, then the inspector, then the task review's fixes.

### What changed

- **Contract** (`src/module.ts`, docs/modules.md):
  - a panel can have a section in each dock: `panel: { docks, titles? }` and `definePanel(module, { left, right })`, typed against the declaration;
  - `ctx.onEscape`: in Select mode the shell catches Esc and hands it to every frame's probes, and the app never sees it.
- **Carried over from TRU-1.6:**
  - a failed section has a Reload frame, Reload frames or Reload studio button;
  - one failure shows once across the frames it stopped in;
  - the raw values and opacities in `styles.css` are `--ds-*` tokens;
  - the bottom bar is in a `<footer>` landmark.
- **The selection module is the inspector** (`src/modules/selection/`):
  - The probe walks the owner chain through bippy, including Flight's Server Component records. It maps each frame, reports the pick with its classes and props, builds the layers tree, and reselects after a hot reload or a reload.
  - The server applies TRU-1.1's rule with `config.primitives`, giving the definition, the call site and a reason when either is absent (`library`, `route`, `cap`, `unmapped`, `not-react`). It names the component by the tag written at its call site, reads the variant from a static parse of the `cva()` config, and gives each class as a token with its chain and value through the TRU-1.4 table. It opens a file through Next's launch-editor.
  - The panel shows the inspector in Design and the tree (headed "Page") in Layers, selecting both ways.
- **Config:** `app.dir` names Next's app folder when it isn't the root (the fixture's).

### Deviations from the plan

- **Turbopack's client frames don't go through Next's endpoint.** On 16.2.9, `POST /__nextjs_original-stack-frames` rejects an `http://…/_next/static/chunks/…` file ("Unknown url scheme 'http'"). Given only the path, it echoes the generated position back unmapped. The decision allowed a fallback for exactly this case. bippy/source would have brought React into the init script, so the probe reads the chunk's own source map instead (`src/adapters/source-maps.ts`, a VLQ decoder for Turbopack's index maps). Server frames and webpack's `webpack-internal://` client frames still go through the endpoint.
- **TypeScript's parser instead of `@babel/parser`.** Adding `@babel/parser@7.29.7` to Truing collapsed the app's 7.24 and 7.25 Babel parser and types in the lockfile, the risk TRU-1.1 flagged, so it was dropped. `typescript` 5.8.3 moved from Truing's devDependencies to its dependencies; the lockfile changes only in Truing's importer.
- **The runtime is minified** (names kept), and `react` is an empty module in it. bippy's entry imports React for hooks no probe calls. The init script is 61 KB, under TRU-1.5's 80 KB budget; without both changes it was 190 KB.
- **The overlay's shadow root is open**, so tests can read the hover label. React never renders into it, and the app reaches it only by asking for `.shadowRoot` by name.

### How it was verified

- **Unit:** `pnpm exec vitest run` in the repo passes 132 tests in 15 files. The new ones cover:
  - the cva parser against the configs the real `cva()` receives in a real app's five primitives (`alert`, `badge`, `button`, `sheet`, `tabs`);
  - file names as Next gives them, for webpack and Turbopack;
  - TRU-1.1's rule with each absence reason, the nested-primitive variant and `tagAt`;
  - classes as property, token, chain and value;
  - the source-map reader on an index map;
  - `onEscape`, failure grouping, the docks schema and the runtime bundle.
- **Fixture (webpack):** `test/e2e/inspect.spec.ts` passes 11 tests on `/inspect`. Every fixture spec passes together (`inspect`, `modules`, `shell`, `app-checks`: 33 tests). The inspect tests cover:
  - the hover label (`button · Button`, and `a · Button` for asChild), and that the outline is never picked;
  - a cva Button: its variant, both locations, its tokens, the owners collapsed, and no click reaching the app;
  - an asChild Button;
  - a Server Component's Button and its HTML, with props as the server sent them;
  - a mapped list's row;
  - a route file's reason;
  - the tree selecting both ways;
  - Copy (clipboard read back) and Open (a recording `REACT_EDITOR` got the absolute path);
  - Esc;
  - picking inside a Dialog, a Popover and a Select with nothing reaching the app;
  - the pick staying on the same row through a hot reload that remounts it and moves its line, and through a frame reload.
- **A real app (Turbopack):** `test/e2e/real-app.spec.ts` passes 6 of 6. The new test picks the signed-out header's header Button: `Button · variant outline`, call site in `app-header.tsx`, definition in `ui/button.tsx`, and `gap-300 → spacing-300 · 8px`.
- **Exploration on a real app's `/list`, signed out** (a throwaway script, not committed):
  - the header Button maps to `app-header.tsx:244` and `ui/button.tsx:70`;
  - a radio maps to `year-range-filter.tsx:172` and `ui/radio-group.tsx:30`;
  - the logo `<path>` maps to `LogoColor.tsx:25`, called from `app-header.tsx:204`;
  - the tree has 2,314 nodes (154 KB per report) and lists only project components.
- **Timing on a real app,** click to report, including Playwright's own click (a throwaway script):

  | Route              | Cold, before the warm-up ends    | Warm      |
  | ------------------ | -------------------------------- | --------- |
  | `/list`          | 241–1,005 ms, 3 of 5 over 300 ms | 92–157 ms |
  | `/`                | 75–177 ms                        | 82–138 ms |
  | `/projects` | 86–203 ms                        | 54–140 ms |

  The first inspect loads the token table in 318 ms; later ones take 1–15 ms. The misses are the first picks on the heaviest route while the warm-up still fetches chunk maps, as TRU-1.1 found.

- **Fast Refresh on Turbopack:** after three lines were added to `app-header.tsx`, the chunk URL stayed the same and the line moved from 1074 to 1077. The probe now drops remembered frames when the page changes, and chunk maps on a Fast Refresh.
- **UI:** screenshots at 1440 and 1280 px through Truing's harness, since the Playwright MCP server didn't connect, so the a design review agent couldn't run. Craft checks found:
  - no horizontal overflow, no scroll regions, no alpha text, and two hues (the accent and the status green);
  - icon strokes in the new panels mismatched at first and now match the bar's 1.33 px;
  - tree rows were at line-height 1, now 1.5.
- **Copy:** the a copy review agent reviewed the new strings. These fixes were applied:
  - the cap reason no longer types React's limit into the string;
  - "Next couldn't map this to a file in the project.";
  - "Couldn't read this element. Pick it again.";
  - "Props as the server sent them."
- **Task review:** the a task review agent found these, all fixed in :

  - wrong names on a real app (shadcn copies Radix's display names);
  - the hover label disagreeing with the inspector on asChild;
  - cached frames going stale after a hot reload;
  - variants of a nested primitive;
  - a reload test that couldn't tell the rows apart;
  - untested owners, route reason, Popover and Select.

  Two points stand as they are: `bundles.test.ts` marks the toy's probe by its module id, since minifying renames its code; and the "not available" props text has no test, because the fixture has no Server Component without a Flight props snapshot.

### Left for a person

- **Signed-in screens** (the criterion carried from TRU-1.1) need a signed-in session, which is still pending. That covers the cap count on two long signed-in screens, and the 20-element owner check. The probe already reports `cap` when React's shared stack shows up.
- **Copy you own.**
  - The four "…Reload the frame(s)/studio to try again." sentences (three of them existing copy) now sit above Reload buttons that say the same. Trimming them means rewording existing strings.
  - "not set" beside a default variant ("size default not set").
  - "Server" in the tree against "Server Component" in the inspector.
- **Taste and density.** Tree rows and their toggles are 24 px tall, under 44 px, in a mouse-driven tool whose other controls are 28 px. The layout and the style rows' wrapping are also for you to judge, in the running studio: run `truing`, press V and pick something.

### Decisions

- **Reload sentences:** trimmed to the fact ("Stopped in the Desktop frame.", "This section stopped."). The Reload button beside them carries the action. An exception to keeping existing copy, given for this case; `modules.spec.ts` checks that "try again" is gone.
- **"not set"** beside a default variant stays.
- **"Server" and "Server Component"** both stay: the short form in the dense tree, the full term in the inspector.
- **Tree rows** stay 24 px.
- **Signed-in screens** move to TRU-10.1, which depends on TRU-13.1 and TRU-2.1.
- **Colour swatches:** each colour value in the Design dock has a square of the colour before its hex, in light and dark, over a checkerboard so transparency shows. Added on 2026-11-01 after the maintainer tried Truing; `inspect.spec.ts` checks the brand colour's swatch and that a length has none.
- **What Airship, Onlook and Cortex add:** the maintainer asked for a sweep of their code and took all of it, as follow-ups rather than in TRU-2.1:
  - TRU-2.3: selection keys and labels, spacing overlays, copy actions and a context menu, layers search and a shortcuts sheet, and a Fill viewport;
  - TRU-16.12: decide on Airship's inline surface after using Fill (an ADR if it goes ahead);
  - TRU-16.1: forced states and text contrast;
  - TRU-16.11: a ⌘K palette;
  - TRU-16.2: component and element colours;
  - a note in TRU-2.2 for Cortex's "Shared by N elements".
<!-- SECTION:FINAL_SUMMARY:END -->
