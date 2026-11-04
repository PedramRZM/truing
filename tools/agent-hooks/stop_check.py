#!/usr/bin/env python3
"""Stop hook: run the fast gate (`make check`) before the agent ends its turn.

Verification is the practice with the strongest evidence behind it, so the agent gets
the failing output while it still has the context to fix it. To stay cheap and quiet:
- skips when the working tree is clean or unchanged since the last green run;
- never blocks twice in a row (`stop_hook_active`), so it can't trap the agent in a loop.
"""

from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hooklib import read_payload, repo_root  # noqa: E402

STATE_FILE = Path(".agents/state/last-green-check")
TIMEOUT_SECONDS = 110
MAX_FILE_BYTES = 1_000_000


def git(root: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else ""


def fingerprint(root: Path) -> str | None:
    """Hash of everything that differs from HEAD (tracked diffs + untracked file contents)."""
    status = git(root, "status", "--porcelain=v1", "-uall")
    if not status.strip():
        return None
    digest = hashlib.sha256(status.encode())
    digest.update(git(root, "diff", "--binary").encode())
    digest.update(git(root, "diff", "--binary", "--cached").encode())
    for line in status.splitlines():
        if line.startswith("?? "):
            path = root / line[3:].strip().strip('"')
            if path.is_file() and path.stat().st_size <= MAX_FILE_BYTES:
                digest.update(path.read_bytes())
    return digest.hexdigest()


def main() -> None:
    payload = read_payload()
    if payload.get("stop_hook_active"):
        sys.exit(0)

    root = repo_root(payload)
    current = fingerprint(root)
    if current is None:
        sys.exit(0)

    state = root / STATE_FILE
    if state.is_file() and state.read_text().strip() == current:
        sys.exit(0)

    try:
        result = subprocess.run(
            ["make", "-s", "check"], cwd=root, capture_output=True, text=True, timeout=TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        print(f"`make check` timed out after {TIMEOUT_SECONDS}s; run it yourself before finishing.", file=sys.stderr)
        sys.exit(0)

    if result.returncode == 0:
        state.parent.mkdir(parents=True, exist_ok=True)
        state.write_text(current + "\n")
        sys.exit(0)

    output = (result.stdout + result.stderr).strip().splitlines()
    tail = "\n".join(output[-60:])
    print(
        "`make check` fails on the current working tree. Fix the cause before finishing, "
        "or report it explicitly (e.g. BLOCKED: <reason>) if it is outside this task:\n" + tail,
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
