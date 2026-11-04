---
id: TRU-4.1
title: 'The Changes tray and the direct edit engine: stage every visual change, and write what can be written exactly'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-11-01 15:52'
labels:
  - panels
dependencies:
  - TRU-1.5
  - TRU-2.1
type: feature
ordinal: 40010
parent_task_id: TRU-4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A designer's changes come in two kinds, and Truing has to handle both from the same panel (2026-10-31).

**Mechanical changes** can be made as exact source edits with no model call: free of Claude usage, instant, with minimal diffs. Examples:

- swap a token;
- add a breakpoint class to a static class string;
- fix a word;
- switch a variant;
- reorder static siblings.

In Figma Make even these go through the AI agent: 8 credits and several seconds for `rounded-xl` → `rounded-lg` (`docs/research/figma-make-teardown.md`).

**Changes that need judgement** can't be written as a splice, and go to Claude. Examples:

- **most responsive work**: stack this row on phone, turn this table into cards on small screens, hide this column below tablet;
- classes built at runtime;
- elements from a `.map()`;
- changes across several components.

This task builds three things:

- the **Changes tray**, where every visual change is staged the same way whichever path will apply it;
- the **change-set model**: what changed, where in the source, from what to what, and at which viewports;
- the **direct engine** that writes the mechanical kind.

Changes it can't write directly are **routed, not refused**. They are labelled "Claude" and handed to TRU-12.2, which applies them through Claude in the same Apply.

The direct engine follows the recipe from the research (`docs/research/element-to-source-react19.md`), the one shadcn's own codemods use:

- `@babel/parser` to find the node;
- a MagicString splice at exact offsets;
- the repo's own `cn`/tailwind-merge config;
- Prettier with `resolveConfig`.

Before any write, check that the file still matches what the overlay saw.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Change set.** Every visual change is recorded with: the element's source locations (call site and definition); the component and variant; the property; the before and intended values (tokens where they exist); the viewport it was made in, and its scope (all sizes, or from a breakpoint up); whether it can be applied **directly** or needs **Claude**, with the reason; The format is versioned, and TRU-12.2 consumes it.
- [x] #2 **Direct edits, applied without a model:**: set or replace classes in a `className` literal, including breakpoint-prefixed ones; edit the unconditional string argument of `cn(...)`, or insert one before a pass-through `className`; change one variant's classes inside a `cva()` config, after showing how many instances it affects (TRU-2.2); set `variant="…"` (checked against the parsed variants); replace plain JSX text, keeping whitespace and escaping `{ } < >`.
- [x] #3 **Routing, not refusal.** A change the engine can't write directly is staged and labelled "Claude" with the reason in plain words, e.g. "class is built at runtime" or "layout change at Phone size needs restructuring". The designer can also mark any change "let Claude do this".
- [x] #4 **Changes tray.** Changes preview at once in the frame, through an override stylesheet, without touching source; They collect in the tray with their labels, each with its own undo; **Apply** writes the direct changes and passes the Claude ones to TRU-12.2 as one request. Until TRU-12.2 exists, they stay staged; **Discard** drops everything; After the hot reload, the same element is re-selected.
- [x] #5 **Minimal diffs.** A direct edit changes only the target characters, plus whatever Prettier reformats. The file's hash is checked against what the overlay saw, and a mismatch stops with "the file changed; reload".
- [x] #6 **Locked-down endpoint.** The write endpoint accepts requests only from Truing: origin check plus a per-session token. It writes only inside the product spec's UI paths: `src/**/*.tsx`, the project's token stylesheet, the project's UI folders. A test proves a write to server code is refused.
- [x] #7 **Tests.** Jest fixtures cover: literal, `cn`, cva, breakpoint-prefix and prop edits; text edits with RTL, CJK and emoji columns; classification of each "Claude" case; Prettier idempotence; stale-hash rejection; No Claude process starts during the suite.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Everything stays inside the repo, plus one line in `truing.config.ts` to list the new module.

### Calls taken without asking (the maintainer said "move on"; each can be reversed)

