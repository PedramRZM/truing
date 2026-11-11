# .agents/

Files that agents in any harness share.

- `memory/`: the project's long-term memory. `_index.md` is the catalogue, `inbox.md` is where a
  session notes something worth keeping, and the other files are written by the `dream` pass.
  Outside that pass the files are read-only to agents (a hook enforces it in Claude Code and
  Codex). Changes always arrive as a git diff for you to review.
- `skills/`: links to the skills in `.claude/skills/`, for harnesses that look here (Codex,
  Kimi Code, Qwen Code). Present only if the project was set up for one of them.
- `dream-report.md`: the latest proposals from the `dream` pass, waiting for a decision.
