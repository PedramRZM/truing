---
name: wrap-up
description: Leave the work in a state a fresh session can continue from. Commits and pushes the task branch, updates the plan's progress, writes the handoff note on the task, and records lessons for memory. Use when stopping before a task is finished, when context is running low, and when asked to wrap up, hand off or save state.
---

# Wrap up

The next session starts knowing nothing. Leave it what it needs and no more.

## Leave behind

- **Code:** commit what works on the task branch and push it. If the tree is mid-change and
  the checks fail, say so in the commit message (`wip:`) and in the handoff note.
- **Plan:** if the task has `docs/plans/<id>-<slug>.md`, bring Progress up to date and add
  anything you tried that did not work to Dead ends.
- **Handoff note** on the task (an issue comment, or under Notes in the task file):

      Handoff: <date>
      State: <what works now, and whether the checks pass>
      Done: <the steps or criteria that are finished and shown>
      Next: <the single next step>
      Blocked on: <a question for the user, or nothing>
      Branch: task/<id>-<slug>

- **Lessons:** for anything a future session would otherwise rediscover, append one dated line
  to `.agents/memory/inbox.md`: what is true, and how you found out. Skip what the code or the
  task already says.
- **Discovered work:** file it in the tracker as new inbox tasks.

Finish by telling the user, in a few lines, where things stand and what the next step is.

## Gotchas

- Uncommitted work is lost when a cloud sandbox or worktree is cleaned up. Push before stopping.
- A handoff note that says "almost done" helps nobody. Name the next command to run.
- Do not mark the task in review or done from here. That happens when a pull request exists
  and when the user merges.
