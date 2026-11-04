---
name: reproduce-bug
description: Reproduce a reported bug with a failing automated test before anyone fixes it — and stop there. Use whenever a bug, regression, incident, error report or "this doesn't work" comes in, before planning or implementing a fix.
---

# Reproduce a bug

A fix without a test that failed first proves nothing: the test might not exercise the bug at all. This skill only reproduces. **Do not fix the bug here.** Fixing is `implement-task`'s job, ideally in a fresh session.

1. **Understand the report.** Pin down the expected versus actual behaviour, inputs, environment and version. Grep `docs/learnings/` for the symptom. If the report is too vague to reproduce, ask for the missing facts instead of guessing.
2. **Write the smallest test that shows the bug** at the lowest level where it appears: a Vitest test in `test/unit/` if the defect is local, a Playwright spec in `test/e2e/` on the fixture app if it lives in the shell, the frame or the server. If it takes a person's project to show, reduce it to `test/fixture-app/` or `test/fixtures/`; a test never names a host project.
3. **Prove it fails for the right reason.** Run it, confirm it fails, and check that the failure message matches the reported symptom, not a setup error.
4. **Make it mechanical where you can.**
   - First commit the test asserting today's _buggy_ behaviour, as a characterization test.
   - Then flip the assertion to the expected behaviour and confirm it goes red.
   - The two commits document both behaviours.
5. **Hand over.**
   - Record in the task (`--append-notes`) or a new bug task (`backlog task create … --type bug`): the test name, the command to run it, the observed failure, and your hypothesis about the cause, labelled as a hypothesis.
   - Stop.
