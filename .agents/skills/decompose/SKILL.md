---
name: decompose
description: Break an agreed epic into small, independently shippable backlog tasks with acceptance criteria, dependencies and a milestone, using the backlog CLI. Use after an epic is shaped, or when someone asks to break work down, create tasks/tickets/issues, sequence work, or "what are the steps for TRU-<n>".
---

# Decompose an epic

## Rules of thumb

- One task = one agent session = one branch/PR. If two or three acceptance criteria can't say how to verify it, the task is too big or too vague.
- Prefer thin vertical slices that a user or a test can observe end to end over layer-by-layer tasks ("all the models", "all the APIs").
- Put risky unknowns first, as `spike` or `research` tasks, so later tasks build on facts.
- Acceptance criteria describe observable results (a test, a command's output, UI behaviour), not activities ("implement X").
- Zero config: every feature's criteria say how it gets what it needs from the project (Claude reads it, or Truing asks the person), and never a config file or a hard-coded path, port, framework or token location.
- Number in the order to do them. An epic's number is its place in the roadmap, and `-p <EPIC-ID>` gives each task the next `TRU-<epic>.<n>`, so create tasks in dependency order. Use `--ordinal` when a new task belongs before existing ones.
- Don't write implementation plans here. `plan-task` plans just in time, because the code will have moved on by then.

## Steps

1. Read the epic (`backlog task <ID> --plain`), its spec delta, and linked ADRs and research.
2. Draft the task list: title, type, acceptance criteria, dependencies. Show it to the human and adjust until they agree. They should only need to skim titles and criteria.
3. Create each task:
   `backlog task create "<title>" -p <EPIC-ID> --type <feature|bug|spike|research|decision|chore|docs> -l <label> -m "<milestone>" --ac "<criterion>" --dep <TASK-ID>`
4. Check the result: `backlog task list -p <EPIC-ID> --plain`, then `backlog task list --ready --plain` to confirm the first tasks are unblocked.
