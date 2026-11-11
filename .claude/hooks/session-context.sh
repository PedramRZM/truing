#!/usr/bin/env bash
# SessionStart hook: print the few facts that change between sessions, so a fresh or compacted
# session knows where it is. Plain stdout becomes context. Static guidance belongs in AGENTS.md.
# Kept fast: it runs at every session start, resume and compaction.
input="$(cat)"
cwd="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd",""))' 2>/dev/null)"
root="$(git -C "${cwd:-.}" rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$root" || exit 0

branch="$(git branch --show-current 2>/dev/null)"
[ -n "$branch" ] && echo "Branch: $branch"
changed="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
[ "$changed" != "0" ] && echo "Uncommitted files: $changed"

# A task branch is named task/<id>-<slug>; its plan, if the task needed one, is docs/plans/<id>-*.md.
if [[ "$branch" =~ ^task/([A-Za-z0-9]+)- ]]; then
  id="${BASH_REMATCH[1]}"
  echo "Task id: $id"
  plan="$(ls docs/plans/"$id"-*.md 2>/dev/null | head -1)"
  [ -n "$plan" ] && echo "Plan and progress for this task: $plan (read it before continuing)"
  taskfile="$(ls tasks/"$id"-*.md 2>/dev/null | head -1)"
  [ -n "$taskfile" ] && echo "Task file: $taskfile"
fi

if [ -s .agents/memory/inbox.md ]; then
  pending="$(grep -c '^- ' .agents/memory/inbox.md 2>/dev/null)"
  [ "${pending:-0}" -ge 15 ] && echo "Memory inbox has $pending unprocessed notes; suggest running /dream to the user."
fi
exit 0
