---
id: TRU-5.3
title: 'Claude in Truing: what TRU-5.2''s reviews found'
status: Done
assignee: []
created_date: '2026-11-03 12:32'
updated_date: '2026-11-04 09:10'
labels:
  - claude
  - debt
milestone: m-0
dependencies:
  - TRU-5.2
parent_task_id: TRU-5
type: feature
ordinal: 50030
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-5.2's four reviews said "not ready". The decision on 2026-11-03 was to move on before their findings were fixed, so they are here. Each was found by reading or by a probe with a fake Claude. None has been fixed, and the first two groups should come before anyone else uses Truing.

Each fix comes with a test that fails without it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Zero config.** Every limit below works from what the session and the profile already know. The lists of writable paths and code-running commands come from Claude's read of the project, a person can see and change them on the review screen, and no fix adds a required config entry.
- [x] #2 **Writes: ESLint runs code from its flags.** `eslint *` runs unasked. `-c evil.mjs` ran code from a file, and `--output-file=x` and `--fix=true` were honoured, as the `ask` globs miss those forms. Writable stories folders let Claude write that file. Plan: a Bash hook that lets those commands take file paths and no flags, in place of the `ask` globs.
- [x] #3 **Writes: a bare `Bash` allow rule in a project's settings escapes the `ask` list** (`projectShellRules` in `src/claude/session.ts` matches only `Bash(`).
- [x] #4 **Writes: Claude can write its own lasting instructions.** `.claude/rules/design-*.md` and `.claude/skills/design-*/**` are on the allow-list, so text injected from the page could persist across sessions, and the skills glob isn't limited to Markdown. Take them off the allow-list so each asks, and limit the guard to `.md`. A `SKILL.md`'s `allowed-tools` may also grant shell: check it.
- [x] #5 **Undo restores any file that changed during the turn,** including someone's concurrent edit to `package.json`. Limit it to the writable paths, and name what it left.
- [x] #6 **Undo always refuses when the project is below the repository's root** (`src/modules/claude/checkpoint.ts`: paths are from the root, and `hash-object` runs from the project).
- [x] #7 **Undo: "all or none" isn't.** A write that fails partway leaves a partial undo, which then blocks a retry. Read every blob first, and roll back on a failure.
- [x] #8 **Undo: outside git there is silently no Undo.** Say so on the turn.
- [x] #9 **Runs:** Stop, then Send before the turn ends: the message stays stuck behind `paused` (`src/modules/claude/chat.ts`).
- [x] #10 **Runs:** Stop before the process has started is ignored, and Claude runs on.
- [x] #11 **Runs:** Keep, then New chat: `saveChat` restores the old `chatId`, and the next turn overwrites that chat. Set the id before the await, and run saves in order.
- [x] #12 **Runs:** A prompt unanswered for 5 minutes is probably denied by `fetch`'s default timeout in `src/claude/mcp-server.mjs`, and stays clickable. Use `node:http`, set `MCP_TOOL_TIMEOUT`, and remove the prompt when its connection closes.
- [x] #13 **Runs:** A hung run never gets SIGKILL, so Apply waits forever (`src/modules/claude/run.ts`).
- [x] #14 **Runs:** An assistant `rate_limit` event erases a known `resetsAt` (`events.ts`).
- [x] #15 **Runs:** The "couldn't carry on this chat" message overwrites plan and organisation errors on a resumed chat. Use it only for the generic stop.
- [x] #16 **Reads: text in a screenshot has no data rule of its own in the message.** Images come last, with no reminder after them. Put the images before the person's words, label each with its element's number, and end with the reminder. The skill's wording is already in (version 2).
- [x] #17 **Reads: element text isn't cleaned or capped** (`message.ts`): tag characters, zero-width and bidi characters survive, and 1,000,000 characters passed. `href` keeps its query string. Keep U+200C and U+200D, which some scripts need.
- [x] #18 **Reads: a file name can close `<studio-note>`:** escape `<` there too.
- [x] #19 **Reads:** The Next line belongs in `sessionPrompt`, only when the project has Next; the prompt should name the design paths Claude may write when asked.
- [x] #20 **View: the prompt on a pick is clipped** for a pick in the page's left part: `translateX(-100%)` runs past the canvas. Clamp it to the frame.
- [x] #21 **View:** Bypass runs unseen from the prompt on a pick, as only the foot's composer shows the note.
- [x] #22 **View:** A chip's remove button is 20 px; the rule is 24.
- [x] #23 **View:** A new file's editor opens without focus: `autoFocus` runs before `dialog.show()`.
- [x] #24 **View:** The prompt on a pick has no close for a mouse.
- [x] #25 **View:** Closing the viewer while editing loses the text without asking.
- [x] #26 **View:** Signed out is a dead end: no Check again, and Run still shows.
- [x] #27 **View:** The chat's bar scrolls away in a long chat; make it sticky.
- [x] #28 **View:** Stop makes the composer's menus jump: keep it in the row, disabled when idle.
- [x] #29 **View:** Many chips can push Send off the window.
- [x] #30 **View:** A waiting permission prompt can't be seen from Properties.
- [x] #31 **View:** Claude's answers show raw Markdown for lists and tables. Decide whether "plain text" means this; the renderer exists (`src/shell/controls/markdown.tsx`).
- [x] #32 **View, smaller:** the current session marked by the selected background, not weight; `.claude-add`'s height; the viewer overlaps the rail by 10 px at 1280.
- [x] #33 **Words:** "Don't ask" reads as going ahead, but it refuses: "Allowed only". "Accept edits" and "Auto" need a note each, from Claude Code's docs: Accept edits also runs `mkdir`, `touch`, `rm`, `rmdir`, `mv`, `cp` and `sed` in the project unasked.
- [x] #34 **Words:** The bypass note understates it: a command can change or delete anything, even outside the project, and Undo can't bring every change back.
- [x] #35 **Words:** "Changed 3 files" counts calls, not files, and a folded "Used" or "Asked" says nothing.
- [x] #36 **Words:** Delete on a skill removes its whole folder, and should say so. "Yours to add" clashes with "Yours" meaning personal files. "Show Claude" rewords a string that's still true.
- [x] #37 **Checks not yet run:** Plan mode: `ExitPlanMode` shows only the tool's name in the prompt, its behaviour in `-p` isn't documented, and the path guard may refuse its plan file.
- [x] #38 **Checks not yet run:** `scripts/check-claude-session.ts`: its out-of-bounds write passed because Claude declined, before the guard ran. Make the write look allowed, as the symlink probe in TRU-5.2 did.
- [x] #39 **Checks not yet run:** Measuring the prompt moved to TRU-12.1, as its last criterion, since those tools change what Claude is handed.
- [x] #40 **Writes: a dangling symlink passes the path guard,** and the write lands outside the project. `src/real-path.mjs` now judges a link to nothing by where it points, so one aimed outside the project, or at anything off limits, is refused.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `make check` passes and its output is quoted in the final summary
- [x] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [x] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [x] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed at the owner's request on 2026-11-04, as seen failing intermittently: `says plainly when it couldn't put them back either` (reported `moved` rather than `failed` once in a full run, cause not found, so a false `moved` from Undo under load hasn't been ruled out) and `resumes the same session from the second message on` (failed once at load above 8). The first leaves the case where the rollback itself also fails untested; `puts everything back when a write fails` stays. The second leaves `--resume` on a second message with no direct test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All 39 findings are fixed or answered, and the fortieth moved to TRU-12.1. Writes: `make check` passes: 1173 unit tests. `pnpm check-first-run` on a real `claude`: 16 of 16. `pnpm check-claude` on a throwaway project whose settings try to disable hooks: the path guard still refused both link attacks. Live: an unanswered prompt waited 362s and still worked, against a denial at 301s before. Plan mode was run for real: `ExitPlanMode` shows the plan now, but in `-p` a yes makes Claude edit in the same turn, and a no changes nothing. View and Words were seen in a one-off headless browser at 1280 and 1440, light and dark. They have no automated regression test, since the e2e suite was removed at the owner's request on 2026-11-04. A fresh review before the first push proved Undo could delete files when a git read failed: fixed, with `test/unit/pre-push-review.test.ts`. TRU-10.8 holds what that review left.
<!-- SECTION:FINAL_SUMMARY:END -->
