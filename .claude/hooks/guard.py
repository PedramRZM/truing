#!/usr/bin/env python3
"""PreToolUse guard for Claude Code and Codex (same hook contract: JSON on stdin, exit 2 blocks).

Tested with Claude Code. The Codex path (tool names Bash and apply_patch) follows the Codex
hooks documentation and is covered by the unit tests, but has not been run under Codex itself.

A guardrail, not a security boundary: it catches the common accident, and a determined or
confused agent can route around it through the shell. The boundary is the sandbox plus keeping
real credentials out of the agent's reach. See docs/principles.md in tackroom.

Always on:
  secrets   Read/Edit/Write of env files, private keys and package-registry credentials, and
            shell commands that name such a file.
  wipe      `rm -r` aimed at the repository root, the home directory, `/` or a parent directory,
            and force-pushes (`--force-with-lease` is allowed).
  main      pushes to a protected branch. Agents work on task branches and open pull requests;
            merging is the human's step. Edit PROTECTED_BRANCHES for a repo that works differently.
  memory    .agents/memory/ is curated: only the memory agents write there (anyone may append to
            inbox.md), and the memory agents write nowhere else.

Opt-in flags, used by the /careful and /lock-tests skills for the rest of a session:
  --careful      also block history- and data-destroying commands.
  --lock-tests   also block edits to test files.
"""

from __future__ import annotations

import fnmatch
import json
import os
import re
import shlex
import subprocess
import sys

PROTECTED_BRANCHES = {"main", "master", "production", "release"}
MEMORY_DIR = ".agents/memory"
MEMORY_AGENTS = {"memory-analyzer", "memory-organizer"}
MEMORY_OPEN_FILES = {"inbox.md"}

SECRET_NAMES = [
    ".env", ".env.*", "*.pem", "*.p12", "*.pfx", "*.key",
    "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519",
    ".npmrc", ".pypirc", ".netrc", ".git-credentials",
]
SECRET_EXCEPTIONS = ["*.example", "*.sample", "*.template", "*.pub", ".env.schema"]

CAREFUL = [
    (r"\bgit\s+reset\s+--hard\b", "git reset --hard discards uncommitted work"),
    (r"\bgit\s+clean\s+-[a-zA-Z]*f", "git clean -f deletes untracked files"),
    (r"\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)", "this discards every uncommitted change"),
    (r"\bgit\s+stash\b(?!\s+(list|show))", "git stash hides work another session may be relying on"),
    (r"\bgit\s+branch\s+-D\b", "git branch -D deletes an unmerged branch"),
    (r"\b(drop|truncate)\s+(table|database|schema)\b", "this destroys data"),
    (r"\bdelete\s+from\s+\w+\s*(;|$)", "DELETE without WHERE empties the table"),
    (r"\b(prisma\s+migrate\s+reset|prisma\s+db\s+push\s+.*--force-reset)\b", "this resets the database"),
    (r"\bkubectl\s+delete\b", "kubectl delete removes cluster resources"),
    (r"\bterraform\s+destroy\b", "terraform destroy removes infrastructure"),
    (r"\bdocker\s+(system|volume)\s+prune\b", "this deletes Docker volumes or images"),
]
TEST_FILES = [
    "*.test.*", "*.spec.*", "test_*.py", "*_test.py", "*_test.go", "*_test.rs",
    "*/tests/*", "*/test/*", "*/__tests__/*", "*/e2e/*", "*/spec/*",
]


def block(reason: str) -> None:
    print(f"Blocked by .claude/hooks/guard.py: {reason}", file=sys.stderr)
    sys.exit(2)


def repo_root(cwd: str) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", cwd, "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, timeout=5, check=False,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return cwd


def current_branch(cwd: str) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", cwd, "branch", "--show-current"],
            capture_output=True, text=True, timeout=5, check=False,
        )
        return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def is_secret(path: str) -> bool:
    name = os.path.basename(path.rstrip("/"))
    if not name or any(fnmatch.fnmatch(name, p) for p in SECRET_EXCEPTIONS):
        return False
    return any(fnmatch.fnmatch(name, p) for p in SECRET_NAMES)


def relative(path: str, root: str) -> str | None:
    """Path relative to the repo root, or None when it lies outside."""
    path = os.path.realpath(path.replace("\\", "/"))
    root = os.path.realpath(root)
    if path == root:
        return ""
    return path[len(root) + 1:] if path.startswith(root + os.sep) else None


