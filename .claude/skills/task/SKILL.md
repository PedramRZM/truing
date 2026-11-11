---
name: task
description: Work one task from the tracker through to a pull request with evidence, following WORKFLOW.md. Use when asked to work on, implement, fix, pick up or continue a task or issue, or to do the next task.
argument-hint: '[task id, or nothing for the next ready task]'
---

# Task

Take one task from ready to in review. `WORKFLOW.md` is the contract: read "The loop for one
task" and "Rules that hold throughout" and follow them. This file adds only the mechanics.

## Mechanics

- **No task named:** `scripts/agent/next-task` (add `--github` when tasks are issues) prints the
  one to take. `--claim` marks it in progress. If it prints nothing, say so and stop.
- **Issues:** `gh issue view <id> --comments` to read; handoff notes are issue comments that
  start with `Handoff:`.
- **Files:** the task is `tasks/<id>-<slug>.md`; handoff notes go under its Notes heading.
- **Branch:** `task/<id>-<slug>`, created from the default branch after pulling it.
- **Plan file:** only when the task will span sessions or touches several parts. Copy
  `plan-template.md` from this skill's folder to `docs/plans/<id>-<slug>.md`, and update its
  Progress and Dead ends sections every time you stop.
- **Pull request:** open it as a draft with `gh pr create --draft`, using the repository's
  template. The Evidence section gets one line per acceptance criterion.

## When to stop and ask

- An acceptance criterion is wrong, contradictory or cannot be met.
- The work needs a decision the task does not settle (data, money, something users will see).
- The same fix has failed twice. Write down what you tried and what you observed, then ask.
- The checks were already failing before you changed anything, for a reason outside the task.

In each case: note the question on the task, mark it needs-human, and stop. Outside these
cases, keep going until every criterion is met and shown.

## Gotchas

- Run the checks before the first change. A failure you inherit is a finding, not your bug to
  hide.
- Do not widen the task. Work you notice goes into the tracker as a new inbox item that says
  where you found it.
- Editing the task's Goal or Acceptance criteria to match what you built defeats the task.
- A second task in the same session inherits the first one's context and mistakes. Finish, hand
  over, and start fresh.
