---
name: performance
description: Make something measurably faster or smaller without breaking it. Measure first, change one thing, prove the gain with repeated runs, and lock it in so it cannot regress. Use when asked to speed up a page, endpoint, query, build or test suite, to reduce bundle size or memory, or to investigate why something is slow.
---

# Performance

Once something is measured, it can be improved step by step. Without a number that reproduces,
performance work is guessing, and plausible-sounding optimisations are often wrong.

## The loop

1. **Reproduce and measure.** Find the slow thing and get a number for it that you can get
   again. Record the baseline and how it was measured.
2. **Prefer a deterministic metric.** Counts move the same way every run: bytes shipped,
   requests made, queries executed, renders, layout shifts, instructions. Wall-clock time is
   noisy; if it is the only measure, repeat it enough to see through the noise (many runs
   before and after, not one of each).
3. **Check that the metric tracks what a person feels.** If improving the number does not
   improve the real experience, drop the metric instead of climbing it.
4. **Make sure behaviour is pinned.** The tests that cover this code pass before you start. If
   there are none, write them first.
5. **Change one thing, measure again.** Keep what helps, revert what does not.
6. **Lock in the gain.** Add the measurement to `scripts/agent/check` through
   `scripts/agent/ratchet <name> <value>`, which fails when the number gets worse than the
   recorded best. A gain that is not guarded is lost within weeks.
7. **Stop at diminishing returns** and say so. A large, intricate change for a few
   milliseconds is not worth carrying.

## Where to look

- **Web pages:** loading (largest contentful paint), responsiveness (interaction to next
  paint), stability (cumulative layout shift); what ships (bundle size per route, images,
  fonts); what runs (a performance trace from the browser's dev tools). Lab numbers from one
  machine are for comparing before and after; they are not what real users see.
- **Servers and APIs:** time per request under a fixed dataset; how many queries a request
  makes; the query plan of the slow ones; behaviour under concurrent load.
- **Builds and tests:** time per step; what runs that does not need to.

## Report

    Baseline   /orders p95 420 ms over 30 runs; 37 queries per request
    Change     batch the line-item lookups (one query instead of one per order)
    Result     /orders p95 95 ms over 30 runs; 4 queries per request
    Guard      scripts/agent/ratchet orders-queries 4   (added to scripts/agent/check)
    Checks     scripts/agent/check: all passed
    Not done   response caching: would need invalidation on every order update

## Gotchas

- Do not remove a feature, lower quality or skip work a user relies on to reach a number,
  unless that trade was asked for. Say what was given up.
- Anything a user could notice (a changed loading order, a removed animation) goes behind a
  flag or to the user for a decision.
- Warm and cold caches give different numbers. Say which one was measured, and compare like
  with like.
- With the Bash sandbox on Linux, a sandboxed command cannot reach a local dev server and a
  browser will not start. Use the browser tool, or say that the measurement needs to run
  outside the sandbox.

## This project

- `pnpm perf <label>` measures what panning, picking and hovering cost in Truing's window.
