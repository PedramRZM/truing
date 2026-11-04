---
id: TRU-1.3
title: 'Spike: fork Airship, build on Cortex, or compose our own, then record the decision'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-10-31 16:46'
labels:
  - spike
dependencies:
  - TRU-1.1
  - TRU-1.2
type: spike
ordinal: 10030
parent_task_id: TRU-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There is no requirement to adopt an open-source base: the designers don't ask for one, and the best option on the evidence wins, with composing our own scored as an equal (the maintainer, 2026-10-31, replacing the earlier "the design team prefers adopting open source"). The survey (`docs/research/oss-landscape.md`) and the code study leave three serious bases and one alternative:

- **Airship** (MIT, `repos-notes/airship.md`).
  - **Has:** the proxy, real-viewport iframe frames, a CSS cascade engine, token matching, an inspector, staged changes and undo, behind clean seams.
  - **Lacks:**
    - source mapping that works on Next and Turbopack: it rejects `/_next/` chunk URLs, and its source-map library throws on our sectioned maps;
    - any direct writer: every change is an agent turn, with `bypassPermissions` on by default;
    - git hygiene: its PR flow uses `--no-verify`.
  - **Never tested on Next.** From the code, Server Actions would fail through its proxy and streamed pages arrive all at once.
  - Verdict in the note: fork as a separate package, if the spikes pass.
- **Cortex** (MIT, `repos-notes/cortex.md`).
  - **Has the shape we want:** the designer's own Claude Code works through a project MCP server (17 tools); edits are staged in the browser; on Apply, class and style changes are written without a model and the rest goes to Claude; it runs on Next 16 + Turbopack.
  - **Lacks:**
    - knowledge of our named spacing tokens and `var()` colours: it would write `p-3`, not `p-400`;
    - tags on components written as uppercase JSX (our `<Button>`);
    - viewports and git.
  - One maintainer, no commits since 2026-08-27.
- **Onlook's parser** (Apache-2.0, `repos-notes/onlook.md`).
  - **Has:** JSX edit operations with fixture tests (class, prop, text, insert, remove, move, group), and an in-page script.
  - Its app is tied to hosted infrastructure, and it pollutes source (`data-oid`, Prettier defaults, `git add .` with `--no-verify`).
- **Compose our own**, from the parts the study found:
  - bippy and react-grab's server-frame adapter for source (TRU-1.1);
  - Onlook's edit operations, forked to locate by source position;
  - puck's drop-position maths;
  - VisBug's measurement and contrast code;
  - tailwindcss-intellisense's rewriting helpers;
  - our token manifest (TRU-1.4);
  - a shell of our own.

