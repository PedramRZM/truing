"""Tests for the agent hook scripts (run by `make check`)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def run_hook(script: str, payload: dict) -> subprocess.CompletedProcess:
    env = {**os.environ, "CLAUDE_PROJECT_DIR": str(ROOT)}
    return subprocess.run(
        [sys.executable, str(HERE / script)],
        input=json.dumps(payload), capture_output=True, text=True, env=env, timeout=30,
    )


def bash(command: str) -> dict:
    return {"tool_name": "Bash", "tool_input": {"command": command}}


def edit(path: str) -> dict:
    return {"tool_name": "Edit", "tool_input": {"file_path": path}}


class GuardTest(unittest.TestCase):
    def assertBlocked(self, payload: dict) -> None:
        result = run_hook("guard.py", payload)
        self.assertEqual(result.returncode, 2, f"expected block for {payload}: {result.stdout}{result.stderr}")
        self.assertTrue(result.stderr.strip(), "a block must explain itself")

    def assertAllowed(self, payload: dict) -> None:
        result = run_hook("guard.py", payload)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('"ask"', result.stdout)

    def assertAsks(self, payload: dict) -> None:
        result = run_hook("guard.py", payload)
        self.assertEqual(result.returncode, 0, result.stderr)
        decision = json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"]
        self.assertEqual(decision, "ask")

    def test_blocks_hook_bypass(self):
        self.assertBlocked(bash('git commit -m "x" --no-verify'))
        self.assertBlocked(bash("git push --no-verify origin TRU-1-x"))

    def test_blocks_force_push_but_not_lease(self):
        self.assertBlocked(bash("git push --force origin main"))
        self.assertBlocked(bash("git push -f"))
        self.assertBlocked(bash("git push origin +main"))
        self.assertAllowed(bash("git push --force-with-lease origin TRU-1-x"))

    def test_blocks_deleting_root_or_home(self):
        self.assertBlocked(bash("rm -rf /"))
        self.assertBlocked(bash("rm -rf ~"))
        self.assertAllowed(bash("rm -rf ./build /tmp/scratch"))

    def test_asks_before_discarding_work(self):
        self.assertAsks(bash("git reset --hard HEAD~1"))
        self.assertAsks(bash("git clean -fd"))
        self.assertAsks(bash("git checkout -- ."))

    def test_protected_paths(self):
        self.assertBlocked(edit("refs/airship/src/main.ts"))
        self.assertBlocked(edit(str(ROOT / "refs" / "x.py")))
        self.assertBlocked(edit(".env"))
        self.assertBlocked(edit("config/.env.local"))
        self.assertBlocked(edit("secrets/token.txt"))
        self.assertAllowed(edit(".env.example"))
        self.assertAllowed(edit("docs/references/airship.md"))
        self.assertAllowed(edit(str(ROOT / "AGENTS.md")))

    def test_ordinary_commands_pass(self):
        self.assertAllowed(bash("make check"))
        self.assertAllowed(bash("git status --short"))
        self.assertAllowed({})


class SessionStartTest(unittest.TestCase):
    def test_prints_short_orientation(self):
        result = run_hook("session_start.py", {"cwd": str(ROOT)})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("make check", result.stdout)
        self.assertLessEqual(len(result.stdout.splitlines()), 6)


class StopCheckTest(unittest.TestCase):
    def test_never_blocks_twice_in_a_row(self):
        result = run_hook("stop_check.py", {"stop_hook_active": True})
        self.assertEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
