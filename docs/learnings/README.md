# Learnings

Durable, non-obvious lessons: gotchas, root causes, patterns that worked or failed. Grep here before debugging anything non-trivial.

Write a learning only if it is **non-obvious, durable and costly to rediscover** (`capture` skill, template `docs/templates/learning.md`). If a test, check or hook can enforce it, add that too; the learning then keeps only the "why". The `garden-docs` skill prunes entries that checks have made redundant.

| Learning                                                                                                                              | Category | Status |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| [What running on real projects found that tests didn't](2026-11-03-first-run-on-real-projects.md)                                     | testing  | active |
| [A frame being connected doesn't mean React has reached it](2026-11-03-connected-is-not-hydrated.md)                                  | runtime  | active |
| [A git hook in a linked worktree points every child git at the real repository](2026-11-04-hooks-in-a-worktree-leak-git-variables.md) | tooling  | active |
