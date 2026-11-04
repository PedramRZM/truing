"""Shared helpers for agent hook scripts.

Hooks receive a JSON payload on stdin. Field names differ a little between harnesses
(Claude Code, Codex, Copilot, Droid all use a Claude-like shape), so the helpers
below look in the usual places instead of assuming one schema.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def repo_root(payload: dict | None = None) -> Path:
    env_root = os.environ.get("CLAUDE_PROJECT_DIR")
    if env_root:
        return Path(env_root)
    cwd = (payload or {}).get("cwd") or os.getcwd()
    try:
        out = subprocess.run(
            ["git", "-C", str(cwd), "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        )
        return Path(out.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return Path(cwd)


def tool_input(payload: dict) -> dict:
    value = payload.get("tool_input") or payload.get("toolInput") or payload.get("input") or {}
    return value if isinstance(value, dict) else {}


def shell_command(payload: dict) -> str:
    """The shell command a tool call wants to run, or '' if it isn't a shell call."""
    ti = tool_input(payload)
    for key in ("command", "cmd", "script"):
        value = ti.get(key)
        if isinstance(value, list):
            return " ".join(str(part) for part in value)
        if isinstance(value, str):
            return value
    return ""


def target_paths(payload: dict, root: Path) -> list[str]:
    """Repo-relative POSIX paths a file tool wants to touch (absolute paths outside the repo are kept as-is)."""
    ti = tool_input(payload)
    candidates: list[str] = []
    for key in ("file_path", "filePath", "notebook_path", "path", "target_file"):
        value = ti.get(key)
        if isinstance(value, str) and value:
            candidates.append(value)
    for edit in ti.get("edits") or []:
        if isinstance(edit, dict) and isinstance(edit.get("file_path"), str):
            candidates.append(edit["file_path"])
    rel: list[str] = []
    for raw in candidates:
        path = Path(raw)
        if path.is_absolute():
            try:
                path = path.resolve().relative_to(root.resolve())
            except ValueError:
                rel.append(path.as_posix())
                continue
        rel.append(Path(os.path.normpath(path)).as_posix())
    return rel


def block(message: str) -> None:
    """Exit code 2 blocks the tool call; stderr is shown to the agent as the reason."""
    print(message, file=sys.stderr)
    sys.exit(2)


def ask(reason: str) -> None:
    """Ask the human to confirm (Claude-style JSON decision; harnesses without it treat exit 0 as allow)."""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)
