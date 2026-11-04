---
id: TRU-1.6
title: 'Truing''s module contract: every feature plugs in the same way'
status: Done
assignee: []
created_date: '2026-10-31 16:46'
updated_date: '2026-10-31 21:02'
labels:
  - infra
dependencies:
  - TRU-1.5
type: feature
ordinal: 10060
parent_task_id: TRU-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The maintainer's criterion for Truing (2026-10-31): features must plug in without editing the core, starting with performance monitoring, token integrations and anything else that turns out to be missing. TRU-1.3 found that neither Airship nor Cortex has such a seam. Each feature there means editing files of 1.6–4.9k lines (`TRU-1.3`, "Extensibility").

ADR 0001 makes Truing composable from day one. A module has up to four parts, and the core features are built as modules too, so the contract is used from the start rather than designed in the abstract:

| Part                     | Runs in                                     | Examples                                                     |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------ |
| runtime probe            | each app frame, injected by the init script | selection, owner stacks, Web Vitals, React render counts     |
| panel section            | the shell                                   | the inspector, the token table, the performance panel        |
| server handlers and ops  | Truing's local server                   | source resolution, direct-edit operations, token writes, git |
| Claude tools and a skill | the MCP server (TRU-12.1) and the design plugin | `get_selection`, `find_token`, `get_performance`             |

### Carried over from TRU-1.5

- Run the a design review and a copy review agents on the shell (canvas, bottom bar, docks, viewport menu) once the module contract gives the docks real sections. TRU-1.5 deferred them because the docks were still empty (2026-10-31).
- The shell's code to build on: `src/shell/` (store, canvas, toolbar, docks) and `src/protocol.ts` (the message bus). See TRU-1.5's Outcome for what exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **The contract.** A typed `defineModule({ id, probe?, panel?, server?, claude? })` with: a typed message channel between the probe, the panel and the server; the staged-change type every module uses to put an edit in the Changes tray; how a module declares the direct operations it offers and the Claude tools it adds.
- [x] #2 **Loading.** `truing.config.ts` lists the modules to load. Removing one from the list removes its probe, panel, handlers and tools, with no other change.
- [x] #3 **Two modules prove it.** A minimal core module (the selection outline) and a toy module ("element count") are built only through the contract; A test adds and removes the toy module from the config and checks that its probe, panel, server handler and MCP tool appear and disappear.
- [x] #4 **Isolation.** A module that throws in its probe or panel is shown as failed in the shell, and the others keep working (a test).
- [x] #5 **A guide.** `docs/modules.md` explains how to write a module, with the toy module as the example.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
**The shape.** The four parts run in three places (the frame, the shell, Node), and each is bundled or loaded on its own. So a module is a folder, and `defineModule` in its `module.ts` declares the typed surface of each part; the code of each part sits in a file named after it:

```
<module>/
  module.ts    defineModule({ id, title, probe?, panel?, server?, claude? }): schemas only (zod/mini)
  probe.ts     defineProbe(module, ctx => handlers)       bundled into the init script
  panel.tsx    definePanel(module, Component)             bundled into the shell
  server.ts    defineServer(module, ctx => handlers)      loaded in Truing's Node process
```

- **The channel**, all typed from `module.ts`:
  - probe **reports** (name → schema): the probe sends them; the panel gets the latest per frame as props, the server gets `onReport`;
  - probe **commands** (name → input and output): the server or the panel calls a frame's probe and gets an answer;
  - server **ops** (name → input and output): the panel calls them, and so can the module's Claude tools.
- **Staged changes.** A versioned envelope, `StagedChange` (v1): module, label, the frame it was made in, and how it applies, either `{ by: 'direct', op, input }` naming one of the module's **direct operations** or `{ by: 'claude', reason, intent }`. Direct operations are declared in `module.ts` (`server.direct`) and return Cortex's three-way result: applied, needs Claude, or failed. The server keeps the change set and sends it to the shell. TRU-4.1 adds the element, property and before/after fields and builds the tray; this task has no tray UI.
- **Claude tools.** Declared in `module.ts` (`claude.tools`: name, description, input schema) and handled in `server.ts`. Truing collects them into one registry, MCP-shaped (`list` gives name, description and JSON Schema; `call` gives text content or an error Claude can read). TRU-12.1 serves that registry over MCP; this task has no MCP transport.
- **Loading.** `truing.config.ts` gets `modules: [...]`: a bare name is a module that ships with Truing (`src/modules/<name>/`), a `./` path is the project's own. At start Truing validates each module (declared parts and files must match; ids and tool names unique), generates the probe and panel entries for esbuild, and loads each server part. Removing a name removes all of it. A config change takes effect on the next start.
- **Isolation.** Each probe is set up in its own `try`, and the callbacks it registers through `ctx` (`listen`, `guard`, `onMode`, `onPick`, commands) are wrapped: a throw marks the module failed in that frame, removes its listeners, and is reported to the shell. Each panel section sits in its own error boundary (a class component: React has no other way to catch a render error). A server part that throws while starting is failed too; its ops and tools are not registered. The shell shows a failed module in its section; the others keep working.

