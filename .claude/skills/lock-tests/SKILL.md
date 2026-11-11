---
name: lock-tests
description: Lock test files for the rest of this session so the code must be made to satisfy the tests as they are. Use after the failing test for a bug or feature has been written and committed, or when a change must not alter existing tests.
disable-model-invocation: true
hooks:
  PreToolUse:
    - matcher: 'Edit|Write|NotebookEdit'
      hooks:
        - type: command
          command: '/usr/bin/python3'
          args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.py', '--lock-tests']
          timeout: 10
---

Tests are locked until this session ends: edits to test files are blocked by a hook. Make the
code pass the tests as written. If a test is itself wrong, stop and say which one and why, so
the user can unlock by starting a new session.
