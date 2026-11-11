---
name: connected-is-not-hydrated
description: A frame being connected doesn't mean React has reached it; why browser tests failed in a pattern that looked random (found 2026-11-03).
---

# A frame being connected doesn't mean React has reached it

Found when about 30 browser tests failed in a pattern that looked random: one test failed and the next passed, and each passed alone.

- **The probe loads before the page's scripts, by design.** So a frame counts as connected before hydration. A pick in that gap finds no fiber, reads as "not drawn by React", and an exact edit goes to Claude with "the element's place in the code isn't known". Rewriting a source file makes the gap longer, since the next load waits for a rebuild, which is why specs that restore a file between tests failed most. `hydratedFiberOf` now waits.
- **Other fibers on the page say nothing about hydration.** Next's dev overlay is a React root of its own, mounted before the app hydrates. Three renderers and fibers in the body can coexist with a page React hasn't touched yet. Ask about the element's own ancestors.
- **When a file names a path, ask what it's relative to.** Turbopack in a monorepo names files from the workspace root, webpack from Next's app folder. Joining the first to the app folder gives `apps/web/apps/web/app/page.tsx`, and every edit then fails with "place isn't known". Only the disk tells `apps/web/app/page.tsx` from a folder that happens to be named the same, so a path that exists as given wins.
- **Log what the page saw before theorising.** Two guesses here were wrong, including the first version of the fix. A one-line log of the probe's own state settled each in one run: `renderers: 3, bodyFiber: false` showed why at once.
- **A preview on the page isn't the page.** While an edit is previewed, a re-read of computed styles sees the edit. Then "8 → 12" reads as "12 → 12", which looks like no change, and the edit vanishes with no error. It took a page change during the edit to trigger it, which is why it looked like a flaky test. `preview-held.ts` keeps the earlier read. A report can also bring the same element back as a new object, so anything kept per pick has to be kept per element.
- **A process ended by a signal has no exit code.** `exitCode` stays null and `signalCode` is set, so waiting for an exit that already happened hangs forever, and a dev server killed by a signal looked alive until the timeout. Check both.
- **A test that passes most of the time is telling you something.** Three of this round's intermittent failures were real bugs: an edit lost, typed text overwritten by a slow response, and the two above. Repeat the test with `--repeat-each`, under CPU load if you need to, until it fails, and log what the code decided.
- **A teardown that can hang can corrupt later runs.** A test's teardown clicked a button that vanished, hung, and never put a fixture's source back. Specs read that file as "the original" when they load, so the edited copy became the new normal and failures spread to later runs. Teardown does its work through the server, and a fixture's source is rewritten only when it changed, followed by a wait for the rebuild.
- **"Just checking" a file can run a repository's code.** Compiling a stylesheet imports the project's own Tailwind, and loading a TypeScript config runs it. A review proved a committed fake `tailwindcss` ran during the read, before anyone had seen anything (ADR 0005). Ask of every check what it executes, and test the boundary with a file that leaves a mark if it runs.
