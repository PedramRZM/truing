---
name: plan-task
description: Write a just-in-time implementation plan for a backlog task after studying the current code — a short plan inside the task for small work, or a living plan in docs/changes/ for multi-session or risky work. Use before implementing any non-trivial task, or when someone asks to plan, design the approach, or "how should we implement TRU-<n>".
---

# Plan a task

Plans are cheap to change and expensive to follow when they're wrong. So plan right before implementing, from the code as it is now, and keep the plan short enough that a human actually reads it.

1. Read the task (`backlog task <ID> --plain`), its parent epic, spec delta and linked ADRs, plus `docs/architecture/golden-principles.md`, and `docs/design-language.md` or `docs/modules.md` when the task touches the shell or a module. Grep `docs/learnings/` for related pitfalls.
2. Study the code you'll touch; use subagents for wide searches if your harness has them. Note the exact files, functions, interfaces and existing tests.
3. Pick the plan's home:
   - Small (one session): a plan of 30 lines or fewer in the task: `backlog task edit <ID> --plan "<plan>"`.
   - Large (several sessions, cross-cutting, or risky): a living plan at `docs/changes/<ID>-<slug>/plan.md` from `docs/templates/plan.md`; reference it from the task with `--add-ref`.
4. A good plan states:
   - the approach in a few sentences;
   - the files and interfaces to change;
   - the tests to write first;
   - how to verify, with exact commands;
   - risks, and what would make you stop and ask.
5. For anything M-sized or larger, ask the human to review the shape (files, interfaces, milestones), not every line. Architectural choices go to an ADR first.
6. Move the task to In Progress only when implementation starts: `backlog task edit <ID> -s "In Progress"`.
