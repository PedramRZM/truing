---
name: verify
description: Prove a change works before calling it done. Runs the project's checks, exercises the changed behaviour the way a user or caller would, and reports evidence for each acceptance criterion. Use after any code change, before a commit or pull request, and when asked to verify, test, check that it works, or prove it.
---

# Verify

A successful edit is not evidence. Work is verified when someone who did not write it could
look at what you show and agree it works.

## What counts as proof

1. **The checks pass.** Run `scripts/agent/check` (the full run, not `--quick`) and keep its output.
2. **The behaviour was exercised.** For each acceptance criterion, or each behaviour you
   changed when there is no task, run the check that proves it:
   - a bug fix: the test or reproduction that failed before the fix now passes. If there was
     no failing test, write one, and confirm it fails with the fix removed;
   - an API or CLI change: call it and show the response or output;
   - anything a user sees: run the app and use the feature. Click the control, submit the
     form, read the result. Take a screenshot before and after, and read the browser console.
3. **Nothing nearby broke.** Exercise the closest existing behaviour that shares code with the change.

If any step fails, fix the cause and start again from step 1. Do not hand back work that is
partly verified without saying which part.

## Report

One line per criterion, then the checks, then what you could not verify:

    AC1  pnpm test cart.test.ts            4 passed
    AC2  /cart at 412px and 1440px         total updates on quantity change, console clean (screenshots: ...)
    Checks  scripts/agent/check            all 3 checks passed
    Not verified  payment webhook          needs the provider sandbox key

Paste the lines the command printed. Do not describe a result you did not see.

## Gotchas

- The Stop hook runs only the quick checks. A full run is still yours to do.
- Tests are the judge. A test that fails is information; changing or skipping it to get a pass
  is not verification. If the test is wrong, say so and stop.
- A passing test suite written in the same session as the code proves less than it looks:
  it encodes the same assumptions. Prefer a check that existed before, a reproduction from the
  task, or the running app.
- With the Bash sandbox on Linux, a sandboxed command cannot reach a dev server on the host's
  localhost, and Chromium will not start. Use the browser tool for UI checks, and if a test
  command needs the network or a browser, say so instead of reporting it as a code failure.
- Long output buries the result. Prefer quiet flags and show the summary lines plus any failure.

## This project

- Start Truing with `pnpm dev` against an app (`test/fixtures/` holds small projects to point it
  at). It opens its own Chromium window; the shell rebuilds on change.
- Anything visible: screenshots in light and dark, judged against `docs/design-language.md`.
- What only a real `claude` proves (a session, the first run) is `pnpm check-claude <path>` and
  `pnpm check-first-run`. They spend the person's usage: ask before running them, and say when
  they were not run.
- `pnpm check-build <dir>` proves Truing's code did not reach an app's build.
