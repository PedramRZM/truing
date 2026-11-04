# "Checking Claude…" never goes away if Claude Code can't say

The chat's status reads "Checking Claude…" until it knows whether you're signed in. If `claude auth status` gives no clear answer, it never finds out, and the line stays for good.

**Why it happens.** `statusText` in `src/modules/claude/panel.tsx` treats `signedIn === null` as "still checking". But null also means the check finished with no answer.

**What to change.** Tell the two apart, and show nothing, or a line saying it couldn't tell, once the check has finished. `status` in `src/modules/claude/chat.ts` is where the answer arrives. A message can still be sent either way.

**How to prove it.** Pull the choice of words into a function you can test, as `src/modules/claude/words.ts` does for other text, and add cases to `test/unit/claude-view.test.ts`: checking, signed in, signed out, and finished with no answer. Text follows `.agents/skills/ux-copy/SKILL.md`. Then run `make check`.
