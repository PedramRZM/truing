#!/usr/bin/env python3
"""PostToolUse hook: format the file the agent just edited, using the formatter the project
already has. Silent on success and never blocks: formatting is a convenience, the checks decide.

A formatter is used only when the project shows it is in use (a local binary or a config file),
so this does nothing in a repository that has not chosen one.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

WEB = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".jsonc", ".css", ".scss", ".md", ".mdx", ".html", ".yaml", ".yml", ".vue", ".svelte"}
PRETTIER_CONFIGS = (".prettierrc", ".prettierrc.json", ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.mjs", ".prettierrc.yaml", ".prettierrc.yml", "prettier.config.js", "prettier.config.mjs", "prettier.config.cjs", "prettier.config.ts")


def find_up(start: str, names: tuple[str, ...]) -> str | None:
    """Nearest ancestor directory of start that contains one of names."""
    current = start
    while True:
        if any(os.path.exists(os.path.join(current, n)) for n in names):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent


def command_for(path: str) -> tuple[list[str], str] | None:
    folder, ext = os.path.dirname(path), os.path.splitext(path)[1].lower()
    if ext in WEB:
        base = find_up(folder, ("biome.json", "biome.jsonc"))
        if base and os.path.exists(os.path.join(base, "node_modules/.bin/biome")):
            return [os.path.join(base, "node_modules/.bin/biome"), "format", "--write", path], base
        base = find_up(folder, PRETTIER_CONFIGS)
        if base:
            owner = find_up(base, ("node_modules/.bin/prettier",))
            if owner:
                return [os.path.join(owner, "node_modules/.bin/prettier"), "--write", "--log-level", "warn", path], base
    elif ext in (".py", ".pyi"):
        base = find_up(folder, ("ruff.toml", ".ruff.toml", "pyproject.toml"))
        if base:
            local = os.path.join(base, ".venv/bin/ruff")
            ruff = local if os.path.exists(local) else shutil.which("ruff")
            if ruff:
                return [ruff, "format", "--quiet", path], base
    elif ext == ".rs" and shutil.which("rustfmt"):
        base = find_up(folder, ("Cargo.toml",))
        if base:
            return ["rustfmt", "--edition", "2021", path], base
    elif ext == ".go" and shutil.which("gofmt"):
        return ["gofmt", "-w", path], folder
    return None


def main() -> None:
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)
    path = (event.get("tool_input") or {}).get("file_path") or ""
    if not path or not os.path.isfile(path):
        sys.exit(0)
    chosen = command_for(os.path.abspath(path))
    if chosen:
        command, cwd = chosen
        try:
            subprocess.run(command, cwd=cwd, capture_output=True, timeout=20, check=False)
        except (OSError, subprocess.SubprocessError):
            pass
    sys.exit(0)


if __name__ == "__main__":
    main()
