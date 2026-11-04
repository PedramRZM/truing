# Harnesses: how this repo works with each coding agent

Content is canonical and harness-neutral. Each harness only gets thin, generated glue.

- **Canonical:** `AGENTS.md`, `.agents/skills/`, `.mcp.json`, `docs/`, and the gates (`make check` via git hook).
- **Generated:** `make sync` writes each harness's own files.

Switching harness changes configuration, not content. This is about working on Truing. Truing itself only ever drives the person's own `claude` CLI, whichever harness built it.

Facts as of 2026-11-03. Re-check quarterly.

## What each harness reads here

| Harness                                          | Instructions                 | Skills                                            | MCP config                            | Hooks wired                    |
| ------------------------------------------------ | ---------------------------- | ------------------------------------------------- | ------------------------------------- | ------------------------------ |
| **Claude Code** (primary)                        | `CLAUDE.md` → `@AGENTS.md`   | `.claude/skills/*` (symlinks to `.agents/skills`) | `.mcp.json`                           | yes (`.claude/settings.json`)  |
| **OpenAI Codex** (CLI/IDE/app/cloud)             | `AGENTS.md`                  | `.agents/skills/`                                 | `.codex/config.toml` (trusted only)   | not yet                        |
| **Gemini CLI**                                   | `AGENTS.md` via its settings | `.agents/skills/`                                 | `.gemini/settings.json`               | not yet                        |
| **Antigravity**                                  | `AGENTS.md`                  | `.agents/skills/`                                 | `.agents/mcp_config.json`             | not yet                        |
| **OpenCode**                                     | `AGENTS.md`                  | `.agents/skills/` (also reads `.claude/skills/`)  | `opencode.json`                       | not yet (JS plugins)           |
| **Cursor**                                       | `AGENTS.md`                  | `.agents/skills/`                                 | `.cursor/mcp.json`                    | can load Claude hooks (verify) |
| **GitHub Copilot** (VS Code / CLI / cloud agent) | `AGENTS.md`                  | `.agents/skills/`                                 | `.vscode/mcp.json`, `.mcp.json` (CLI) | not yet                        |

Subagents (`reviewer`, `citation-verifier`) are Claude-format files in `.claude/agents/`. Cursor and VS Code Copilot also read that folder. Without subagents, do the step in a fresh session, as the skills describe.

## Switching or adding a harness

1. `pnpm install`, then `make setup` once per clone. It sets the git hook and generates glue.
2. Trust the project where the harness requires it: Codex ignores `.codex/` in untrusted projects; Gemini CLI and Antigravity have their own trust prompts.
3. Start the harness at the repo root. It reads `AGENTS.md`; check that it lists the skills (e.g. ask it which skills it has).
4. Run one small task end to end (`plan-task` → `implement-task` → `verify`) and confirm `make check` passes via the git hook.
5. Harness-specific quirks:
   - **OpenCode** reads both `.agents/skills` and `.claude/skills`. Set `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1` in your shell to avoid duplicate listings.
   - **Gemini CLI** keeps plans outside the repo by default. Persist real plans in `docs/changes/` (`plan-task` skill).

## Model-specific guidance

`AGENTS.md` and skills stay model-neutral, and gates carry quality. Prompts tuned for one model over- or under-constrain another, and they decay with every model release. When a model needs a nudge, put it in that harness's glue, never in `AGENTS.md`:

- **Claude models:** the "Claude Code notes" in `CLAUDE.md`.
- **Other models:** that harness's own instruction mechanism, e.g. OpenCode's `instructions` list pointing at a model-notes file.

## Sandboxing

Claude Code's Bash sandbox is **not** enabled in the shared settings, because its Linux backend depends on the host allowing unprivileged user namespaces. To use it, enable it in `.claude/settings.local.json`. `make sync` must run outside it when skills are added or removed, since the sandbox protects `.claude/` from shell writes.
