#!/usr/bin/env python3
"""Export this project's finished Claude Code sessions as plain-text transcripts for /dream.

    export-transcripts.py [--since 7d|2026-11-01|last] [--out DIR] [--exclude-session ID]
                          [--source DIR] [--extra DIR] [--max-result-chars N] [--dry-run]

Each session becomes one text file: a SESSION line, then blocks labelled USER, AGENT,
TOOL CALL <name> and TOOL RESULT (<name>). Tool results matter most to the analyzers, because
they show what actually happened rather than what the agent said happened.

What is left out or changed, on purpose:
  - thinking blocks, harness bookkeeping and injected reminders (not evidence of anything);
  - long tool results are cut to their head and tail, with a note saying how much was dropped;
  - strings that look like credentials are replaced with [REDACTED].

Transcripts can hold anything the agent saw. They are written to a gitignored folder and are
input for analysis only. Nothing here is executed.

`--since last` (the default) starts where the previous successful dream stopped, or 7 days back
on the first run. The dream skill records that point by running this script with --mark-done.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path

DEFAULT_OUT = ".agents/memory/.transcripts"
STATE_FILE = ".agents/memory/.last-dream"
ACTIVE_MINUTES = 10  # a session touched this recently is probably still running

SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S),
    re.compile(r"\b(?:sk|rk|pk)-[A-Za-z0-9_-]{20,}"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}"),
    re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    re.compile(r"(?i)\b(authorization:\s*bearer)\s+[A-Za-z0-9._~+/=-]{16,}"),
    re.compile(r"(?i)\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*[=:]\s*[\"']?[^\s\"']{8,}"),
    re.compile(r"\b[a-z][a-z0-9+.-]*://[^\s:/@]+:[^\s@/]{4,}@"),
]
REMINDER = re.compile(r"<system-reminder>.*?</system-reminder>", re.S)
LABEL_AT_LINE_START = re.compile(r"(?m)^(?=(?:USER|AGENT|TOOL CALL|TOOL RESULT|SESSION)\b)")


def redact(text: str) -> str:
    for pattern in SECRET_PATTERNS:
        if pattern.groups:
            text = pattern.sub(lambda m: f"{m.group(1)}=[REDACTED]", text)
        else:
            text = pattern.sub("[REDACTED]", text)
    return text


def clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    head, tail = int(limit * 0.65), int(limit * 0.35)
    return f"{text[:head]}\n[... {len(text) - head - tail} characters dropped by the exporter ...]\n{text[-tail:]}"


def protect_labels(block: str) -> str:
    """Indent body lines that happen to start with a label word, so only real labels sit at column 0."""
    label, _, rest = block.partition("\n")
    return label + "\n" + LABEL_AT_LINE_START.sub(" ", rest)


def block_text(content) -> str:
    """Text of a tool_result content field, which is a string or a list of blocks."""
    if isinstance(content, str):
        return content
    parts = []
    for block in content or []:
        if isinstance(block, dict):
            parts.append(block.get("text") or f"[{block.get('type', 'block')}]")
    return "\n".join(parts)


def render_input(tool_input, limit: int) -> str:
    if not isinstance(tool_input, dict):
        return clip(str(tool_input), limit)
    lines = []
    for key, value in tool_input.items():
        text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        text = clip(text, limit)
        lines.append(f"{key}:\n{text}" if "\n" in text else f"{key}: {text}")
    return "\n".join(lines)


def render_session(path: Path, limit: int) -> tuple[str, dict]:
    title, started, branch, tool_names = "", "", "", {}
    blocks: list[str] = []
    counts = {"user": 0, "agent": 0, "tool_calls": 0, "errors": 0}
    with path.open(encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            kind = entry.get("type")
            if kind == "ai-title":
                title = entry.get("aiTitle") or title
                continue
            if kind not in ("user", "assistant") or entry.get("isMeta"):
                continue
            started = started or entry.get("timestamp", "")
            branch = entry.get("gitBranch") or branch
            content = (entry.get("message") or {}).get("content")
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]
            for block in content or []:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type")
                if btype == "text":
                    text = REMINDER.sub("", block.get("text", "")).strip()
                    if not text:
                        continue
                    label = "USER" if kind == "user" else "AGENT"
                    counts["user" if kind == "user" else "agent"] += 1
                    blocks.append(f"{label}:\n{text}")
                elif btype == "tool_use":
                    name = block.get("name", "tool")
                    tool_names[block.get("id")] = name
                    counts["tool_calls"] += 1
                    blocks.append(f"TOOL CALL {name}:\n{render_input(block.get('input'), limit)}")
                elif btype == "tool_result":
                    name = tool_names.get(block.get("tool_use_id"), "tool")
                    error = " [error]" if block.get("is_error") else ""
                    counts["errors"] += 1 if error else 0
                    body = clip(REMINDER.sub("", block_text(block.get("content"))).strip(), limit)
                    blocks.append(f"TOOL RESULT ({name}){error}:\n{body}")
    header = f"SESSION {path.stem} | title: {title or 'untitled'} | started: {started} | branch: {branch or '-'}"
    body = "\n\n".join(protect_labels(b) for b in blocks)
    return redact(header + "\n\n" + body + "\n"), {**counts, "title": title, "started": started}


def project_dir(root: Path) -> Path:
    base = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
    return base / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(root))


def parse_since(value: str, root: Path) -> dt.datetime:
    now = dt.datetime.now(dt.timezone.utc)
    if value == "last":
        state = root / STATE_FILE
        if state.exists():
            value = state.read_text(encoding="utf-8").strip()
        else:
            return now - dt.timedelta(days=7)
    match = re.fullmatch(r"(\d+)d", value)
    if match:
        return now - dt.timedelta(days=int(match.group(1)))
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--since", default="last")
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--source", help="folder of Claude Code session .jsonl files (default: this project's)")
    parser.add_argument("--extra", action="append", default=[], help="folder of other text logs to copy in as they are")
    parser.add_argument("--exclude-session", action="append", default=[])
    parser.add_argument("--max-result-chars", type=int, default=2500)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--mark-done", action="store_true", help="record now as the point the next run starts from")
    args = parser.parse_args()

    root = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=False).stdout.strip() or ".").resolve()
    if args.mark_done:
        state = root / STATE_FILE
        state.parent.mkdir(parents=True, exist_ok=True)
        state.write_text(dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") + "\n", encoding="utf-8")
        print(f"recorded {state.relative_to(root)}")
        return 0

    since = parse_since(args.since, root)
    source = Path(args.source).expanduser() if args.source else project_dir(root)
    out = (root / args.out) if not os.path.isabs(args.out) else Path(args.out)
    cutoff_active = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=ACTIVE_MINUTES)
    if not source.is_dir():
        print(f"no session folder at {source}")
        return 1

    written = 0
    if not args.dry_run:
        out.mkdir(parents=True, exist_ok=True)
        for old in out.glob("*.txt"):
            old.unlink()
    for path in sorted(source.glob("*.jsonl")):
        modified = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc)
        if modified < since or path.stem in args.exclude_session:
            continue
        if modified > cutoff_active:
            print(f"skip   {path.stem[:8]}  still active (changed in the last {ACTIVE_MINUTES} minutes)")
            continue
        text, info = render_session(path, args.max_result_chars)
        if info["tool_calls"] == 0 and info["user"] <= 1:
            continue  # nothing happened in it
        name = f"{modified:%Y%m%d-%H%M}-{path.stem[:8]}.txt"
        print(f"{'would export' if args.dry_run else 'export'} {name}  {len(text) // 1000}k chars, "
              f"{info['tool_calls']} tool calls, {info['errors']} errors  {info['title'][:60]}")
        if not args.dry_run:
            (out / name).write_text(text, encoding="utf-8")
        written += 1
    for extra in args.extra:
        for path in sorted(Path(extra).expanduser().glob("*")):
            if path.suffix.lower() in (".txt", ".md", ".log", ".json", ".jsonl") and path.stat().st_size:
                name = "extra-" + re.sub(r"[^A-Za-z0-9._-]", "_", path.name)
                print(f"{'would copy' if args.dry_run else 'copy'}   {name}")
                if not args.dry_run:
                    (out / name).write_text(redact(path.read_text(encoding="utf-8", errors="replace")), encoding="utf-8")
                written += 1
    print(f"{written} transcript(s) since {since:%Y-%m-%d %H:%M}Z in {out if not args.dry_run else '(dry run)'}")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
