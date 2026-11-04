#!/usr/bin/env python3
"""SessionStart hook: print a few lines of orientation (stdout is added to the agent's context).

Kept deliberately short — it runs every session. It reads Backlog.md task files directly
(no CLI start-up cost) and lists only work that is already in flight.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hooklib import read_payload, repo_root  # noqa: E402

MAX_TASKS = 5
FIELD = re.compile(r"^(id|title|status):\s*(.+?)\s*$")


def frontmatter_fields(path: Path) -> dict[str, str]:
    fields: dict[str, str] = {}
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    if not lines or lines[0].strip() != "---":
        return fields
    for line in lines[1:]:
        if line.strip() == "---":
            break
        match = FIELD.match(line)
        if match:
            fields[match.group(1)] = match.group(2).strip("'\"")
    return fields


def tasks_by_status(root: Path, status: str) -> list[str]:
    found = []
    for path in sorted((root / "backlog" / "tasks").glob("*.md")):
        fields = frontmatter_fields(path)
        if fields.get("status", "").lower() == status.lower():
            found.append(f"{fields.get('id', '?')} {fields.get('title', path.stem)}")
    return found


def main() -> None:
    payload = read_payload()
    root = repo_root(payload)
    lines = []

    branch = subprocess.run(["git", "-C", str(root), "branch", "--show-current"], capture_output=True, text=True).stdout.strip()
    lines.append(f"[truing] branch: {branch or '(detached)'} · fast gate: `make check` · map: AGENTS.md")

    hooks_path = subprocess.run(["git", "-C", str(root), "config", "core.hooksPath"], capture_output=True, text=True).stdout.strip()
    if hooks_path != ".githooks":
        lines.append("Setup pending: run `make setup` once (installs git hooks and agent glue).")

    for status in ("In Progress", "Review"):
        tasks = tasks_by_status(root, status)
        if tasks:
            extra = f" (+{len(tasks) - MAX_TASKS} more)" if len(tasks) > MAX_TASKS else ""
            lines.append(f"{status}: " + "; ".join(tasks[:MAX_TASKS]) + extra)

    changes = root / "docs" / "changes"
    active = sorted(p.name for p in changes.iterdir() if p.is_dir() and p.name != "archive") if changes.is_dir() else []
    if active:
        lines.append("Active change folders (docs/changes/): " + ", ".join(active[:MAX_TASKS]))

    print("\n".join(lines))


if __name__ == "__main__":
    main()