This spike runs the real candidates against a real app and decides. The decision becomes an ADR, because it binds every task from TRU-1.5 on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Isolation.** (Partly met, accepted by the maintainer, 2026-10-31. Cortex had to be installed into its throwaway worktree to run at all. Airship's `--safe` answers its own prompts. See Result, "Isolation".): Each candidate runs unmodified on a scratch branch against `next dev --turbopack`, with the reference clones moved out of the repo first: Airship's file walkers ignore `.gitignore`; Claude runs with permission prompts on, never with `bypassPermissions`; Nothing is installed into the app's dependencies.
- [x] #2 **Works with the app, for each candidate.** (Met, except a full sign-in, which needs a signed-in session; the redirect was checked.): HMR, including after 60 s idle; Navigation between routes; A Server Action; Sign-in; A streamed page; The service worker.
- [x] #3 **Accuracy, for each candidate.** On the 10 elements from TRU-1.1's set, record the call site and definition it reports against the truth.
- [x] #4 **Edits, for each candidate.** (Met through each candidate's own job format or exported code, not its panel UI. Cortex's and compose's Claude-path edits weren't run; Airship's six turns cover that path. See Result, "Edits".) Apply five edits and record the diff, the time taken and whether a model was called: `px-400` → `px-500`; a `text-title-m` swap; a static reorder; a copy change; `variant="tonal-neutral"`; Then make one **responsive** change: stack a two-column row on Phone. Record how it's applied and how it looks at Phone, Tablet and Desktop.
- [x] #5 **Scored.** Each candidate, plus "compose", is scored against the product spec's acceptance criteria: has it, adaptable (effort S, M or L), or missing; Licence and maintenance risk are noted; The table is appended to this file.
- [x] #6 **ADR.** (ADR 0001, accepted by the maintainer, 2026-10-31.) An ADR (through `/adr`) records: the base; where Truing code lives (a workspace package or tools folder outside `src/`; don't use the bare name "Truing", which collides with empty untracked folders under `src/`); the overlay's shape (proxy, in-app runtime, or both); the bridge (from TRU-1.2); what is forked, vendored or depended on, with licences; Truing, the product spec and TRU-1.5 onward are updated to match.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Three candidates, each run on its own throwaway worktree of a real Next 16 app: Airship through its proxy, Cortex through its installer, and our own composed runtime. Same fixture route, same elements, same five edits and one responsive change, and the same checks on the app. The code is not part of this repo. Paths under `spike/` below are kept only as a record.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Measured in two worktrees outside the repo, both on Next 16.2.9 with Turbopack and Chromium driven by Playwright:

- a separate worktree, branch `spike-base`: the app on :3000, Airship 0.3.1 on :3001 through `pnpm dlx`, and compose's pieces;
- a separate worktree, branch `spike-cortex`: the app with `cortex-editor` 0.3.1 installed by its own `cortex init`, on :3010.

Six Claude turns were used, all Airship's, on one Claude seat.

### Isolation: partly met

- **Met:**
  - The clones were out of the tree throughout.
  - Airship ran unmodified through `pnpm dlx`.
  - Nothing reached a branch that merges.
- **Not met as written:**
  - **Cortex can't run without being installed.** `cortex init` added it to the worktree's `package.json`, 643 lockfile lines, `next.config.js` and the root layout, on the throwaway `spike-cortex` branch .
  - **"Permission prompts on" held only in the narrow sense.** Airship's `--safe` is Manual mode, but its `canUseTool` screen answers every prompt itself (see the security review). Cortex and compose never ran Claude in this spike, so the item wasn't exercised for them. TRU-1.2 covers the bridge compose would use.

### Security review before running

Both published packages were unpacked into an empty directory and read before they ran.

- **Airship 0.3.1:**
  - no telemetry and no outbound endpoint of its own;
  - binds `127.0.0.1` by default;
  - writes only `~/.airship/history/`.
  - **Its `--safe` is not human prompts.** It is Manual mode with a `canUseTool` screen that allows every edit inside the project and every Bash command not on a regex deny-list. The repo's own rules and hooks still apply, through `settingSources: ["project"]`. Without `--safe` it runs `bypassPermissions`.
- **Cortex 0.3.1:**
  - telemetry is opt-in only (`CORTEX_TELEMETRY=true`);
  - its panel loads Google Fonts;
  - `cortex init` may spawn a package install.
- Both ran with `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDECODE` and `CLAUDE_PERSONAL_HOOKS` removed from the environment, so the subscription was used and the project's hooks ran.

### Works with the app

`spike/e2e/app-checks.mjs`, one full run per candidate, each with 65 s of idle (`results/app-checks-*.json`).

- **Compose** ran as Truing would: a shell page on its own origin (`127.0.0.1:3020`) frames the app at 390 and 1440. The runtime (TRU-1.1's inspector and bippy's hook, bundled) is injected into every frame by Truing's browser through an init script. **Nothing in the app was changed**, and there is no proxy.
- The streaming row is raw HTTP. For compose it is the app's own response by construction.

| Check                                       | Bare app                         | Compose                          | Airship (proxy, canvas)                                                                         | Cortex (in-app)             |
| ------------------------------------------- | -------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------- |
| HMR                                         | 400 ms                           | 416 ms                           | 327 ms                                                                                          | 403 ms                      |
| HMR after 65 s idle                         | 226 ms                           | 227 ms                           | 270 ms                                                                                          | 755 ms                      |
| `<Link>` navigation                         | soft, 205 ms                     | soft, 151 ms                     | soft, 233 ms, **only in View mode**; Edit mode swallows clicks                                  | soft, 425 ms                |
| Server Action (`revalidateLayoutCache`)     | ok                               | ok                               | **fails: "Invalid Server Actions request."** (HTTP 500)                                         | ok                          |
| Streamed page: fallback, then streamed part | 52 ms, then 3,019 ms             | 44 ms, then 3,018 ms             | **nothing until 3,023 ms, then all at once**                                                    | 53 ms, then 3,022 ms        |
| Sign-in `redirect_uri`                      | `localhost:3000/…/loginCallback` | `localhost:3000/…/loginCallback` | **`localhost:3000/…`: the designer leaves the editor after login**                              | `localhost:3010/…`          |
| `/sw.js`                                    | registers, controls nothing      | registers, controls nothing      | registers a second copy on :3001; controlled none of 3 reloads, and the injection survived each | registers, controls nothing |
| Console errors                              | none                             | none                             | the Server Action's 500                                                                         | none (bridge connected)     |

- Airship's three failures were predicted by its note and are now measured:
  - The Server Action failure comes from the `Host` rewrite. It is fixable with an `x-forwarded-host` header or `serverActions.allowedOrigins`.
  - Streaming is lost because the proxy buffers every HTML response it injects into. That is its design.
  - The sign-in redirect leaves the proxy because The app's auth code builds `redirect_uri` from `Host`.
- Cortex's first run was taken while a stale lock kept its bridge down. It is replaced by this clean run.
- **A full login was not tried:** the spike had no test account. Only the redirect was checked.

### The runtime without touching the app (`spike/inject/`)

TRU-1.1's inspector ran unchanged, injected by Truing's browser into cross-origin frames at 390 and 1440 (`proof.mjs`).

- **On a real app,** with no import, config change or dependency added, three elements resolved exactly in both frames, matching TRU-1.1's compiler records: a server Button, a client Button and server component HTML. On `/spike` it returned exactly the positions the compose prototype below uses.
- **On another app,** TRU-1.1's minimal Next **16.4.3** fixture (`cacheComponents` on, no Tailwind, nothing of ours installed), two elements resolved exactly in both frames, including one rendered in the `Prerender` environment.
- **What this means:** the runtime can live entirely outside the host app. TRU-1.1's inspector has two a real app assumptions that become configuration: the repo-name path strip, and `ui/` as the primitives folder.

### Accuracy on TRU-1.1's ten elements

The truth is TRU-1.1's compiler records for `/spike` (`spike/e2e/truth.mjs`). The fixture files are unchanged from TRU-1.1. Nine of the ten elements have a call site; the server `.map()` row correctly has none.

| Candidate   | Definition (primitive JSX)                                                                          | Call site       | How it was read                                                                                                                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Compose** | **10 / 10 exact**, to the column                                                                    | **9 / 9 exact** | TRU-1.1's resolver (`/tmp/spike/accuracy-lazy*.json`), 1–166 ms after the warm-up; the injected run above agrees on the three it sampled                                                                                                                                             |
| Airship     | 4 / 10 on the right line, no column; 5 land on `button.tsx:68` (`const Comp = …`), 1 on the `.map(` | **0 / 9**       | `airship-accuracy.mjs` picks each element in Edit mode and reads its panel's source chip                                                                                                                                                                                         |
| Cortex      | 2 / 10 exact; **7 / 10 none** (every `<Button>`: uppercase JSX gets no anchor)                      | **0 / 9**       | `cortex-accuracy.mjs` reads each element's own `data-cortex-source`, which is what its selection uses (`selection-metadata.ts:51`). The `asChild` Button reports its inner `<a>` (`client-panel.tsx:45:11`): right for that element, but neither the primitive nor the call site |

### Edits

Targets on `/spike`: `px-400` → `px-500`, `text-title-m` → `text-title-s`, card three to first, a copy change, `variant="tonal-neutral"` on a `<Button>`, and stacking the two-column row on Phone only.

**How each candidate was driven.** None of the edits went through a panel's UI, so none of the numbers measure a designer's gestures.

- **Airship:** each edit was sent as the `CreateJobRequest` its panel builds, over its own socket (`airship-edits.mjs`). The driver wrote the deltas itself, including the `--spacing-500` token and, for the responsive change, the words "Only on phone widths". Airship's deltas have no viewport field, so a designer would have to type those words too. The source sent is the one Airship's chip showed for each target.
- **Cortex:** its exported `TailwindResolver` and `TailwindRewriter`, the classes its pipeline runs (`cortex-direct.mjs`).
- **Compose:** Onlook's operations, bundled unmodified (`compose/onlook-unmodified.mjs`), and the fork prototype (`compose/fork-direct.mjs`). The prototype's positions are written into the script, but they are exactly what the resolver returns for those elements (shown above).

| Edit                       | Airship (each is a Claude turn; time to `job:done`, polled every 1 s)                     | Cortex                                                                                                                                                                                                                  | Compose: Onlook's ops unmodified                                                                                 | Compose: fork by `file:line:col` + MagicString |
| -------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `px-400` → `px-500`        | 16.0 s, one token                                                                         | **off our scale.** The panel sends each side separately (`SpacingControls.tsx:77`), and the resolver maps 16 px to `pl-4` (and `pr-4`). One side run alone replaced `px-400` with `pl-4`. As a direct class swap: 11 ms | 18 ms, class order changed                                                                                       | 86 ms (first call, parser warm-up), one token  |
| text style                 | 15.0 s, one token                                                                         | 12 ms as a class swap; for 14 px its resolver would pick `text-button-sm`                                                                                                                                               | 18 ms                                                                                                            | 12 ms, one token                               |
| reorder                    | 15.0 s, clean move                                                                        | always Claude, by design                                                                                                                                                                                                | 12 ms, adds `key="olk-…"`                                                                                        | 14 ms, clean move                              |
| copy                       | 16.0 s                                                                                    | Claude: no inline text editing                                                                                                                                                                                          | 10 ms                                                                                                            | 11 ms                                          |
| variant                    | 21.0 s; Airship sent `button.tsx:70` as the source, and Claude found the call site anyway | Claude: `<Button>` has no anchor                                                                                                                                                                                        | 9 ms                                                                                                             | 8 ms                                           |
| responsive                 | 22.0 s, `grid-cols-1 gap-400 md:grid-cols-2`                                              | Claude: no viewports, and no breakpoint classes                                                                                                                                                                         | not offered (Onlook writes no breakpoints)                                                                       | 15 ms, `grid-cols-1 md:grid-cols-2 gap-400`    |
| Diff against the real file | the change only, Prettier-formatted by the repo's hook                                    | the change only                                                                                                                                                                                                         | **71–76 lines each**: the first sync adds `data-oid` everywhere and switches to Prettier's default double quotes | the change only, via the repo's `.prettierrc`  |

- **Every Airship edit was correct.** Claude wrote each one cleanly through the repo's hooks.
- **The fork prototype matched Claude's diffs on the five non-responsive edits, line for line, with no model.** On the responsive edit, only the class order differs. An edit made in the Phone frame "for this size only" is mechanical in Tailwind's mobile-first model: the new class becomes the base, and the old one moves to `md:`.
- **Timing.** The fork's times are in-process function calls (8–86 ms). Airship's are end-to-end jobs, polled every 1 s (15–22 s). The gap is a few orders of magnitude, not an exact ratio.
- **Responsive screenshots, by row height:**
  - Airship's result: stacked at 390, side by side at 768 and 1440.
  - Compose's: 110 px at 390 (stacked), 49 px at 768 and 1440.
- **Not run, and why:**
  - Cortex's Claude-path edits: those are plain Claude Code calls, which Airship's six turns and TRU-1.2 already measure.
  - Compose's responsive change through TRU-1.2's bridge: the direct writer handled it, and a Claude turn on the same intent is Airship's 22 s run.
  - So Cortex and compose used no Claude turns.
- **The prototype's limits:**
  - It writes only static strings and literal JSX text; anything else is refused and labelled for Claude.
  - It doesn't yet write inside `cn()` arguments or `cva()` configs. Cortex's `TailwindRewriter` already handles static `cn()` arguments and ternaries (MIT, vendorable). The `cva()` writer is new work in TRU-4.1, on TRU-1.1's parser.

### Extensibility (the maintainer's criteria)

I searched both codebases for a plugin or extension seam, and for any performance feature. Compose has none yet either. Its cells say what it would take, not what exists.

| Criterion                                   | Airship                                                                                                                                                                          | Cortex                                                                                                       | Compose                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin system                               | **none.** Agent kinds are a closed enum; the panel hard-imports its 18 inspector sections; `app.ts` (4,892 lines) and `panel.ts` (3,572) are the integration points. Retrofit: L | **none.** A framework-adapter seam only; all 17 MCP tools are registered inline in `cli/mcp.ts`. Retrofit: L | **missing; to build first, M.** A module has up to four parts: an in-frame probe, a panel section, bridge handlers and direct ops, and Claude tools plus a skill. The core features are built as modules too, which keeps the contract honest                                                  |
| Performance monitoring of the page          | none (no Web Vitals, `PerformanceObserver` or render tracking anywhere)                                                                                                          | none                                                                                                         | missing, M: a module on `web-vitals` (Apache-2.0, Google, active) and `PerformanceObserver`, and `react-scan` (MIT, 21.9k stars) for React renders. react-scan is built on bippy (its 0.5.7 pins bippy ^0.5.39 against our 0.7.3, to check)                                                    |
| Perf findings to Claude for an optimisation | none                                                                                                                                                                             | none                                                                                                         | missing, S on that module: a finding is staged like any other change, with the element's source and the metric. Claude gets `chrome-devtools-mcp` (Apache-2.0, Google, 1.12.0), whose `performance_start_trace`, `performance_analyze_insight` and `lighthouse_audit` measure before and after |
| Token integrations                          | a regex scan built into the core; it drops `.dark`, files line-heights under sizing, and hides primitives (its note)                                                             | a parser built into the core on Tailwind's default scale (measured above)                                    | missing, M: TRU-1.4's manifest behind one adapter. Lint (TRU-11.6), token writing (TRU-11.5) and Figma export (TRU-19.3) are modules on it                                                                                                                                                                    |
| Adding what is missing                      | each feature edits vanilla-DOM files of 1.6–4.9k lines                                                                                                                           | each feature edits the Preact panel and `mcp.ts`                                                             | a new module, once the contract exists                                                                                                                                                                                                                                                         |

### Score against the product spec

"Has" means it works on a real app today, as measured. "Adaptable" gives the effort to close the gap, for one engineer: S ≤ 3 days, M about 1–2 weeks, L ≥ 3 weeks.

| the product spec acceptance criterion                                               | Airship                                                                                                                 | Cortex                                                                                                      | Compose                                                                                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| One command from checkout to Truing (TRU-13.1)                     | missing, M                                                                                                              | missing, M                                                                                                  | missing, M                                                                                                                                          |
| Click shows component, variant, both locations, tokens (TRU-2.1)          | adaptable, L: 0/9 call sites, no props or variants; the resolver must be replaced                                       | adaptable, L: 7/10 have no location, and there's no component identity                                      | adaptable, M: the resolver is measured (10/10 and 9/9, props, 566 cva combinations); the panel and token names are to build                         |
| Instances (TRU-2.2)                                                       | missing, M (class scope only)                                                                                           | adaptable, M ("Editing all N" by anchor)                                                                    | adaptable, M (the grouping is proven in TRU-1.1)                                                                                                       |
| Off-token flags with nearest tokens (TRU-11.2)                             | adaptable, M (badges per field; the scan misreads our file)                                                             | missing, M (its resolver is on Tailwind's default scale)                                                    | missing, M (on TRU-1.4)                                                                                                                                |
| Direct writes, no model, minimal diff (TRU-4.1)                           | **missing, L**: every edit is a 15–22 s turn                                                                            | adaptable, M–L: an exact rewriter, but the resolver is off our scale, and only 2 of 6 edits can be direct   | adaptable, M: 6 of 6 prototyped with minimal diffs; `cn()`, `cva()`, the tray and undo to build                                                     |
| Create a token (TRU-11.5)                                                  | missing, M (only by asking in the prompt)                                                                               | missing, M                                                                                                  | missing, M                                                                                                                                          |
| Viewports, side by side, "from this size up" (TRU-1.5, TRU-4.2)              | adaptable, S–M: has the frames and side by side; no route box, and deltas carry no viewport                             | missing, M                                                                                                  | adaptable, M: the shell frames the app at real widths (above); vendor Airship's `frames.ts` (MIT)                                                   |
| Non-direct change through Claude with per-viewport intent, undo (TRU-12.2) | adaptable, M: Claude did all six well, but there's no viewport and no per-frame screenshots                             | adaptable, M (the needs-source-edit loop)                                                                   | adaptable, M–L, on TRU-1.2's bridge                                                                                                                    |
| Chat, annotations, UI-only permissions (TRU-5.2, TRU-12.1 and TRU-17.1)                     | adaptable, M: the Agent SDK on the login (against TRU-1.2), and `--safe` auto-allows                                       | adaptable, M: chat is the designer's own Claude Code, and annotations exist                                 | adaptable, M: TRU-1.2 proved the permissions, the prompt tool and the packaging                                                                        |
| Send as a PR into the feature branch (TRU-13.2)                            | adaptable, S (PRs go to the default branch with `--no-verify`)                                                          | missing, S                                                                                                  | missing, S                                                                                                                                          |
| No Truing code in a build (TRU-1.5)                                   | has (nothing in the app)                                                                                                | adaptable, S: a dependency, a layout component, `serverExternalPackages` in every phase, 643 lockfile lines | has, with the injection above (nothing in the app); S for the CI check                                                                              |
| Works with the app (this spike)                                        | **fails 3 checks**: Server Actions, streaming, sign-in return                                                           | passes                                                                                                      | passes (measured above)                                                                                                                             |
| Licence and maintenance                                                | MIT; one maintainer; ~100k lines of vanilla TS; quiet since 2026-09 apart from a 2026-10-24 dependency sweep; 730 stars | MIT; one maintainer; no commits since 2026-08-27; npm behind `main`; 0 stars                                | our code, and **also a bus factor of one** (the maintainer is the only developer); dependencies MIT and Apache-2.0; the vendored files are ours to maintain |

### Recommendation: recorded as ADR 0001

**Compose our own. Don't fork Airship or build on Cortex.**

- **The two hard parts are ours and measured.**
  - Element → source: 10/10 and 9/9 exact, against 0/9 call sites for either base.
  - Direct writes: the prototype matched Claude's diffs with no model, in milliseconds.
  - Neither base helps with either one, and each would need its resolver and token layer replaced (L).
- **Airship's proxy breaks the app**: Server Actions, streaming and the sign-in return. Its frames and cascade engine are good, and MIT, so we vendor those files instead of forking ~100k lines.
- **Cortex's shape is right; its code is not ours to grow.** One maintainer, dormant, and it doesn't see our components or tokens. We take its rewriter (MIT) and the shape of its MCP loop.
- **Extensibility.** Neither base has a plugin seam or any performance feature, and adding one means editing files of 1.6–4.9k lines. Composing lets the module contract come first. Performance arrives as the first module, from `web-vitals`, `react-scan` and `chrome-devtools-mcp`.
- **What composing costs.** We build the shell, the panels and the module contract (L), and we carry the maintenance ourselves. That was true of every option once the parts Airship and Cortex lack are counted. Neither base offers more maintainers than we have.

### Left for a person to check

- **A full sign-in** through the shell, once TRU-13.1 gives a signed-in session.
- Whether `react-scan`'s bippy 0.5 coexists with our pinned bippy 0.7.3 in one page (both install React's DevTools hook). The performance module's first task checks this.
- **Leftovers:**
  - all servers are stopped and the clones are back in the package;
  - the worktrees a separate worktree and a separate worktree, and the branches `spike-base` and `spike-cortex`, are kept, like TRU-1.1's and TRU-1.2's spike branches;
  - the watch limit was raised to 524,288 for this session only (`sysctl`, not persistent), and two dev servers need it.
<!-- SECTION:FINAL_SUMMARY:END -->
