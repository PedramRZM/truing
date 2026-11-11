# Entry points for people and the git hook. The gate itself is scripts/agent/check; `make check`
# runs it with the git variables below cleared.
.DEFAULT_GOAL := help

# What `git rev-parse --local-env-vars` lists. A hook in a linked worktree gets an absolute
# GIT_DIR, and a test's temporary repository would then act on the real one (TRU-5.3).
unexport GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CONFIG GIT_CONFIG_PARAMETERS GIT_CONFIG_COUNT
unexport GIT_OBJECT_DIRECTORY GIT_DIR GIT_WORK_TREE GIT_IMPLICIT_WORK_TREE GIT_GRAFT_FILE
unexport GIT_INDEX_FILE GIT_NO_REPLACE_OBJECTS GIT_REPLACE_REF_BASE GIT_PREFIX
unexport GIT_SHALLOW_FILE GIT_COMMON_DIR

help: ## List targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-8s %s\n", $$1, $$2}'

setup: ## Once per clone: install the git hooks
	git config core.hooksPath .githooks

check: ## The gate, run before every commit: docs lint, guard tests, types, lint, format, unit tests
	@scripts/agent/check

test: ## Unit tests (Vitest)
	@pnpm -s test

.PHONY: help setup check test
