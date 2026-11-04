---
id: TRU-1.5
title: 'Truing''s shell: its package, its browser, the app in frames, routes and viewports'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-10-31 20:19'
labels:
  - infra
dependencies:
  - TRU-1.3
type: feature
ordinal: 10050
parent_task_id: TRU-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Everything a designer does happens around the running app. That means a frame showing a route, with:

- a route box;
- viewport presets;
- a mode switch between Select and Interact;
- the panels the later tasks fill in.

ADR 0001 settles the shape:

- **No proxy, and nothing in the app.** Truing opens its own Chromium window and injects its runtime into every frame of the app through an init script. TRU-1.3 measured this on a real app and on a plain Next 16.4.3 app: every app check passed, and elements resolved exactly with the app untouched (`TRU-1.3`, "The runtime without touching the app").
- **The code** lives in the package (`truing`), a pnpm workspace package that imports nothing from the app.
- **Everything specific to a project** goes in one config file at the repo root, so Truing could move to another project at no cost in quality.

The product spec's two rules still hold:

- Truing exists only in local development;
- none of its code reaches a production or preview build.

The second now holds by construction, and CI still proves it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **The package.** The package is a pnpm workspace package with its own dependencies, `tsconfig` and tests; A lint rule or test fails if it imports from `src/`; A `THIRD_PARTY_NOTICES.md` lists every vendored file with its source and licence; Airship's `frames.ts` is the first.
- [x] #2 **Config.** `truing.config.ts` at the repo root holds everything specific to a project. Truing reads nothing else from the project except the source files it edits. The config holds: the dev command and port; the primitives folder (`ui/`); the token stylesheet (the project's token stylesheet); the writable paths (the product spec's UI paths); the branch naming (`design/<feature>`).
- [x] #3 **Start.** `truing` (from TRU-13.1's command, or on its own for a developer) does three things: starts the app if it isn't running; starts Truing's local server; opens Truing's Chromium window on the shell; `pnpm dev` behaves exactly as today.
- [x] #4 **Injection.** The runtime is injected into every app frame by the window's init script, with bippy's hook first so React keeps its owner stacks; The runtime connects to Truing's server over a loopback WebSocket that checks the page's origin and a per-session token. The token comes from the init script, never from page markup; The runtime is a stub here (a hello and a ping). TRU-2.1 fills it.
- [x] #5 **The frame.** The app shows in a frame with a route box: typing a path navigates, and navigating inside the app updates the box; Reload works, and the dev server's compile errors show inside the shell.
- [x] #6 **Viewport presets.** Phone 390, Tablet 768, Desktop 1440 and Custom (width × height) resize the frame. The app's own breakpoints respond, which a Playwright test checks at each preset.
- [x] #7 **Side by side.** A side-by-side view shows Phone, Tablet and Desktop frames of the same route at once, each selectable and scaled to fit. Navigation in one follows in the others, so a responsive change is judged at every size before Apply.
- [x] #8 **Modes.** Select and Interact switch with a key (V and I, as in Make). In Interact, the app behaves normally. In Select, clicks don't reach the app (window capture listeners in the runtime, as TRU-1.1 proved).
- [x] #9 **The app still works.** TRU-1.3's `app-checks.mjs`, ported as a Playwright test through the shell, passes: HMR, including after 60 s idle; `<Link>` navigation; a Server Action; a streamed page arriving in parts; the sign-in redirect returning to the app; `/sw.js` taking no control; A full sign-in through the frame passes once TRU-13.1 provides a signed-in session.
- [x] #10 **No Truing code in a build.** A CI step builds the app and searches the output for Truing's marker string, and fails if it is found. It runs on every PR.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
The shell takes Airship's look and flow as its model, with ideas from the other clones (2026-10-31), and is brought up early so the maintainer can try it while it is built.

**A conflict, and how it's settled.** TRU-1.3's app checks need fixture routes: an HMR marker, a Server Action button, a streamed page. This task also requires an empty diff under `src/`. So:

