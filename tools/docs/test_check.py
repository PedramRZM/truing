"""Tests for the docs lint's brand guard (run by `make check`)."""

from __future__ import annotations

import hashlib
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check  # noqa: E402

# Made-up words stand in for the real ones, which only exist here as hashes.
HOST = "acmecorp"
SECOND_HOST = "zenbrand"
STUDIO_DASH = "widget-forge"
STUDIO_SPACE = "widget forge"
OLD = "vexo"
OLD_PREFIX = "VEX-"
STAND_INS = {
    hashlib.sha256(word.encode()).hexdigest()
    for word in (HOST, SECOND_HOST, STUDIO_SPACE, OLD, "vex")
}


class BrandGuardTest(unittest.TestCase):
    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        patcher = mock.patch.object(check, "FORBIDDEN_HASHES", STAND_INS)
        patcher.start()
        self.addCleanup(patcher.stop)

    def write(self, rel: str, content: str | bytes) -> None:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            path.write_bytes(content)
            return
        path.write_text(content, encoding="utf-8")

    def problems(self) -> list[str]:
        return check.brand_problems(self.root, check.repo_files(self.root))

    def test_finds_each_word_in_any_case(self):
        for word in (HOST, HOST.upper(), HOST.title(), STUDIO_DASH, STUDIO_SPACE, STUDIO_SPACE.title(), OLD, OLD.title(), OLD_PREFIX + "12"):
            with self.subTest(word=word):
                self.write("src/a.ts", f"// from {word} here\n")
                self.assertEqual(len(self.problems()), 1, word)
                self.assertIn("src/a.ts:1", self.problems()[0])

    def test_names_the_line(self):
        self.write("docs/a.md", f"one\ntwo\nthree {HOST}\n")
        self.assertIn("docs/a.md:3", self.problems()[0])

    def test_finds_a_file_nobody_has_staged_and_a_staged_one(self):
        self.write("new.md", HOST)
        self.write("staged.md", HOST)
        subprocess.run(["git", "-C", str(self.root), "add", "staged.md"], check=True)
        self.assertEqual(len(self.problems()), 2)

    def test_finds_the_word_in_a_path(self):
        self.write(f"src/{HOST}-theme.ts", "clean\n")
        self.assertEqual(len(self.problems()), 1)
        self.assertIn("path", self.problems()[0])

    def test_finds_the_word_in_a_hidden_folder(self):
        self.write(".agents/skills/x/SKILL.md", OLD + "\n")
        self.assertEqual(len(self.problems()), 1)

    def test_whole_word_only_for_the_short_name(self):
        self.write("a.md", OLD + "lier is fine, and so is s" + OLD_PREFIX.lower() + "x\n")
        self.assertEqual(self.problems(), [])

    def test_nothing_is_exempt_not_even_the_root_readme_or_assets(self):
        self.write("README.md", f"Thanks to {HOST}\n")
        self.write(f"docs/assets/{HOST}-logo.png", b"\x89PNG\0")
        self.write("docs/assets/credit.txt", HOST)
        self.assertEqual(len(self.problems()), 3)

    def test_a_nested_readme_is_checked(self):
        self.write("docs/README.md", HOST)
        self.assertEqual(len(self.problems()), 1)

    def test_finds_every_host_name(self):
        self.write("a.md", SECOND_HOST.capitalize() + "\n")
        self.assertEqual(len(self.problems()), 1)

    def test_skips_lockfile_builds_dependencies_and_binaries(self):
        self.write("pnpm-lock.yaml", HOST)
        self.write("test/app/.next/x.js", HOST)
        self.write("node_modules/x/index.js", HOST)
        self.write("a.bin", b"\0" + HOST.encode())
        self.assertEqual(self.problems(), [])

    def test_ignored_files_are_not_scanned(self):
        self.write(".gitignore", "local.md\n")
        self.write("local.md", HOST)
        self.assertEqual(self.problems(), [])

    def test_symlink_is_not_followed(self):
        self.write("outside.txt", "clean\n")
        (self.root / "link").symlink_to("/nonexistent")
        self.assertEqual(self.problems(), [])

    def test_a_clean_repo_passes(self):
        self.write("src/a.ts", "export const truing = 1;\n")
        self.assertEqual(self.problems(), [])


class GuardFileTest(unittest.TestCase):
    def test_the_guard_holds_only_hashes(self):
        self.assertTrue(check.FORBIDDEN_HASHES)
        for entry in check.FORBIDDEN_HASHES:
            self.assertRegex(entry, r"^[0-9a-f]{64}$")

    def test_a_word_split_at_camel_case_is_found(self):
        with mock.patch.object(check, "FORBIDDEN_HASHES", STAND_INS):
            self.assertTrue(check.names_a_brand("const acmecorpTheme = 1;"))
            self.assertTrue(check.names_a_brand("AcmecorpWeb"))
            self.assertFalse(check.names_a_brand("acme corp"))

    def test_the_real_list_passes_this_repository(self):
        here = Path(__file__).resolve().parent
        for name in ("check.py", "test_check.py"):
            self.assertFalse(check.names_a_brand((here / name).read_text(encoding="utf-8")))


if __name__ == "__main__":
    unittest.main()
