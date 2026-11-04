#!/usr/bin/env python3
"""PreToolUse guard for shell and file-editing tools.

A guardrail, not a security boundary: the sandbox and permission rules are the
real controls. The rules here are the few mistakes agents make that are expensive to
undo, and each message tells the agent what to do instead.
Exit 2 = block (message goes back to the agent); JSON "ask" = ask the human.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hooklib import ask, block, read_payload, repo_root, shell_command, target_paths  # noqa: E402

# Shell commands that are blocked outright.
BLOCKED_SHELL = [
    (re.compile(r"\bgit\b[^;&|\n]*\s--no-verify\b"),
     "Bypassing git hooks (--no-verify) is not allowed. Fix the failing check, or stop and report BLOCKED: <reason>."),
    (re.compile(r"\bgit\s+push\b[^;&|\n]*\s(--force(?![-\w])|-f\b|\+\S)"),
     "Force-pushing is not allowed. Push a new commit instead, or ask a human."),
    (re.compile(r"\brm\s+(-[a-zA-Z]*\s+)*(/|~|\$HOME)/?(\s|$)"),
     "Refusing to delete the filesystem root or the home directory."),
]

# Shell commands that silently destroy uncommitted work: ask the human first.
ASK_SHELL = [
    (re.compile(r"\bgit\s+reset\s+[^;&|\n]*--hard\b"), "git reset --hard discards uncommitted work."),
    (re.compile(r"\bgit\s+clean\s+[^;&|\n]*-[a-zA-Z]*f"), "git clean -f deletes untracked files."),
    (re.compile(r"\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)"), "This discards all local changes."),
]

# Paths file-editing tools must not touch.
PROTECTED_PATHS = [
    (re.compile(r"^refs(/|$)"),
     "refs/ holds read-only reference clones. Never edit them or copy code from them; write notes in docs/references/ instead."),
    (re.compile(r"^\.git(/|$)"), "Don't edit git internals."),
    (re.compile(r"(^|/)\.env(\.(?!example$)[^/]*)?$"), "Don't read or write .env files; secrets stay out of agent context (.env.example is fine)."),
    (re.compile(r"(^|/)secrets(/|$)"), "Don't touch secrets/."),
]


def main() -> None:
    payload = read_payload()
    root = repo_root(payload)

    command = shell_command(payload)
    if command:
        for pattern, message in BLOCKED_SHELL:
            if pattern.search(command):
                block(message)
        for pattern, reason in ASK_SHELL:
            if pattern.search(command):
                ask(reason)

    for path in target_paths(payload, root):
        for pattern, message in PROTECTED_PATHS:
            if pattern.search(path):
                block(f"{path}: {message}")

    sys.exit(0)


if __name__ == "__main__":
    main()
