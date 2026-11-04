---
name: review
description: Get an independent, fresh-context review of the current branch's diff against the task's acceptance criteria, REVIEW.md, the golden principles and the ADRs before asking a human to merge. Use when a task is implemented and verified, when someone asks to review changes or "is this ready for a PR", and always for changes touching Claude sessions, the path guard, the server's token or Host checks, or secrets.
---

# Review

The author of a change is its worst reviewer: models measurably miss their own errors but catch the same errors in someone else's work. So review in a fresh context.

1. **Pick the reviewer, in order of preference:**
   - a different model or harness (e.g. Codex reviewing Claude's work, or the reverse);
   - the `reviewer` subagent;
   - a new session given only this skill, the task and the diff.
2. **Give it the spec as well as the diff:** the task ID and acceptance criteria, the plan, `git diff <base>...HEAD`, and the ADRs and specs the change touches. Reviewers given only a diff quietly replace the spec with generic rules.
3. **Follow `REVIEW.md`:**
   - its check order (correctness → product principles → test integrity → design);
   - tier-1 escalations;
   - the "do not flag" list;
   - the output format (at most 10 findings, each with `file:line` and a concrete fix).
4. **Close the loop.**
   - Fix each finding, or answer it explicitly, then re-run `verify`.
   - For tier-1 changes, tell the human which parts need line-by-line review.
   - Move the task to Review: `backlog task edit <ID> -s Review`.
   - A human approves the merge.
