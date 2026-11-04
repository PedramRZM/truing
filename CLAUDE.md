@AGENTS.md

## Claude Code notes

- Skills come from `.claude/skills/`, which are symlinks into `.agents/skills/` created by `make sync`. Add or change skills in `.agents/skills/`, then run `make sync`.
- Claude Code's commit instructions ask you to run the project `verify` skill before each code commit (docs- or test-only commits are skipped). Do run it. The enforced gate is still the git pre-commit hook (`make check`).
- Before opening a PR: `verify` → `/simplify` → `/code-review` → the `review` skill (fresh-context `reviewer` subagent) → `/security-review` for anything touching the server's token or Host checks, the path guard, Claude sessions or secrets.
- Subagents in `.claude/agents/`: `reviewer` (fresh-context diff review) and `citation-verifier` (tries to falsify research claims). Use `Explore` for wide code searches so the main context stays small.
- Plan mode is fine for exploring, but persist multi-session plans in `docs/changes/` as the `plan-task` skill describes.
- Hooks (`.claude/settings.json`) run `tools/agent-hooks/`: a guard before shell and file tools, `make check` when you stop with changes, and a short orientation at session start. If a hook blocks you, read its message: it tells you what to do instead.
- The Artifact tools and Claude Docs are denied in `.claude/settings.json`, and a PreToolUse hook rejects any call to them (golden rule 12). Write files instead.
- Personal, uncommitted instructions go in `CLAUDE.local.md` (git-ignored).
