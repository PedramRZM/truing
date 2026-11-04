---
name: capture
description: Close out finished work so the next agent starts smarter — write the task's final summary, record durable learnings, update specs, ADRs and docs maps, and close the task. Use after a task or epic is verified or merged, after solving a tricky bug, or when someone says wrap up, close this, document this, or "what did we learn".
---

# Capture

Each unit of work should make the next one easier. Capture is selective: most tasks produce no learning, and that's fine.

1. **Final summary.** Say what changed, how it was verified (commands and results), and the follow-up task IDs: `backlog task edit <ID> --final-summary "<text>"`. Then set the status to Done.
2. **Learning.** Write one only if it is non-obvious, durable and costly to rediscover: a gotcha, a root cause, a pattern that worked or failed.
   - Grep `docs/learnings/` first, and update an existing entry rather than adding a near-duplicate.
   - Use `docs/templates/learning.md` and save it as `docs/learnings/<kebab-slug>.md`.
   - Add it to the table in `docs/learnings/README.md`.
3. **Make it enforceable when you can.** If the learning could be a test, lint rule, hook or check, add that (or a task for it). The doc then keeps only the "why".
4. **Specs and decisions.**
   - When an epic completes, merge its spec delta into `docs/specs/<capability>.md`.
   - Mark ADRs `accepted` or `superseded` as decided by humans.
   - Move `docs/changes/<ID>-<slug>/` to `docs/changes/archive/`.
5. **Maps.** Update `AGENTS.md`, `docs/architecture/`, `docs/modules.md`, `docs/design-language.md` or `docs/README.md` only if where things live or the rules actually changed. Keep AGENTS.md short and point into docs.
