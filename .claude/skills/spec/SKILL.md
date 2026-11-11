---
name: spec
description: Turn a feature request, bug report or idea into tasks with acceptance criteria in this repository's tracker, plus an epic or a spec when the work is large. Use when asked to plan, scope, spec, break down or file work, and before starting anything bigger than one pull request. Does not implement anything.
argument-hint: '[what to build or fix]'
---

# Spec

Turn what was asked into tasks an agent with no other context could pick up and finish.
`WORKFLOW.md` says where tasks live in this repository and what a task contains. Read it first.

## What good looks like

- **Grounded.** Read the code the work will touch before writing anything. Name the files,
  routes and tables in the task's Context so the next session does not have to find them again.
- **Sized.** Each task fits one context window and one pull request. If it does not, make an
  epic and split it into tasks, and record which tasks block which.
- **Checkable.** Every acceptance criterion is a behaviour plus the check that proves it: a
  command, a test name, or a UI step with the expected result. Aim for six or fewer per task.
- **Product-level.** Say what must be true, not how to code it. Implementation details fixed
  in advance are the ones that turn out wrong and get followed anyway.
- **Bounded.** State what is out of scope and what must not change.

## Questions

Ask the user only what changes the tasks: a choice between behaviours, a constraint you cannot
see, a priority. Ask all of it at once, with the options and your recommendation. Do not ask
what the code can answer.

## Larger work

- Write `docs/specs/<slug>.md` when the work crosses a module or service boundary, changes a
  schema or public API, or will be split across several tasks. Keep it under about 150 lines.
- A choice that is hard to reverse (architecture, the data model, a public name, a new
  dependency or service, anything involving money) is the user's to make. Present two or three
  real options with the effort of each, whether it is easy or hard to undo, and your
  recommendation, then wait. Record the outcome first, alone, in
  `docs/decisions/NNNN-<slug>.md`, before any task that depends on it is marked ready.

## Filing

Create the tasks in the tracker in the inbox state. Only the user marks a task ready. Finish
with the list of what you filed, the order you suggest, and anything you were unsure about.

## Gotchas

- A small bug needs a reproduction, one criterion ("the failing test passes") and nothing else.
- Do not start implementing. If the fix is one line, say so and let the user decide.
- A criterion like "works correctly" or "is fast" cannot be checked. Give the input and the
  expected output, or the number and how it is measured.