def check_file(tool: str, path: str, root: str, agent: str, flags: set[str]) -> None:
    if is_secret(path):
        block(f"{os.path.basename(path)} looks like a secrets file. Ask the user for the specific "
              "value you need, or read the matching .example file.")
    if tool == "Read":
        return
    rel = relative(path, root)
    in_memory = rel is not None and (rel == MEMORY_DIR or rel.startswith(MEMORY_DIR + "/"))
    if agent in MEMORY_AGENTS and not in_memory:
        block(f"the {agent} agent may only write inside {MEMORY_DIR}/.")
    if in_memory and agent not in MEMORY_AGENTS and os.path.basename(path) not in MEMORY_OPEN_FILES:
        block(f"{MEMORY_DIR}/ is curated memory and is only rewritten by the /dream pass. "
              f"Append what you learned to {MEMORY_DIR}/inbox.md instead.")
    if "--lock-tests" in flags and rel is not None:
        if any(fnmatch.fnmatch("/" + rel, "*" + p.lstrip("*")) or fnmatch.fnmatch(os.path.basename(rel), p)
               for p in TEST_FILES):
            block("tests are locked for this session (/lock-tests): make the code satisfy the test. "
                  "If the test itself is wrong, stop and say why.")


def split_commands(command: str) -> list[list[str]]:
    """Rough split into simple commands; good enough to find rm and git invocations."""
    parts: list[list[str]] = []
    for piece in re.split(r"&&|\|\||[;|\n]", command):
        try:
            tokens = shlex.split(piece, comments=True)
        except ValueError:
            tokens = piece.split()
        while tokens and (tokens[0] in ("sudo", "command", "exec", "time", "nohup")
                          or re.fullmatch(r"\w+=.*", tokens[0])):
            tokens = tokens[1:]
        if tokens:
            parts.append(tokens)
    return parts


def check_bash(command: str, cwd: str, root: str, flags: set[str]) -> None:
    home = os.path.expanduser("~")
    for tokens in split_commands(command):
        name = os.path.basename(tokens[0])
        args = tokens[1:]
        for arg in args:
            if not arg.startswith("-") and is_secret(arg):
                block(f"the command names {os.path.basename(arg)}, which looks like a secrets file. "
                      "Use a project script that loads it itself, or ask the user to run this.")
        if name == "rm" and any(re.fullmatch(r"-[a-zA-Z]*[rR][a-zA-Z]*|--recursive", a) for a in args):
            real_root = os.path.realpath(root)
            for arg in (a for a in args if not a.startswith("-")):
                expanded = os.path.expandvars(os.path.expanduser(arg))
                target = os.path.realpath(os.path.join(cwd, expanded))
                inside_repo = target.startswith(real_root + os.sep)
                scratch = target.startswith(("/tmp/", "/var/tmp/"))
                whole_tree = target in ("/", home, real_root) or arg.rstrip("/") in ("*", "./*", ".", "..")
                if whole_tree or not (inside_repo or scratch):
                    block(f"`rm -r {arg}` would delete {target}. Remove specific paths inside the repository, "
                          "or ask the user to run this.")
        if name == "git" and "push" in args:
            if any(a in ("-f", "--force") or re.fullmatch(r"\+\S+", a) for a in args):
                block("force-push rewrites remote history. Use --force-with-lease on your own task "
                      "branch, or ask the user.")
            positional = [a for a in args[args.index("push") + 1:] if not a.startswith("-")]
            refspecs = positional[1:]  # the first positional argument is the remote
            targets = {r.split(":")[-1].removeprefix("refs/heads/") for r in refspecs}
            if not refspecs:
                targets = {current_branch(cwd)}
            hit = targets & PROTECTED_BRANCHES
            if hit:
                block(f"this pushes to {sorted(hit)[0]}. Push a task branch and open a pull request; "
                      "merging is the user's step.")
    if "--careful" in flags:
        for pattern, why in CAREFUL:
            if re.search(pattern, command, flags=re.IGNORECASE):
                block(f"{why} (careful mode is on for this session). Ask the user to run it if it is intended.")


def main() -> None:
    flags = set(sys.argv[1:])
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)
    tool = event.get("tool_name", "")
    tool_input = event.get("tool_input") or {}
    cwd = event.get("cwd") or os.getcwd()
    root = repo_root(cwd)
    agent = event.get("agent_type") or ""
    if tool == "Bash":
        check_bash(str(tool_input.get("command", "")), cwd, root, flags)
    elif tool == "apply_patch":  # Codex: the patch text names the files it touches
        patch = str(tool_input.get("command", ""))
        for path in re.findall(r"(?m)^\*\*\* (?:Add|Update|Delete) File: (.+)$", patch):
            check_file("Edit", os.path.join(cwd, path.strip()), root, agent, flags)
    elif tool in ("Read", "Edit", "Write", "MultiEdit", "NotebookEdit"):
        path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
        if path:
            check_file(tool, os.path.join(cwd, str(path)), root, agent, flags)
    sys.exit(0)


if __name__ == "__main__":
    main()
