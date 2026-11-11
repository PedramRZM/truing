---
name: careful
description: Turn on careful mode for the rest of this session. Blocks commands that destroy history or data (git reset --hard, git clean, git stash, DROP TABLE, database resets, kubectl delete, terraform destroy, volume prunes) until the user runs them. Use when working near production data, a shared branch, or uncommitted work that matters.
disable-model-invocation: true
hooks:
  PreToolUse:
    - matcher: 'Bash'
      hooks:
        - type: command
          command: '/usr/bin/python3'
          args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.py', '--careful']
          timeout: 10
---

Careful mode is on until this session ends. Commands that would destroy history, uncommitted
work or data are now blocked by a hook. When one is blocked and it is what the task needs,
explain why and ask the user to run it. Do not look for another way to get the same effect.
