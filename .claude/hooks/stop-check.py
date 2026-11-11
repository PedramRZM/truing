#!/usr/bin/env python3
"""Stop hook: when the agent finishes a turn with changed files, run the project's quick checks
and send failures back instead of letting it report success.

Works for Claude Code and Codex (both accept {"decision": "block", "reason": ...} on Stop).

It stays out of the way:
  - nothing changed since the last commit, or since the last passing run: no check;
  - scripts/agent/check is missing or reports that no checks are configured: no check;
  - the agent was already sent back once by a Stop hook (stop_hook_active): let it stop, so a
    check that cannot pass does not trap the session.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile

CHECK = "scripts/agent/check"
TIMEOUT_SECONDS = 240
TAIL_CHARS = 4000


def git(root: str, *args: str) -> str:
    out = subprocess.run(["git", "-C", root, *args], capture_output=True, text=True, timeout=30, check=False)
    return out.stdout


def allow() -> None:
    """No decision. Codex requires JSON on stdout from a Stop hook that exits 0; Claude Code accepts it."""
    print("{}")
    sys.exit(0)


def main() -> None:
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        allow()
    if event.get("stop_hook_active"):
        allow()
    cwd = event.get("cwd") or os.getcwd()
    root = git(cwd, "rev-parse", "--show-toplevel").strip()
    if not root or not os.access(os.path.join(root, CHECK), os.X_OK):
        allow()
    status = git(root, "status", "--porcelain")
    if not status.strip():
        allow()

    fingerprint = hashlib.sha256((status + git(root, "diff", "HEAD")).encode()).hexdigest()
    marker = os.path.join(
        tempfile.gettempdir(), "agent-check-" + hashlib.sha256(root.encode()).hexdigest()[:16]
    )
    try:
        if open(marker, encoding="utf-8").read().strip() == fingerprint:
            allow()
    except OSError:
        pass

    try:
        run = subprocess.run(
            [os.path.join(root, CHECK), "--quick"],
            cwd=root, capture_output=True, text=True, timeout=TIMEOUT_SECONDS, check=False,
        )
        output, code = run.stdout + run.stderr, run.returncode
    except subprocess.TimeoutExpired:
        allow()  # a slow check must not hold every turn hostage; CI still runs it

    if code == 0:
        try:
            with open(marker, "w", encoding="utf-8") as handle:
                handle.write(fingerprint)
        except OSError:
            pass
        allow()
    if code == 3:  # scripts/agent/check uses 3 for "no checks configured"
        allow()

    reason = (
        f"`{CHECK} --quick` failed, so the work is not finished. Fix the cause (do not weaken or "
        "skip the check), run it again, and show the passing output. If it cannot pass for a "
        "reason outside this task, say exactly that and stop.\n\n" + output[-TAIL_CHARS:]
    )
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


if __name__ == "__main__":
    main()
