---
name: write-tests
description: How to decide what to test and at which level, and how to write tests that can actually fail. Use when writing or changing tests, adding a feature or fixing a bug that needs a test, when asked about test strategy or coverage, and when a test is flaky, slow or was weakened to pass.
---

# Writing tests

A test is worth having when it would catch a real mistake and gives confidence that the thing
works for whoever uses it. Count that, not coverage.

## Which level

Use the lowest level that gives real confidence in the behaviour. From cheapest to most
expensive:

1. **Static**: types and lint. They catch typos and wrong shapes for free. If a mistake could
   be caught here, tighten the type or add the lint rule instead of writing a test.
2. **Unit**: one function or module with real logic (parsing, pricing, state transitions),
   tested through its inputs and outputs.
3. **Integration**: several parts working together through a public surface, with only the
   outside world replaced: a request handler against a real test database, a page or component
   with the network stubbed at the boundary. Most tests belong here. They survive refactoring
   and catch the mistakes that happen between parts.
4. **End to end**: the running app driven like a user. Keep these to the few flows that must
   never break (sign in, pay, the core action), because they are slow and can be flaky.

## Writing one

- Start from the behaviour: an acceptance criterion, a bug report, what a caller observes. Do
  not derive the test from the implementation; a test written from the code only confirms that
  the code does what it does.
- Assert on what a user or caller can see. Do not assert on internals, call counts or private
  state unless that is the behaviour.
- For a bug: write the test that fails because of the bug, confirm it fails for that reason,
  then fix. For new code: after it passes, break the change on purpose and confirm the test
  goes red. A test that cannot fail is not a test.
- Where code has an invariant, test the property over generated inputs instead of a few
  examples: a round trip (encode then decode), something that must always hold, doing it twice
  equals doing it once, two implementations agreeing. For a rewrite or migration, run old and
  new on the same inputs and compare.
- Keep tests fast and deterministic: seed randomness, freeze the clock, no real network.

## Do not

- Mock the thing under test, or assert on a value the test itself just computed.
- Add a retry, a sleep or a looser assertion to get a pass. A flaky test is a bug: fix the
  cause, or quarantine it and file a task saying so.
- Weaken, skip or delete an existing test to make a change pass. If a test is wrong, stop and
  say which one and why. When an expectation legitimately changes with the code, say why in the
  pull request.
- Chase a coverage number. It produces trivial tests.

## Gotchas

- Tests written in the same session as the code share its assumptions. An existing test, the
  task's own check, or the running app is stronger evidence than a new test alone.
- Tests cannot judge security or design, and they pass while the wrong thing ships. They are
  one signal; `verify` asks for the others.
- Snapshot tests of large output get approved without being read. Prefer a few explicit assertions.

## This project

- Vitest, in `test/unit/`. One file: `pnpm exec vitest run test/unit/<name>.test.ts`; one test: add `-t "<name>"`.
- Projects for tests to edit are in `test/fixtures/`; reduce a real app's case to one of them, with no host brand.
- No browser suite, by the owner's choice: cover behaviour with unit tests, and look at the running app.
- A test that starts a `claude` process fails the suite (`test/unit/no-claude.setup.ts`).
