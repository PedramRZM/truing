# Two files with the same name count as one in the chat

When Claude edits `app/a/page.tsx` and `app/b/page.tsx`, the chat's folded row says "Changed 1 file". Next.js projects are full of `page.tsx`, so this comes up often.

**Why it happens.** `fileName` in `src/modules/claude/events.ts` keeps only a file's base name, so the count in `src/modules/claude/words.ts` can't tell the two apart.

**What to change.** Keep the path for counting, and keep showing the short name.

**How to prove it.** Add a test to `test/unit/claude-view.test.ts`, near the tests for a folded row: edits to two `page.tsx` files in different folders say "Changed 2 files", and three edits to one file still say "Changed 1 file". Then run `make check`.
