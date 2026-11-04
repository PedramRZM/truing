# Undo brings a deleted script back without its execute permission

If Claude deletes an executable file during a turn and you press Undo, the file comes back with the right text, but it can't be run any more.

**Why it happens.** `putFile` in `src/modules/claude/checkpoint.ts` writes the old text with a plain `writeFile`. Git stores whether a file was executable, in the tree the turn started from, but the code doesn't read it.

**What to change.** Read the file's mode from the `before` tree, with `git ls-tree`, and set it when a file is recreated. Don't change a file's mode if it wasn't recreated.

**How to prove it.** Add a test to the `undo` tests in `test/unit/claude-chat.test.ts`, which already build a temporary repository: commit an executable file, delete it in a turn, undo, and check its mode. Then run `make check`.
