# The chat shows "Used ExitPlanMode"

Most of what Claude does shows in the chat in plain words: "Read a.tsx", "Searched the code". Finishing a plan shows the tool's raw name, which means nothing to a designer.

**Why it happens.** `describeTool` in `src/modules/claude/events.ts` has words for the common tools, and falls back to the name for the rest.

**What to change.** Give `ExitPlanMode` its own words, such as "Finished the plan". Check the other tools a turn can use while you're there, and add any that read badly.

**How to prove it.** Add a case to the test `describes each kind of tool, and leaves out what a designer has no use for` in `test/unit/claude-chat.test.ts`. Text follows `.agents/skills/ux-copy/SKILL.md`. Then run `make check`.
