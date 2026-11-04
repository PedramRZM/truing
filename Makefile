# Harness-neutral entry points: every agent (Claude Code, Codex, Gemini, OpenCode, ...) and every
# human runs the same targets.
.DEFAULT_GOAL := help
PY ?= python3
BACKLOG ?= npx -y backlog.md@1.53.0

# What `git rev-parse --local-env-vars` lists. A hook in a linked worktree gets an absolute
# GIT_DIR, and a test's temporary repository would then act on the real one (TRU-5.3).
unexport GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CONFIG GIT_CONFIG_PARAMETERS GIT_CONFIG_COUNT
unexport GIT_OBJECT_DIRECTORY GIT_DIR GIT_WORK_TREE GIT_IMPLICIT_WORK_TREE GIT_GRAFT_FILE
unexport GIT_INDEX_FILE GIT_NO_REPLACE_OBJECTS GIT_REPLACE_REF_BASE GIT_PREFIX
unexport GIT_SHALLOW_FILE GIT_COMMON_DIR

help: ## List targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-8s %s\n", $$1, $$2}'

setup: ## Once per clone: install git hooks and generate per-harness glue
	git config core.hooksPath .githooks
	$(PY) tools/agent-sync/sync.py

sync: ## Regenerate per-harness files from .agents/skills/ and .mcp.json
	$(PY) tools/agent-sync/sync.py

check: ## The gate, run before every commit: config drift, docs lint, tooling tests, types, lint, format, unit tests
	@$(PY) tools/agent-sync/sync.py --check
	@$(PY) tools/docs/check.py
	@$(PY) -m unittest discover -q -s tools/agent-hooks -p 'test_*.py'
	@$(PY) -m unittest discover -q -s tools/docs -p 'test_*.py'
	@pnpm -s typecheck
	@pnpm -s lint
	@pnpm -s format:check
	@pnpm -s test

test: ## Unit tests (Vitest)
	@pnpm -s test

board: ## Show the backlog board grouped by milestone
	@$(BACKLOG) board -m

.PHONY: help setup sync check test board
