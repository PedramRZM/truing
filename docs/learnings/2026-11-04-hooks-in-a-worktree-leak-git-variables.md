---
title: 'A git hook in a linked worktree points every child git at the real repository'
date: 2026-11-04
category: tooling
status: active
related: [TRU-5.3]
---

# A git hook in a linked worktree points every child git at the real repository

## Symptoms

The first commit from a linked worktree failed 21 unit tests in `test/unit/claude-chat.test.ts`. After it, the shared `.git/config` held `core.bare=true` and a fake `user.name` and `user.email`, and the worktree's index held a temporary repository's files. Nothing like it happens from the main checkout.

## Root cause

In a linked worktree, git gives a hook an absolute `GIT_DIR` and `GIT_INDEX_FILE`. The pre-commit hook runs `make check`, and the unit tests' helpers run `git init` and `git config` in a temporary folder. Those commands inherited the variables, so they acted on the real repository rather than on the folder they ran in. From the main checkout, `GIT_DIR` is either unset or relative, so the same tests look safe.

## Fix

The `Makefile` unexports what `git rev-parse --local-env-vars` lists, so `make check` can't reach the repository from a hook. `test/unit/make-check.test.ts` holds it there. The hook itself is unchanged.

## How to avoid it

- Anything that starts `git` in a temporary folder from a hook has to clear git's local variables first, or it isn't temporary.
- Test tooling from a linked worktree as well as the main checkout. Agents use worktrees, and contributors will too.
- Don't run a `git config` in a test without knowing which repository it lands in.
