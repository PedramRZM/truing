#!/usr/bin/env python3
"""Docs lint and brand guard: keeps the in-repo knowledge base trustworthy and the repo free of host brands.

Checks
- relative markdown links resolve (code spans/fences ignored; test fixtures and vendored files skipped);
- repo paths named in code spans of operational docs exist;
- required metadata on research reports and reference notes;
- every decision record, research report and reference note is listed in its folder's README index;
- no host project's name appears in any tracked or about-to-be-tracked file, outside the exempt paths.
Usage: check.py
"""

from __future__ import annotations

import hashlib
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
LINK = re.compile(r"!?\[[^\]]*\]\(\s*<?([^)>\s]+)>?(?:\s+\"[^\"]*\")?\s*\)")
CODE_SPAN = re.compile(r"`+[^`]*`+")
DATED_FOLDER = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$")
DECISION_FILE = re.compile(r"^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
NO_LINK_CHECK = re.compile(r"^test/|/references/vendor/")  # fixtures and third-party text

# "Blind reference" check: repo paths named in code spans or frontmatter must exist.
# Only our operational docs are checked; research reports and reference notes cite other repos' paths,
# and a skill's references/ use made-up example paths.
OPERATIONAL_DOCS = ("AGENTS.md", "CLAUDE.md", "WORKFLOW.md", "README.md", "CONTRIBUTING.md", "SECURITY.md", "docs/README.md",
                    "docs/decisions/", "docs/architecture/", "docs/specs/", "docs/plans/",
                    "docs/references/README.md", "docs/research/README.md", ".claude/skills/", ".claude/agents/")
NOT_OPERATIONAL = re.compile(r"/references/|^\.claude/skills/(kickoff|dream)/")  # example paths for other projects
PATH_ROOTS = ("docs/", "tools/", ".agents/", ".claude/", ".github/", ".githooks/", ".codex/", ".opencode/", ".vscode/",
              "src/", "test/", "scripts/", "examples/")
ROOT_FILES = {"AGENTS.md", "CLAUDE.md", "WORKFLOW.md", "README.md", "CONTRIBUTING.md", "SECURITY.md", "CODE_OF_CONDUCT.md",
              "THIRD_PARTY_NOTICES.md", "LICENSE", "Makefile", "opencode.json"}
OPTIONAL_PATHS = {"CLAUDE.local.md", ".claude/settings.local.json", ".claude/worktrees", ".agents/memory/.transcripts",
                  ".agents/dream-report.md", "refs"}
PLACEHOLDER = re.compile(r"[<>*{}…$]|\.\.\.|YYYY|NNNN|\bOWNER\b|\bREPO\b")
CODE_SPAN_TOKEN = re.compile(r"`([^`\s]+)`")
NOT_PATHS = {"tools/list", "tools/call"}  # MCP method names that look like paths

REQUIRED_METADATA = [
    # (glob relative to ROOT, required keys, files to skip)
    ("docs/research/*/README.md", {"title", "date", "status", "revisit_by"}, set()),
    ("docs/references/*.md", {"repo", "studied", "license", "read_policy"}, {"README.md"}),
]
INDEXES = [
    # (folder, README that must list each entry, whether entries may also be dated folders)
    ("docs/decisions", "docs/decisions/README.md", False),
    ("docs/references", "docs/references/README.md", False),
    ("docs/research", "docs/research/README.md", True),
]

# Brand guard. Hashes of the words, so this file can't publish what it protects. A word
# is letters and digits, split at camelCase too, and a pair is two words side by side.
FORBIDDEN_HASHES = {
    "154b1686d5428ba3beea577fd77754960360e4f3a6fbc663d62a1b0b7e812bd4",
    "8e343658ab678144c360bf3143d7e41332ecc1278d9fed75587022acf4abb558",
    "a7f213414494e0ad78d604d5d9c67d141401395443d6ed64c3bcf298ce46b56e",
    "b83e4d6e5ea54365770db7ea45a56cdcc0c39bbc9fca4daecebc7a0ad99e5876",
    "fc1b616ee03606090708ca2c1493583bc7147de66a135225bdbc0d0480bd0b11",
}
WORD = re.compile(r"[a-z0-9]+")
CAMEL = re.compile(r"([a-z0-9])([A-Z])")
BRAND_SKIPPED = re.compile(r"(^|/)(node_modules|\.next)/|(^|/)pnpm-lock\.yaml$")
BINARY_SNIFF_BYTES = 8192


def repo_files(root: Path, *pathspec: str) -> list[str]:
    """Repo-relative paths git tracks or would track: new files are checked before anyone stages them."""
    out = subprocess.run(
        ["git", "-C", str(root), "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", *pathspec],
        capture_output=True, text=True, check=True,
    ).stdout
    return sorted({line for line in out.split("\0") if line})


def names_a_brand(text: str) -> bool:
    words = WORD.findall(CAMEL.sub(r"\1 \2", text).lower())
    pairs = (" ".join(pair) for pair in zip(words, words[1:]))
    return any(
        hashlib.sha256(term.encode()).hexdigest() in FORBIDDEN_HASHES
        for term in (*words, *pairs)
    )


def brand_problems(root: Path, files: list[str]) -> list[str]:
    errors: list[str] = []
    for rel in files:
        if BRAND_SKIPPED.search(rel):
            continue
        if names_a_brand(rel):
            errors.append(f"{rel}: a host project's brand is in this path")
        path = root / rel
        if path.is_symlink() or not path.is_file():
            continue
        data = path.read_bytes()
        if b"\0" in data[:BINARY_SNIFF_BYTES]:
            continue
        for number, line in enumerate(data.decode("utf-8", errors="replace").splitlines(), 1):
            if names_a_brand(line):
                errors.append(f"{rel}:{number}: a host project's brand is named here (AGENTS.md golden rule 9)")
    return errors


def markdown_files() -> list[Path]:
    return [ROOT / rel for rel in repo_files(ROOT, "*.md") if (ROOT / rel).is_file()]


def check_links(path: Path, errors: list[str]) -> None:
    rel = path.relative_to(ROOT)
    if NO_LINK_CHECK.search(rel.as_posix()):
        return
    if rel.parts[:2] == ("docs", "research") and "notes" in rel.parts[:-1]:
        return  # raw research notes are archival source material
    in_fence = False
    for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        if line.lstrip().startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for target in LINK.findall(CODE_SPAN.sub("", line)):
            if re.match(r"^[a-z][a-z0-9+.-]*:", target) or target.startswith("#"):
                continue  # external URL, mailto:, or in-page anchor
            file_part = unquote(target.split("#", 1)[0])
            if not file_part:
                continue
            resolved = (ROOT / file_part.lstrip("/")) if file_part.startswith("/") else (path.parent / file_part)
            if not resolved.exists():
                errors.append(f"{rel}:{number}: broken link -> {target}")


def referenced_path_problem(candidate: str) -> bool:
    """True when `candidate` looks like a repo path that should exist but doesn't."""
    candidate = re.sub(r"(#|:L?\d).*$", "", candidate.strip().rstrip(".,;:)"))
    if not candidate or candidate in NOT_PATHS or PLACEHOLDER.search(candidate):
        return False
    if not (candidate in ROOT_FILES or candidate.startswith(PATH_ROOTS)):
        return False
    if candidate.rstrip("/") in OPTIONAL_PATHS:
        return False
    return not (ROOT / candidate).exists()


def check_blind_references(path: Path, errors: list[str]) -> None:
    rel = path.relative_to(ROOT).as_posix()
    if not any(rel == p or rel.startswith(p) for p in OPERATIONAL_DOCS if p.endswith("/")) and rel not in OPERATIONAL_DOCS:
        return
    if NOT_OPERATIONAL.search(rel):
        return
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    in_fence = False
    in_frontmatter = bool(lines) and lines[0].strip() == "---"
    for number, line in enumerate(lines, 1):
        if in_frontmatter:
            if number > 1 and line.strip() == "---":
                in_frontmatter = False
                continue
            if line.startswith("related:"):
                for item in re.split(r"[,\[\]]", line.split(":", 1)[1]):
                    if referenced_path_problem(item):
                        errors.append(f"{rel}:{number}: frontmatter references missing path {item.strip()}")
            continue
        if line.lstrip().startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for token in CODE_SPAN_TOKEN.findall(line):
            if referenced_path_problem(token):
                errors.append(f"{rel}:{number}: references missing path `{token}`")


def metadata_keys(path: Path) -> set[str] | None:
    """Keys of the YAML frontmatter, or of a `- Status: …` list right under the title; None if there is neither."""
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    if not lines:
        return None
    if lines[0].strip() != "---":
        keys = {match.group(1).lower() for line in lines[:12] if (match := re.match(r"^- ([A-Za-z_-]+):", line))}
        return keys or None
    keys = set()
    for line in lines[1:]:
        if line.strip() == "---":
            return keys
        match = re.match(r"^([A-Za-z0-9_-]+):", line)
        if match:
            keys.add(match.group(1))
    return None


def check_metadata(errors: list[str]) -> None:
    for pattern, required, skip in REQUIRED_METADATA:
        for path in sorted(ROOT.glob(pattern)):
            if path.name in skip:
                continue
            rel = path.relative_to(ROOT)
            keys = metadata_keys(path)
            if keys is None:
                errors.append(f"{rel}: missing metadata (needs {sorted(required)}); see the folder's README")
            elif missing := required - keys:
                errors.append(f"{rel}: metadata is missing {sorted(missing)}")


def check_indexes(errors: list[str]) -> None:
    for folder, index, allow_folders in INDEXES:
        base = ROOT / folder
        index_path = ROOT / index
        if not base.is_dir():
            continue
        if not index_path.is_file():
            errors.append(f"{index} is missing")
            continue
        listed = index_path.read_text(encoding="utf-8")
        entries = [p.name for p in base.glob("*.md") if p.name != "README.md"]
        if allow_folders:
            folders = [p.name for p in base.iterdir() if p.is_dir() and p.name != "assets"]
            entries += folders
            errors.extend(f"{folder}/{name}: research folders are named YYYY-MM-DD-kebab-slug"
                          for name in folders if not DATED_FOLDER.match(name))
        for name in sorted(entries):
            if name not in listed:
                errors.append(f"{index}: add an entry for {name}")
        if folder == "docs/decisions":
            errors.extend(f"{folder}/{name}: decision records are named NNNN-kebab-title.md"
                          for name in entries if not DECISION_FILE.match(name))


def main() -> int:
    errors: list[str] = []
    files = markdown_files()
    for path in files:
        check_links(path, errors)
        check_blind_references(path, errors)
    check_metadata(errors)
    check_indexes(errors)
    errors.extend(brand_problems(ROOT, repo_files(ROOT)))
    for message in errors:
        print(f"error: {message}", file=sys.stderr)
    print(f"docs-check: {'ok' if not errors else 'FAILED'} ({len(files)} markdown files, {len(errors)} problems)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
