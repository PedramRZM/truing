---
id: TRU-2.2
title: 'Show every instance of the selected component, and tell an instance edit from a component edit'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-11-02 09:02'
labels:
  - inspector
dependencies:
  - TRU-2.1
type: feature
ordinal: 20020
parent_task_id: TRU-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design team asked for easy same-component detection. Figma Make only offers "all elements with the class `.rounded-xl`" (`docs/research/figma-make-teardown.md`, Selection mode). A real UI is made of components with variants, and a shared button can have hundreds of call sites. So "same" has to mean the same component type, and optionally the same variant.

Before any edit, the designer needs to see the difference:

- changing **this** usage touches one call site;
- changing the **component** touches every usage, on this page and elsewhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Instances.** With an element selected, "Instances" highlights every instance of the same component type on the page, with a count. A filter narrows it to the same variant (e.g. `Button · tonal-neutral`).
- [x] #2 **Codebase usage.** The inspector shows how many call sites the component has in the codebase, from a static search of `src/`, and lists them with file and line.
- [x] #3 **Choosing the scope.** Before an edit, the designer picks "this instance" or "the component (N usages)". The second is labelled as a shared-component change and carries into the PR (TRU-13.2).
- [x] #4 **Wrapped components.** Components wrapped in `memo` or `forwardRef` are recognised as the same type as their unwrapped use.
- [x] #5 **Lists.** An element from a `.map()` is shown as one call site rendered N times, not as N components.
- [x] #6 **Tests.** A Playwright test on a fixture page with three `Button` variants and a mapped list checks the counts and highlights.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Everything lives in the package, plus one line in `truing.config.ts`.

### Decisions (2026-11-01): scope follows where the code is written

- **This use** keeps today's behaviour: `variant="…"` and text at the call site are direct.
- **Every X** writes text that lives inside the component directly, as a shared change.
- Anything else goes to Claude, with the reason:
  - a variant switch under "Every X", because a variant is set on each use;
  - text set at the use under "Every X";
  - "This use" on text written inside the component, because one use can't change alone.
- When the component has a single use in the code, the two are the same, so there's no picker. A change written inside the component is still recorded as shared, with 1 use.
- The change set records the scope (version 3) so TRU-13.2 can put it in the PR.

### Calls taken without asking (each can be reversed)

1. **"Same component" means the same resolved type.**
   - At run time, instances are grouped by `getType(fiber.type)` (bippy unwraps `memo` and `forwardRef`).
   - Only fibers that render are counted (function, class, forwardRef, simple memo), so `memo(Card)` and `Card` count once each, not twice.
   - Server Components are grouped by name, from Flight's `_debugInfo` records. Names can collide, which is the limit the research named.
