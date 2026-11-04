---
name: implement-task
description: Implement a planned backlog task test-first, in small verified steps with atomic commits and an up-to-date progress log. Use when asked to implement, build, fix or code something ("implement TRU-<n>", "fix this bug", "make the change"), once a plan exists.
---

# Implement a task

1. **Start clean.** Work on a branch named `TRU-<n>-<slug>` (or a worktree) from an up-to-date main. Re-read the plan and the acceptance criteria.
2. **Test first for behaviour changes.**
   - For a bug, write a test that reproduces it and watch it fail before fixing it. The failure proves the test can detect the problem.
   - For a feature, write the acceptance test(s) first where practical.
3. **Small steps.** After each step, run the narrowest check that proves it (one Vitest file or one Playwright spec; AGENTS.md has the commands), and `make check` before each commit. Fix root causes; don't suppress errors or broaden types to make them go away.
4. **Atomic commits.** One logical change per commit. Message: `<type>: <summary>`, then a `Refs: TRU-<n>` trailer. Never commit secrets or generated junk.
5. **Keep the trail.** Append decisions and surprises to the task (`backlog task edit <ID> --append-notes "<note>"`). For large tasks, append to the plan's Progress and Decision Log instead. The next session, which may be another harness or model, depends on it.
6. **Stay in scope.** Extra work you discover becomes a new task (`backlog task create …`), not part of this diff. If the plan turns out wrong, update it and tell the human.
7. **Stop when stuck.** If tests and spec conflict, or you can't progress without breaking a rule in AGENTS.md, report `BLOCKED: <reason>` with what you tried. That is a valid, valued outcome.
8. **Finish** with the `verify` skill.