1. **The engine is core, the tray is a module.** The writer lives in `src/edits/`, a library the host uses. `ctx.stage` takes a _described_ edit, and the engine decides Direct or Claude and gives the reason, so routing lives in one place, not in each panel. A module's own direct operations (`server.direct`, which TRU-11.5's token writer will need) stay as they are. The tray, its preview and its Apply and Discard are a built-in module, `changes`, as ADR 0001 has it ("the core features (inspect, tokens, edits, chat) are modules too").
2. **TypeScript's parser, not `@babel/parser`.** ADR 0001's table lists `@babel/parser`, but adding it makes pnpm re-resolve the app's own Babel packages in the lockfile (about 100 lines). Truing already parses with TypeScript (`cva.ts`, TRU-2.1), so there is one parser and no new dependency. MagicString and the app's own Prettier (loaded from the project root, with `resolveConfig`) stay as the recipe says. tailwind-merge is pinned to the app's version (3.2.0) and extended exactly as the project's class-merge helper does, from the config's `tailwindMerge` file.
3. **What stages a change in this task:** two producers in the inspector, a variant switch (from the parsed cva variants) and a text field for an element that holds only text. No other task owns these the product spec stories, and the tray can't be proven in a browser without a producer. Class changes come from TRU-4.2 and TRU-4.3; here they are proven by the engine's tests and by staging through the module's server op.
4. **The cva edit's instance count** is a field of the change (`usages`), shown in the tray when it is known. TRU-2.2, still pending, fills it. Until then the tray says the change is to a shared component and changes every instance.
5. **Vitest, not Jest.** Truing's tests run on Vitest; the task's "Jest" predates the package.
6. **Ternaries in `cn()` go to Claude.** Cortex's `TailwindRewriter` is not vendored: an edit to a class inside a condition is staged "Claude" with "class comes from a condition". Vendoring it can follow if the pilot shows many such changes.

### Added on the maintainer's request (2026-11-01, while it was being built)

- **Edit text in place.** A double-click on an element that holds only text makes it editable in the frame. Enter, a click elsewhere or leaving the frame keeps the text, and Esc drops it. It stages the same change as the inspector's Text field. The module contract gains `onDoubleClick`, since the Select guard swallows the event before any module sees it.
- **Interact clears everything of Select's** (the pick, the hover and the pinned measurements), in every frame. This answers TRU-2.5's open call "should Interact clear the pins?".
- **Colour and type stay in TRU-4.3**, and spacing in TRU-4.2, as planned. Both tasks now name `ListItem` (a row of chips on a real page) as a case to handle: a component with no `className` prop and no variants. There, "the component" is direct and "this instance" goes to Claude.

### The change set, version 2 (`src/module.ts`)

Each staged change carries:

- `element`: the tag, a selector for the preview, the classes now, the call site and definition (`file:line:col`), the component with its variants, and the pick's identity for re-selecting after a reload;
- `property` (`padding-inline`, `text`, `variant size`), `before` and `after` as values with their tokens;
- `viewport` (frame and width) and `scope` (all sizes, or from a breakpoint up);
- `edit`, what the engine would write: `classes` at a JSX element, `cva` (one variant's classes, with `usages`), `variant`, `text`; or `null` for an intent only Claude can carry out;
- `route`: `direct`, or `claude` with the reason in plain words and whether the designer asked for it;
- `files`: each file the edit reads, with its SHA-256 when staged;
- `intent`: what the designer wants, in words, for TRU-12.2.

### The engine (`src/edits/`)

- `locate.ts`: the JSX element at a `line:col` (one-based, UTF-16, as TRU-1.1's positions are).
- `classify.ts`: Direct or Claude, with the reason. Claude cases: class built at runtime; class in a condition; element drawn from a `.map()`; no location, or inside a package; text not one literal; variant set by an expression; a variant the component doesn't have; a variant or text change at one size only; the variant's classes built from code; a file outside the writable paths; an intent with no edit.
- `write.ts`: groups the direct changes by file, checks each file's hash (a mismatch stops with "the file changed; reload"), and splices every edit to that file in one MagicString pass:
  - classes merged with the repo's tailwind-merge;
  - `cn()`'s last unconditional string before the pass-through `className`, or a new one inserted there;
  - text with whitespace kept and `{ } < >` escaped;
  - `variant="…"` replaced or added.
    It then formats with Prettier and writes every file only once all of them succeeded.
- Paths: every write is checked against the config's `writable` globs, so server code is refused even if a change names it.

### The tray (`src/modules/changes/`)

- **Server:** ops `stage` (for panels), `remove` (undo one), `route` (let Claude do it, or back), `apply` and `discard`. Apply writes the direct changes and leaves the Claude ones staged, saying so, until TRU-12.2.
- **Probe:** `preview`, an unlayered override stylesheet built from Tailwind's CSS for the classes each change adds (removed ones are unset), scoped to the element's selector, plus the text of text edits. Undo, Discard and Apply drop it.
- **Panel:** in the Design dock, the list with each change's label, its route (Direct, or Claude with the reason), Undo and "Let Claude do this", then Apply and Discard.
- After the hot reload, the selection module's existing restore picks the same element again; the e2e test checks it.

### Endpoint

Apply, stage and the rest travel only on the shell's WebSocket, which already checks the shell's origin and the session token (`authorizeUpgrade`). A frame's runtime can't send a module call at all. Tests cover a wrong origin, a missing token and a runtime that tries, plus a write to server code.

### Proving each criterion

- Change set: schema unit tests, and the e2e payload after a variant switch.
- Direct edits and minimal diffs: fixture tests per edit kind, comparing the written file with an expected file; Prettier run twice gives the same result; a stale hash is rejected.
- Routing: one test per Claude reason.
- Tray: Playwright on the fixture app. A variant switch previews at once, with the source untouched; Undo drops it; Apply writes the file, Next reloads, and the same element is picked again; Discard empties the tray.
- No Claude: the suite never spawns a process (a test spies on `child_process.spawn`).
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
- the change set v2 and the direct engine;
- the tray, the preview, and the inspector's text and variant edits, including the edit in place;
- Interact clears the pick, and a stuck pick is fixed;
- the copy review and the security hardening;
- the task review's findings.

Not pushed, and no PR yet.

### What changed

- **Change set v2** (`src/module.ts`): each change carries:
  - the element (tag, selector, classes, call site, definition, component and variants);
  - the property, and the before and after values with tokens;
  - the viewport and scope;
  - `write`: an engine `edit`, a module's own `op`, or none;
  - `route`: Direct, or Claude with the reason and whether the designer asked;
  - each file it reads, with its SHA-256;
  - `intent`, for Claude.

  `ctx.stage` takes a described change and Truing routes it. `ctx.changes` is the tray (list, undo, discard, "let Claude do this", apply), and panels get `props.changes`. `docs/modules.md` documents it all.
- **Engine** (`src/edits/`): TypeScript's parser, MagicString splices, the repo's tailwind-merge groups, and the project's own Prettier. It writes:
  - `className` literals, breakpoint prefixes included;
  - `cn()`'s unconditional strings, or a new string before the pass-through `className`, even when that is nested in `buttonVariants({ …, className })`;
  - one cva variant's classes;
  - `variant="…"`, checked against the config's own keys;
  - JSX text, keeping whitespace and escaping `{ } < >`.

  Before writing, each edit is checked against the tag at its position, so a stale position is refused. Apply writes every file or none, after checking each file's hash ("… was edited after you made this change. Reload, then redo it."). Writes are limited to the config's `writable` globs.
- **Routing to Claude**, with the reason in plain words, for 17 cases: class built at runtime, class in a condition, written inside the component, drawn from a list, no element at the position, text built at runtime or among other elements, text that differs, variant set at runtime or unknown, variant or text at one size only, cva classes built at runtime, unreadable variants, a file outside the UI paths, a component that may not take a `className`, and "you asked Claude to do this".
- **The `changes` module** (`src/modules/changes/`):
  - the tray in the Design dock, with each change's label, route, frame and width, file, Undo, "Let Claude do this" and, for a cva change, "Changes every Button";
  - Apply and Discard, with one notice that names the change that actually failed;
  - the preview: an unlayered adopted stylesheet scoped to the element (added classes set, removed ones unset), plus text through React's own text node.
- **Producers in the inspector** (Decisions):
  - a variant switch from the parsed cva options;
  - a Text field;
  - a double-click to edit text in place: Enter or a click elsewhere keeps the text, Esc drops it. This needed `onDoubleClick` in the probe contract.

  There is one staged change per element and property.
- **Selection fixes** :
  - Interact clears the pick, the hover and the pins, which answers TRU-2.5's open call;
  - the restore after a reload never picks in Interact or over a newer pick, which is how a pick got stuck.
- **Runtime budget:** the change-set and shell-message schemas are built in functions the bundler drops, so the frame runtime is 81,730 bytes, under its 85 KB budget, with the budget unchanged.
- **TRU-4.2 and TRU-4.3** now name `ListItem` (no `className`, no variants) as a case to handle.

### Deviations from the plan

- The tray's ops are `undo`, `claude`, `apply` and `discard`. Panels stage through their own module's server, so the tray has no `stage` op.
- "No Claude" is enforced by a Vitest global setup: a `claude` that leaves a mark goes first on `PATH`, and the run fails if anything executed it (shown failing when a throwaway test spawned it). There is no spy on `spawn`. Truing has no Agent SDK dependency, which could start the CLI by absolute path.
- The change-set payload is checked in unit tests through the host, not in the e2e test.
- Adding a `className` to a component with none is routed to Claude for now. TRU-4.2 will need the component's own JSX to tell whether it passes one on.

### How it was verified

- `npx tsc --noEmit -p .` (studio) and `pnpm typecheck` (repo): clean.
- ESLint on every changed file: clean.
- `npx vitest run` (studio): 252 passed, in 24 files. Among them:
  - `edits.test.ts`: every edit kind, the RTL, CJK and emoji columns, all Claude reasons, minimal diffs (the original with one substitution, then Prettier), Prettier idempotence, a stale hash, all or none, server code refused, the task review's five cases, and the writable globs;
  - `changes.test.ts`: routing at stage, "let Claude do this", Apply, staleness, a frame's runtime that can't Apply while the shell can, an app-origin socket refused as the shell, the preview CSS, the notice, the shared-component line, and unsafe class names refused;
  - `no-claude.test.ts`: the PATH guard.
- Playwright: every spec except `real-app.spec.ts` passed together, 65 of 65, with `changes.spec.ts` (5) and the new `inspect.spec.ts` Interact test among them:
  - a text edit previews, is Direct, and Undo puts it back, with the source untouched;
  - a variant previews through the stylesheet, and Discard drops it;
  - Apply writes both, the page hot-reloads, the same `<p>` is picked again, and the Button renders its new variant from source;
  - a double-click edit, edited twice, then applied;
  - Esc while editing.

  The fixture page is put back after each test.
- **Security review** (`security-review`, scoped to the write path): no findings at confidence 8 or above. One candidate was rated a false positive at 2/10: a page in a frame could forge a pick and stage an escaped text edit, written only on the designer's Apply. Two hardening steps came from it: unsafe class and variant names are refused, and each tray row shows its file.

### What the reviewers flagged

- **a copy review:** eight findings, all fixed. The worst was a failed Apply's notice hiding its cause.
- **a task review:** "not ready". Fixed: the missing cva reach in the tray, stale positions, `cn()` with a trailing comma, a nested pass-through `className`, inherited variant keys, `className` added to a component, and the `2xl:` escape. Its "hash at page load" point is answered by the tag check, since the hash alone can't catch a line that moves the code without changing the page.

### Left open

- **Not run here:**
  - `real-app.spec.ts`: Next refuses a second dev server in the folder while your studio runs ("Another next dev server is already running"). Run it with Truing closed: `pnpm --filter truing exec playwright test test/e2e/real-app.spec.ts`.
  - a browser check and the a design review on a real app itself, for the same reason. The fixture app has no Tailwind stylesheet, so how the class preview looks on real tokens is unchecked, and so is the tray's look.
- **Taste:**
  - the tray's layout and the warning colour of "Changes every …";
  - Discard has no undo and no confirmation;
  - right after Apply the preview drops a moment before the hot reload lands, so the old style can flash.
- **Limits:**
  - the preview is applied when it changes or when a page loads. After navigating inside a frame, it shows again with the next change;
  - the text preview needs an element with exactly one text node;
  - class changes have no producer until TRU-4.2 and TRU-4.3, and the cva count waits for TRU-2.2.
<!-- SECTION:FINAL_SUMMARY:END -->