2. **A call site is the JSX position React recorded** (the instance's `_debugStack` frame). Instances from one `.map()` share it, so the list shows `file:line ×N`.
3. **The codebase search follows imports, not text.**
   - TypeScript's parser reads each file under the config's new `source` folder (`src` for Truing). Only files whose text contains the name get parsed.
   - It resolves each import with TypeScript's own module resolution, using the project's `tsconfig.json` paths.
   - It counts the JSX tags that resolve to the component's module and export: named, aliased, namespace (`Dialog.Content`) and default imports, plus uses inside the component's own file.
   - For each use it reads the static variant props (`variant="tonal"`) and whether it sits inside a `.map()`.
   - Barrel re-exports aren't followed. the real app has one such barrel in its components (`card/index.tsx`).
4. **`usages` moves from the `cva` edit to the change's new `reach`** (`{ kind: 'use' }` or `{ kind: 'component', name, usages }`). That way every shared change carries it, not only cva ones. A cva edit is always component-wide; the host sets that if a producer forgets.
5. **The outline colour for instances** is the accent at a thin solid line with a light fill. TRU-16.2 sets component colours later.

### Steps

1. **Static uses** (`src/modules/selection/usages.ts`): find the component's module from the call-site file's import, then every use under `source`, with file, line, column, static variants and `inList`. Files are cached by mtime. Vitest runs it on a small project fixture: named, aliased, namespace and default imports, a `.map()`, a use in its own file, an unrelated component with the same name, and a `@/` path alias.
2. **Instances in the probe:**
   - `ownerAt(host, index)` in `fibers.ts` walks the same way as `chainOf`;
   - `instances.ts` collects every instance of a type, its top-level host elements (through portals), its creation frame and its variant props;
   - the overlay gains `instances(elements)`;
   - probe commands `instances` (compute and report the groups) and `outline` (outline a subset of ids, or none).
3. **Server ops:**
   - `instances`: the pick, then the rule's component link, then the probe. Frames become project paths and variant defaults are filled from cva.
   - `usages`: the static search for the pick's component.
   - `stage-text` and `stage-variant` take `reach`, routed as above.
4. **Change set v3** (`src/module.ts`, the host, docs/modules.md): `reach`. The tray marks shared changes "Shared component" with the count, read from `reach`.
5. **Panel:**
   - an Instances section: Outline toggle, the count, the variant filter (`Button · tonal`), and this page's call sites with ×N, where hover outlines that call site's instances and a click picks one;
   - "In the code": the count of uses and a list with file:line, Open and Copy;
   - the scope picker above Edit.
6. **Fixture route `/instances`:** three `Button` variants, a mapped list of Buttons, a component used plain, through `memo` and through `forwardRef`, and a Server Component's Button.
7. **Playwright `instances.spec.ts`:** the counts and highlights, the variant filter, the list as one call site ×N, the wrapped component counted as one type, codebase uses with file and line, and the scope reaching the tray and the change set.

### How each criterion is proved

| Criterion       | Proof                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Instances       | e2e: outline count in the overlay's shadow root equals the count shown; the filter narrows it                         |
| Codebase usage  | Vitest on the usages fixture; e2e on the fixture app; a timed run on a real app's Button (about 414 uses in 160 files) |
| Choosing scope  | Vitest on the routing; e2e: "Every …" text edit staged as shared with its count, then the change set's `reach`         |
| Wrapped         | e2e: `memo` and `forwardRef` uses counted with the plain one; Vitest on the grouping                                |
| Lists           | e2e: the mapped Buttons show as one call site ×3                                                                    |
| Tests           | the spec above                                                                                                      |

### Added on the maintainer's request (2026-11-01)

- **The gallery reuses this.** `usages.ts` takes a component as a module and an export, not as a pick. TRU-15.1 can then list any component's uses and per-variant counts from the same index. TRU-15.1 now has that criterion.
- **Similar components** (find look-alikes in a feature and suggest merging them) is new work: TRU-15.2, after TRU-15.1.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
- the plan, TRU-15.2, and TRU-15.1's new criterion;
- the uses index;
- the change set v3;
- Instances, the uses in the code, and the scope choice;
- speed and layout;
- the copy review's fixes;
- the task review's fixes.

Not pushed, and no PR yet.

### What changed

- **Uses in the code** (`src/modules/selection/usages.ts`):
  - It names a component by module and export, not by the pick, so TRU-15.1 and TRU-15.2 can ask about any component.
  - TypeScript's parser reads the config's new `source` folder (`src` for Truing), and TypeScript's own module resolution follows the imports through the project's `tsconfig.json`.
  - It counts named, aliased, namespace and default imports, and uses inside the component's own file.
  - It follows `memo(X)` and `forwardRef(X)` wrappers declared in that file, including `export default memo(X)`.
  - For each use it records the static attributes (the variants), whether props are spread, and whether it sits in a `.map()` (the engine's `insideList`).
- **Instances on the page** (`instances.ts`, run in the probe):
  - Client instances are grouped by `getType(fiber.type)`, counting only fibers that render. `memo` and `forwardRef` are the component they wrap, and a full memo's inner fiber takes the memo's call site.
  - Server Components are grouped by name from Flight's records and joined to the client's by that name. the real app's primitives have no `'use client'`, so one page can draw both kinds.
  - Instances are grouped by the JSX position React recorded, so a `.map()` is one call site drawn N times.
- **The overlay** outlines every instance under the other outlines. Probe commands `instances` and `outline`.
- **The inspector's Instances section** (Design dock):
  - an Outline toggle and "N on this page";
  - a filter, "All variants" or "Button · tonal · default";
  - "On this page · N uses": each place in the code with ×N and "· this use". Hovering a row outlines that place's instances, and a click picks one;
  - "In the code · N uses": each file:line with Open and Copy, and "· in a list".
  - The lookups start with the inspection, not after it. The source is read once when Truing starts.
- **Scope** (Decisions):
  - "This use" or "Every Button · N uses" above Edit, held by the server per frame, so an edit in place follows it too. A new pick starts at "This use", and a component with one use shows no choice.
  - `decideReach` (`reach.ts`) routes the edit: text written inside the component is direct only under "Every"; text at the use, or a variant switch, is direct only under "This use"; anything else goes to Claude with the reason.
  - "Written inside" means the component's own render wrote that JSX and it holds literal text. An asChild Button's text, or `<h2>{title}</h2>`, is set at the use.
- **Change set v3** (`src/module.ts`, the host, docs/modules.md): each change has a `reach`, either `{ kind: 'use' }` or `{ kind: 'component', component, usages }`. The cva edit's `usages` moved there, and a cva edit is always the component's. The tray's "Changes every Button: N uses in the code" now reads it, so TRU-13.2 can tell shared changes apart.
- **Config:** `source` (`src` for Truing, `test/fixture-app` for the tests).

### Deviations from the plan

- The scope is held on the server per frame (op `reach`), not passed with each stage op. Otherwise the edit in place, which comes from the probe, couldn't follow the panel's choice.
- Both lists fold under disclosures. On a real app's `/`, 16 call sites pushed Edit, Props and Styles off the dock.
- The plan's static search skipped wrappers. It now follows them in the component's own file, so the page and code counts agree for `memo` and `forwardRef`.
- The runtime got over its 85 KB budget (85,486 bytes). It was brought back by folding helpers, not by raising the budget, and is now 84,770 bytes.

### How it was verified

- `npx tsc --noEmit -p .` (studio): clean. ESLint on every changed file: clean.
- `npx vitest run` (studio): 267 passed. New and changed tests:
  - `usages.test.ts` (7): path alias, aliased and namespace imports, own file, a list, a spread, a same-named unrelated component, default imports, memo and forwardRef, `export default memo`;
  - `reach.test.ts` (7): every routing case;
  - `changes.test.ts`: a cva edit's reach is the component, and any other edit's is one use.
- Playwright, every fixture spec: 72 of 72. `instances.spec.ts` passed 14 of 14 across two runs. Its 7 tests cover:
  - outlines and their count, 7, narrowed to 5 for the variant, and 0 when switched off;
  - a list as one call site ×3, where hover outlines 3 and a click picks the first;
  - memo and forwardRef counted as Badge, 4 on the page and 4 in the code;
  - the code list with file:line and "in a list", its count equal to its length;
  - "Every Badge" text Direct and shared; "This use" sent to Claude with the reason;
  - a Server Component's Button as an instance of the client's;
  - text from a prop: the engine's own reason under "This use", shared under "Every".

  The wrapper test was shown to fail ("3 on this page") with forwardRef left out.
- `real-app.spec.ts`: 6 of 6, on the final code.
- **A real app by hand** (a throwaway spec, not committed), picking the signed-out header's Button:

  | Route     | On the page | Outlines drawn | In the code |
  | --------- | ----------- | -------------- | ----------- |
  | `/`       | 16          | 16             | 414 uses    |
  | `/list` | 10          | 10             | 414 uses    |

  - The scope shows "Every Button · 414 uses".
  - Timing: the instances op takes 20–100 ms and the code search 50–86 ms warm. A warm pick shows Instances about 550 ms after the click, down from 1.0–1.6 s before the lookups started together. The first search reads the source in 0.6–1.2 s, now started with Truing.
- **UI:** screenshots of the Design dock on a real app at 1440 px, which led to folding the lists and renaming the filter. The a design review agent and the 412 px pass weren't run.

### What the reviewers flagged

- **a copy review:** three findings, all fixed:
  - "Not in this project" claimed a cause the code can't tell; it is now "Place not known".
  - The scope group repeated its section's name ("Edit"); it is now "Which uses to edit".
  - "Call site" and "use" named one idea; the lists now say "On this page · N uses" and "· this use".
- **a task review:** "not ready". Fixed:
  - client and server instances counted apart (high);
  - text from a prop treated as written inside;
  - a re-pick clearing the outlines;
  - default exports.

  Its point that no PR exists yet is Decisions.

### Left open

- **Glossary:** the inspector's existing "Call site" label stays beside the new "use". Pick one word.
- **Taste:**
  - the outline colour (the accent, a faint fill), until TRU-16.2 sets component colours;
  - long segmented labels in the ~300 px dock ("Every SidebarMenuButton · 12 uses").
- **Limits:**
  - Server and client instances join by name, so two components with one name would join.
  - Barrel re-exports aren't followed (a real app has one, `card/index.tsx`).
  - The first pick right after Truing starts can wait about 2 s for the source read.
- **Runtime budget:** 84,770 bytes of 85,000, so the next probe feature needs the budget raised or something moved out.
- **Seen, not changed:** a text edit staged while the pick's report still has no locations (straight after a hot reload) goes to Claude with "place isn't known". This comes from TRU-4.1's staging. The tests wait for the place, as a designer would.
<!-- SECTION:FINAL_SUMMARY:END -->
