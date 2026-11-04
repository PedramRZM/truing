---
name: garden-docs
description: Tend the repository's knowledge base — find broken links, stale plans and research, outdated learnings, an oversized AGENTS.md and index drift; fix small issues and report the rest. Use on a schedule (weekly), before a milestone review, or when someone says clean up the docs, docs are stale, prune, or garden.
---

# Garden the docs

Agents trust whatever the repository says, so stale docs mislead them at scale. Gardening keeps `docs/` a reliable system of record.

1. **Run the gate.** Run `make check` and fix what it reports: broken links, missing frontmatter, index drift, config drift, the AGENTS.md budget, the brand guard.
2. **Stale work.**
   - Folders in `docs/changes/` untouched for 14+ days.
   - In Progress tasks with no recent notes (`backlog task list -s "In Progress" --plain`).
   - Ask the owner, or propose closing or archiving.
3. **Research freshness.** List reports whose `revisit_by` date has passed. Propose re-running them, or mark them `superseded`.
4. **Learnings.** For each entry, decide keep, update, merge or delete. Delete it when a test, lint rule or hook now prevents the problem, and link that check.
5. **Instruction budget.** AGENTS.md stays under 150 lines and holds only rules agents need. Move detail into `docs/` and remove rules nobody breaks anymore.
6. **Deliver.**
   - Put small fixes in one docs-only commit.
   - Anything needing a decision becomes a backlog task.
   - Report what you changed and what needs a human.
