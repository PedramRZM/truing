@AGENTS.md

<!--
Claude Code reads this file; Codex, OpenCode and the others read AGENTS.md. The import above
gives Claude the same text, so write shared guidance in AGENTS.md and put only Claude-specific
notes below this comment. Keep the two files side by side: if CLAUDE.md is deleted Claude Code
falls back to AGENTS.md on its own, but a CLAUDE.md without the import hides AGENTS.md from it.
-->

## Claude Code notes

- Skills are in `.claude/skills/`; `.agents/skills/` holds links to them for Codex.
- Before a pull request on a task that needed a plan: the `verify` skill, then `second-opinion`
  (the `reviewer` subagent). For a bug hunt over a large diff, `/code-review`; for anything
  touching the server's token or Host checks, the path guard, Claude sessions or secrets, also
  `/security-review`.
- Personal, uncommitted instructions go in `CLAUDE.local.md` (git-ignored).
