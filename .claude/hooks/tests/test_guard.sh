#!/usr/bin/env bash
# Tests for guard.py. Run from anywhere: .claude/hooks/tests/test_guard.sh
# Each case feeds a PreToolUse event on stdin and checks the exit code (0 allow, 2 block).
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
guard="$here/../guard.py"
py="$(command -v /usr/bin/python3 || command -v python3)"  # skip version-manager shims: they add ~0.2s per call
repo="$(mktemp -d)"
trap 'rm -rf "$repo"' EXIT
git -C "$repo" init -q
mkdir -p "$repo/.agents/memory" "$repo/src" "$repo/tests"
pass=0
fail=0

# expect <allow|block> <description> <json> [guard flags...]
expect() {
  local want="$1" name="$2" json="$3"
  shift 3
  local code
  printf '%s' "$json" | "$py" "$guard" "$@" >/dev/null 2>&1
  code=$?
  if { [ "$want" = allow ] && [ "$code" -eq 0 ]; } || { [ "$want" = block ] && [ "$code" -eq 2 ]; }; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAIL ($want expected, exit $code): $name"
  fi
}
bash_event() { printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":%s}}' "$repo" "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1")"; }
file_event() { printf '{"tool_name":"%s","cwd":"%s","agent_type":"%s","tool_input":{"file_path":"%s"}}' "$1" "$repo" "${3:-}" "$2"; }

# secrets
expect block "read .env"                 "$(file_event Read "$repo/.env")"
expect block "edit .env.production"      "$(file_event Edit "$repo/.env.production")"
expect allow "read .env.example"         "$(file_event Read "$repo/.env.example")"
expect block "read a private key"        "$(file_event Read "$repo/deploy/id_ed25519")"
expect allow "read a public key"         "$(file_event Read "$repo/deploy/id_ed25519.pub")"
expect allow "read ordinary source"      "$(file_event Read "$repo/src/env.ts")"
expect block "cat .env"                  "$(bash_event 'cat .env')"
expect block "chained read of .env"      "$(bash_event 'ls && grep KEY .env.local')"
expect allow "copy the example file"     "$(bash_event 'cat .env.example')"

# wipes and force-push
expect block "rm -rf repo root"          "$(bash_event 'rm -rf .')"
expect block "rm -rf everything"         "$(bash_event 'rm -rf ./*')"
expect block "rm -rf home"               "$(bash_event 'rm -rf ~')"
expect block "rm -rf outside the repo"   "$(bash_event 'rm -rf /opt/other-project')"
expect block "rm -rf the parent"         "$(bash_event 'rm -rf ..')"
expect block "rm -fr after a cd chain"   "$(bash_event 'echo hi; rm -fr /')"
expect allow "rm -rf a build directory"  "$(bash_event 'rm -rf dist node_modules/.cache')"
expect allow "rm -rf under /tmp"         "$(bash_event 'rm -rf /tmp/scratch-123')"
expect allow "rm a single file"          "$(bash_event 'rm src/old.ts')"
expect block "git push --force"          "$(bash_event 'git push --force origin main')"
expect block "git push -f"               "$(bash_event 'git push -f')"
expect allow "git push --force-with-lease" "$(bash_event 'git push --force-with-lease origin task/12-x')"
expect allow "plain git push"            "$(bash_event 'git push -u origin task/12-x')"

# protected branches
expect block "push to main by name"      "$(bash_event 'git push origin main')"
expect block "push HEAD to main"         "$(bash_event 'git push origin HEAD:main')"
expect block "push a branch onto master" "$(bash_event 'git push origin task/12-x:refs/heads/master')"
git -C "$repo" checkout -q -b main 2>/dev/null
expect block "bare push while on main"   "$(bash_event 'git push')"
git -C "$repo" checkout -q -b task/12-x
expect allow "bare push on a task branch" "$(bash_event 'git push')"
expect allow "push the task branch"      "$(bash_event 'git push origin task/12-x')"
expect allow "git push --dry-run flagless" "$(bash_event 'git push --set-upstream origin task/12-x')"

# memory tiers
expect block "main session edits curated memory"   "$(file_event Edit "$repo/.agents/memory/deploys.md")"
expect allow "main session appends to the inbox"   "$(file_event Edit "$repo/.agents/memory/inbox.md")"
expect allow "main session reads memory"           "$(file_event Read "$repo/.agents/memory/deploys.md")"
expect allow "analyzer writes memory"              "$(file_event Write "$repo/.agents/memory/deploys.md" memory-analyzer)"
expect allow "organizer rewrites the index"        "$(file_event Edit "$repo/.agents/memory/_index.md" memory-organizer)"
expect block "analyzer writes source code"         "$(file_event Write "$repo/src/app.ts" memory-analyzer)"
expect block "organizer writes outside the repo"   "$(file_event Write "/tmp/x.md" memory-organizer)"
expect allow "main session edits source"           "$(file_event Edit "$repo/src/app.ts")"

# opt-in: careful
expect allow "git reset --hard by default"         "$(bash_event 'git reset --hard HEAD~1')"
expect block "git reset --hard when careful"       "$(bash_event 'git reset --hard HEAD~1')" --careful
expect block "DROP TABLE when careful"             "$(bash_event 'psql -c "drop table users"')" --careful
expect block "git stash when careful"              "$(bash_event 'git stash')" --careful
expect allow "git stash list when careful"         "$(bash_event 'git stash list')" --careful
expect allow "ordinary command when careful"       "$(bash_event 'pnpm test')" --careful

# opt-in: lock-tests
expect allow "edit a test by default"              "$(file_event Edit "$repo/src/cart.test.ts")"
expect block "edit a test when locked"             "$(file_event Edit "$repo/src/cart.test.ts")" --lock-tests
expect block "edit under tests/ when locked"       "$(file_event Write "$repo/tests/api/users.py")" --lock-tests
expect block "edit test_*.py when locked"          "$(file_event Edit "$repo/app/test_models.py")" --lock-tests
expect allow "edit source when locked"             "$(file_event Edit "$repo/src/cart.ts")" --lock-tests
expect allow "read a test when locked"             "$(file_event Read "$repo/src/cart.test.ts")" --lock-tests

# Codex edits files through apply_patch; the patch text names the files
patch_event() {
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"apply_patch","cwd":sys.argv[1],"tool_input":{"command":"*** Begin Patch\n*** Update File: "+sys.argv[2]+"\n@@\n-a\n+b\n*** End Patch"}}))' "$repo" "$1"
}
expect allow "patch a source file"                 "$(patch_event src/app.ts)"
expect block "patch curated memory"                "$(patch_event .agents/memory/deploys.md)"
expect allow "patch the memory inbox"              "$(patch_event .agents/memory/inbox.md)"
expect block "patch a test when locked"            "$(patch_event src/cart.test.ts)" --lock-tests
expect block "patch a secrets file"                "$(patch_event config/.env.production)"

# malformed input never blocks
expect allow "empty stdin"                         ""
expect allow "unknown tool"                        '{"tool_name":"WebFetch","tool_input":{"url":"https://example.com/.env"}}'

echo "guard.py: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