**Decisions taken here (say if any should change):**

- The toy module lives in `examples/element-count/` and is not in a real app's config. the real app's config lists `selection`.
- The selection module is minimal, for TRU-2.1 to grow: in Select mode, a hover outline and a click picks an element (a solid outline, inside a closed shadow root on `<html>`, so the app's DOM is untouched); the Design dock shows the picked element's tag and frame. The Design dock's current empty text moves into this section unchanged. (Esc to clear a pick was built and taken out: in Select mode the frame never takes focus, so Esc reaches the shell, not the probe. Deselecting moves to TRU-2.1.)
- No MCP server here (TRU-12.1). The test proves the tool appears and disappears in the registry TRU-12.1 will serve.
- Module skills (`SKILL.md`) are not wired: nothing consumes them before TRU-5.2/TRU-12.1. The guide says so.
- Panels and probes from a project's own module resolve `react`, `react-dom`, `zod` and `lucide-react` from Truing's package, so a module outside it never pulls in a second React. Its server part resolves `zod` the same way in Node.

**Steps:**

1. **Contract** `src/module.ts`: `defineModule`, `defineProbe`, `definePanel`, `defineServer`, the context and handler types, `StagedChange` and `ApplyResult`. Environment-neutral (zod/mini only).
2. **Protocol**: generic module envelopes on the bus (report, command, call, result, failed, changes); the runtime's hello lists the probes it booted; the welcome carries the latest reports, failures and changes.
3. **Loader** `src/module-loader.ts`: resolve, validate, generate the esbuild entries (`truing:probes`, `truing:panels`).
4. **Server host** `src/module-host.ts`: starts the server parts, validates every payload against the module's schemas, relays commands and results, keeps reports, failures and the change set, and exposes the tool registry. Wired into `server.ts` and `studio.ts`.
5. **Runtime**: boots each probe isolated; the Select guard hands picks to `onPick` before stopping them.
6. **Shell**: module state in the store, `call` and `command` with promises, sections in the docks with error boundaries and a failed state.
7. **Modules**: `src/modules/selection/` (probe, panel); `examples/element-count/` (all four parts: a `count` report, a `count` command with an optional selector, a `counts` op, a `count_elements` tool); `test/modules/broken/` (throws in its probe and its panel).
8. **Tests.**
   - Vitest: contract type checks and validation; the loader (missing file, undeclared file, duplicate ids and tool names, unknown name); the host (payload validation, op errors, failed server part, staging and applying a direct change, the registry); the generated bundles include a module's probe and panel only when listed.
   - Playwright (`modules.spec.ts`), through the real shell on the fixture app: with the toy listed, its probe reports from the frame (the frame's hello lists it), its panel section shows the count, its op answers over the bus, and `count_elements` is in the registry and answers through the probe; without it, all four are gone. The broken module shows as failed while the toy and selection keep working. Selection: hover and pick in Select mode, and the Design dock shows the element.
9. **Guide** `docs/modules.md`, with the toy as the example.
10. **Carried over from TRU-1.5**: a design review and a copy review on the shell, now that the docks have sections.

**How each criterion is proved:** the contract by the types (`tsc`) and the guide's example compiling; loading and the two modules by `modules.spec.ts` and the bundle test; isolation by the broken module's e2e test and the host's unit tests; the guide by the file, written against the toy module's real code.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every feature of Truing is now a module. A module is a folder whose `module.ts` declares, with zod/mini schemas, what its probe reports and answers, the ops and direct operations its server part offers, and the Claude tools it adds. `probe.ts`, `panel.tsx` and `server.ts` are typed from that declaration. `truing.config.ts` lists `modules: ['selection']`. The guide is `docs/modules.md`.

**How each criterion was checked**

| Criterion | Evidence |
| --------- | -------- |
| The contract | `src/module.ts`: `defineModule`, `defineProbe`, `definePanel`, `defineServer`; probe reports and commands, server ops, direct operations, Claude tools; `StagedChange` v1 and the three-way `ApplyResult`. `test/unit/module-types.test.ts` holds seven `@ts-expect-error` cases (an undeclared report or op, a wrong payload, a missing handler, an undeclared direct operation) that `tsc` checks. The host checks every payload against the module's schemas at run time too. |
| Loading | `src/module-loader.ts` resolves a bare name to `src/modules/<name>/` and a `./` path from the root. It refuses a module whose declared parts and files disagree, duplicate ids or tool names, and a declaration that isn't schemas (`test/unit/modules.test.ts`, 10 tests). `test/unit/bundles.test.ts`: the toy's probe and panel are in the runtime and shell bundles when listed and gone when not, and its server code is never in either. |
| Two modules | `selection` (probe and panel) and `examples/element-count` (all four parts) use nothing but the contract. `test/e2e/modules.spec.ts` starts Truing with the toy listed: the frame's hello lists its probe, its panel shows the count, its op answers over the bus, and `count_elements` is listed and answers through the frame's probe (`{"main":1}` for `h1`). With the toy removed: no probe, no section (Layers shows its empty text), the op answers `No module "element-count" is loaded.`, and the tool list is empty. Selection: hovering draws the outline, a pick shows `<h1>` in the Design dock, and a second pick replaces it. |
| Isolation | `test/modules/broken/` throws in its probe and in its panel. The e2e spec shows both failures in its section while Element count and Selection keep working. `test/unit/probes.test.ts`: a probe that throws while starting, in a listener or in a guarded callback stops alone and its listeners are removed; a throwing command only answers with the error. `test/unit/module-host.test.ts`: a server part that throws, or leaves out a handler, is failed and its tools aren't listed; the others start. |
| A guide | `docs/modules.md` walks through the toy module's four files (its code is the files' code), the context of each part, staged changes and direct operations, loading, failures and testing. |

**Commands, last run:** package `tsc` clean; `vitest run` 58/58; `playwright test` 26/26 (21 in the full run; the real app's 5 again after stopping the manual session, whose `next dev` on :3000 blocks a second one in the same folder); root `pnpm typecheck` clean; ESLint 0 errors on the changed files;  Nothing changed under the app's `src/`.

**Measured:** the runtime init script is 62 KB with no modules (TRU-1.5's 52 KB plus the module protocol), 66 KB with `selection`, 73 KB with the toy as well. A pick reaches the Design dock 29 ms after the click.

**What the reviewers flagged, and what was done**

- **Task reviewer** (all five criteria met; not ready because of the first point). Fixed, with regression tests:
  - a report named `toString` crashed Truing server, and a tool named `constructor` threw: names from a frame or the shell are now looked up as own keys only, and module message handling can't throw out of a socket listener;
  - an answer was accepted from any frame, and an old page's socket still spoke for its frame after a reload;
  - a probe or panel defined for another module loaded silently;
  - the pre-hello buffer could drop another module's failure;
  - handler return types; dead state in the shell; a CSS margin; the hover outline asserted on its own.
- **Design reviewer** (the shell, carried over from TRU-1.5). Fixed and measured at 1280 px: the open docks ended under the bar below a 1600 px window (now 8 px above it); side-by-side frame labels ran into each other and lost their status dot; contrast (`--ds-text-3` and `--ds-text-4` lightened, a new `--ds-accent-fill` behind white text); the route field's focus ring; the viewport button's `aria-haspopup`; a 24 px hit area on frame names.
- **Copy reviewer.** Fixed: "Stopped in the a frame" when a frame's name was unknown; two new strings made consistent with the shell's ("Start Truing again with truing", "Not connected to Truing").

**Decisions (2026-10-31)**

- The Select and Hand tooltips take the copy review's wording: "Select (V). Pick elements. Clicks don't reach the page." and "Hand (H). Drag to move around, or hold Space or the middle button and drag." The ping stays in the frame's tooltip.
- The lighter greys and the darker accent fill stay, for 4.5:1, even though they move off Airship's exact colours.
- The shell items the design review left go to TRU-2.1's "Carried over" list.
- Next: TRU-1.4, the token manifest, which unblocks TRU-2.1.

**Left for a person** (as handed over; the calls above settle the copy and colours)

- **Copy, existing strings (your OK needed):** the reviewer suggests "Select (V). Pick elements. Clicks don't reach the page." and "Hand (H). Drag to move around, or hold Space or the middle button and drag." for two toolbar tooltips, and dropping the ping (`· 12 ms`) from a frame's tooltip. The Selection empty state, "…to see its design.", promises more than the tag it shows until TRU-2.1; it's the Design dock's existing text, kept as is. The Layers empty text promises layers that don't exist yet.
- **Design, not done here:** a Reload control on a failed section (the text says to reload, but there's no button); side by side shows one failure per frame, which could be grouped; text colours from opacity and a few raw values (`.menu-heading`, `.menu-size`, segmented buttons, `#141414`); the bar sits outside any landmark. Taste: the darker accent fill and lighter greys move the shell a little off Airship's exact colours.
- **Not built:** module skills (`SKILL.md`): nothing reads them before TRU-5.2 and TRU-12.1. The MCP transport is TRU-12.1; the tool registry it will serve is `studio.modules.tools`.
- **Workflow note:** while `truing` (or `pnpm dev`) runs on a real app, `real-app.spec.ts` can't start its own dev server: Next allows one per folder.
<!-- SECTION:FINAL_SUMMARY:END -->