- the checks that need fixtures (HMR and HMR after idle, `<Link>`, a Server Action, streaming, a compile error) run through the shell against a **minimal Next app inside the package**, `test/fixture-app/`, on the same Next and React versions as a real app. That also proves Truing works on an app with nothing of ours in it;
- the checks specific to a real app (the sign-in redirect leaving for the identity provider with `localhost:3000` as the return, `/sw.js` taking no control, the app's own breakpoints at each preset) run through the shell against a real app's real routes, with no change to the app.

**Decisions taken here (not product or data-model decisions; say if any should change):**

- The shell is React 19, bundled by esbuild at start, styled with plain CSS variables. No Tailwind or shadcn: the shell imports nothing from the app.
- The shell is served on `http://localhost:<studio port>`, the same site as the app on `localhost:3000`. TRU-1.3's spike used `127.0.0.1`, which makes the frame cross-site, so the app's `SameSite=Lax` session cookie would not be sent inside it.
- One message bus: the shell and every frame's runtime connect to Truing server's WebSocket, and the server relays between them. Each frame is told apart by its iframe `name`, which the runtime reads as `window.name`.
- The window is a persistent Chromium profile under `~/.cache/truing/<project>/`, so a sign-in survives restarts.
- The marker check runs in the project's deploy workflow, after the build and before the deploy, so it gates every deploy.

**Steps:**

1. **Package and config.** The package added to `pnpm-workspace.yaml`, with its own `package.json` (bippy pinned to 0.7.3), `tsconfig.json`, vitest and Playwright configs. `truing.config.ts` at the root holds the dev command and port, the primitives folder, the token stylesheet, the writable paths and the branch naming. The root `tsconfig.json` and Jest skip `tools/`. Root script `truing`.
2. **Start.** `src/cli.ts`: loads the config, probes the app's port and starts the dev command only if nothing answers, starts Truing server, launches Chromium with the init script, and opens the shell. Closing the window stops what it started.
3. **Injection and server.** The runtime bundle starts with `bippy/install-hook-only`; the session token and the server's address are compiled into its closure at start, never written to `window` or markup. It runs only in frames on the app's origin whose parent is the shell (`location.ancestorOrigins`). The server accepts a WebSocket only with an allowed `Origin` (the app's or the shell's) and the session token; the runtime sends a hello and answers pings.
4. **The shell, Airship-like.** Toolbar with the route box, reload, viewport presets (Phone 390, Tablet 768, Desktop 1440, Custom W × H), side by side, and the Select / Interact switch (V, I); a canvas with the frame or frames scaled to fit and labelled; empty panel slots for TRU-2.1 and later. The runtime reports each navigation (`pushState`, `replaceState`, `popstate`, loads), and in side by side the other frames follow.
5. **Select mode.** Window capture listeners in the runtime stop pointer, mouse, click and submit events from reaching the app; V and I work inside the frame too, except while typing in a field.
6. **Tests.**
   - Vitest: the import guard (nothing under the package imports `src/` or `@/`, and a planted bad import is caught), the WebSocket's origin and token checks, config loading, the marker check script.
   - Playwright through the shell: presets and breakpoints, side by side and following navigation, modes, the route box, reload, a compile error shown, and the ported app checks (fixture app and a real app, as above).
7. **No Truing code in a build.** `scripts/check-build.mjs` searches build output for the marker and fails if found; it also checks that Truing's own runtime bundle contains the marker, so the check can't pass by searching for the wrong thing. Added to the deploy action.
8. **Notices.** Airship's `frames.ts` vendored under `src/vendor/airship/` with its licence, listed in `THIRD_PARTY_NOTICES.md`.

**Added while the shell was being tried (2026-10-31).** These came from using it; they extend the frame and viewport criteria:

- Airship's layout: the whole window is a dot-grid canvas, with floating docks (Layers, Design) that start as pills and a bar at the bottom. The colours, type and radii are Airship's editor tokens.
- The canvas pans and zooms as in Figma:
  - pan with the wheel or trackpad, Space and drag, a middle-button drag (even one starting over a frame), or the hand tool (H);
  - zoom with Ctrl or ⌘ and +, - or 0, through Chrome's zoom levels (90, 100, 110 %). The keys work with focus inside a frame too, so Chromium never zooms the window;
  - zoom centres on the selected frame; Ctrl and the wheel zoom about the pointer, about 10 % a notch;
  - ⇧1 fits the frames to the window, ⇧0 goes to 100 %.
- Every frame resizes from all four edges and all four corners, as in Airship: a left or top edge keeps the opposite edge put, and Esc cancels the drag.
- The viewport menu lists Airship's devices under the three presets. A dragged size that matches a device takes its name.
- In side by side, the frame last clicked or typed in leads, and the others follow its route. Without this, a real app's `/` (a fresh chat on every load) set the three frames chasing each other.

**Decision change:** `frames.ts` is vendored trimmed to its device presets, not whole. Its `FrameManager` drives Airship's vanilla-DOM canvas, which the React shell doesn't use; vendored whole, it would be dead code. The shell's fit, zoom and grip behaviour follows Airship's code, rewritten; `THIRD_PARTY_NOTICES.md` lists both the vendored file and what was adapted.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The package (`truing`) is built. `truing` (or `truing --watch` while working on the shell) starts the app if nothing is on its port, starts Truing's server, and opens Truing's Chromium window on the shell. It was used on a real app while it was built; what that added is listed under the plan above.

**How each criterion was checked**

| Criterion                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The package               | Own `package.json` (bippy pinned to 0.7.3), `tsconfig.json`, Vitest and Playwright. `test/unit/import-guard.test.ts` fails on an `@/` import or a path out of the package, and catches three planted ones. `THIRD_PARTY_NOTICES.md` lists Airship's `frames.ts` first.                                                                                                                                                                                                                                                                                            |
| Config                    | `truing.config.ts` at the root holds the dev command and port, primitives, token stylesheet, writable paths (tests excluded, as the product spec asks) and branch pattern. It imports Truing's type only, so the app has no dependency on Truing. Loaded with `jiti`, so it reads the same under any runner. `test/unit/config.test.ts`.                                                                                                                                                                                                                        |
| Start                     | Run by hand with the app stopped (it starts `pnpm dev`, and stops it when the window closes) and with it running (it attaches). A dev server Truing started is also stopped if Truing crashes. `pnpm dev` itself is unchanged.                                                                                                                                                                                                                                                                                                                            |
| Injection                 | The runtime is an init script with the session compiled into its closure; bippy's hook comes first, installed in every page of Truing's window. The server accepts a socket only with the right origin for its role and the session token (`test/unit/server.test.ts`, 11 tests, including a malformed frame that no longer crashes it). `shell.spec.ts` checks the token is nowhere on `window` or in the markup of an app frame. The init script is 52 KB, after moving the message schemas to `zod/mini` and bippy to its hook-only entry (it was 658 KB). |
| The frame                 | `shell.spec.ts`: typing a route navigates; a `<Link>` in the app updates the route box; reload keeps the route; a compile error shows in the frame (Next's own overlay).                                                                                                                                                                                                                                                                                                                                                                                          |
| Viewport presets          | `shell.spec.ts` at Phone 390, Tablet 768, Desktop 1440 and Custom 1000 × 700: `innerWidth` matches and the fixture's breakpoints respond. `real-app.spec.ts` checks a real app's own header at all three.                                                                                                                                                                                                                                                                                                                                                             |
| Side by side              | `shell.spec.ts`: three frames inside the window, selectable; a navigation in the Phone frame moves Tablet and Desktop to the same route.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Modes                     | `shell.spec.ts`: clicks don't reach the app in Select and do in Interact; V and I work with focus inside the frame.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| The app still works       | `app-checks.spec.ts` (TRU-1.3's checks, through the shell) on a plain Next app in `test/fixture-app/`: HMR, HMR after 60 s idle, a soft `<Link>` navigation, a Server Action, and a streamed page arriving in parts. `real-app.spec.ts` on a real app: the sign-in redirect's `redirect_uri` is the app's own origin, and `/sw.js` controls nothing. A full sign-in waits for a signed-in session.                                                                                                                                                                          |
| No Truing code in a build | `scripts/check-build.mjs` runs after the build and before the deploy, on every push. It first bundles the runtime and fails if the marker isn't in it, so it can't pass by searching for the wrong thing. On a real `next build` of a real app: clean, 8,738 files. With the real runtime bundle planted in a copy of the output: caught, exit 1. A new workflow, `truing.yml`, runs the package's typecheck and unit tests on PRs that touch it.                                                                     |

**Commands, last run:** package `tsc` clean; `vitest run` 27/27; `playwright test` 22/22 (fixture app and a real app); root `pnpm typecheck` clean; ESLint 0 errors.

**What the task reviewer flagged, and what was done**

- Fixed: a middle-button drag over a frame didn't pan in Select mode; side by side could stay on the wrong route after the leader went A → B → A; Space released in another window left the canvas panning; the server crashed on a malformed WebSocket frame; the runtime pulled in React and all of zod (658 KB); the build check didn't run its own sanity check in CI, and no workflow ran the package's tests; the config let Truing write test files; the Phone breakpoint check could pass on a blank page; the root depended on Truing package.
- Changed by the fix above: the lockfile no longer moves the app's own `next` or postcss dependencies. It still re-resolves the root's vite and vitest (dev tooling for the integration tests and evals, not the app build).
- Decisions: Tailwind scanning Truing's own folder. One line in the token stylesheet keeps it out, and Tailwind skipped that folder even without the line.

**Left for a person**

- Taste: the shell's look against Airship's, the toolbar order, the empty-state copy in the docks. A copy review and a design review were not run on the shell.
- A full sign-in through the frame, once TRU-13.1 has a signed-in session. The identity provider may refuse to render inside a frame (`frame-ancestors`); if so, sign-in needs its own top-level tab in Truing's window.
- Environment: Turbopack needs more file watches than Ubuntu's default (65,536) when VS Code is open; `sudo sysctl fs.inotify.max_user_watches=524288` fixed it for this boot. The fixture app runs on webpack for that reason.
- Truing treats anything listening on the app's port as the app. If another project is on 3000, it frames that one.
<!-- SECTION:FINAL_SUMMARY:END -->
