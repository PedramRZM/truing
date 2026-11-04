---
id: TRU-5.3
title: 'Claude in Truing: what TRU-5.2''s reviews found'
status: To Do
assignee: []
created_date: '2026-11-03 12:32'
labels:
  - claude
  - debt
milestone: m-0
dependencies:
  - TRU-5.2
type: feature
ordinal: 50030
parent_task_id: TRU-5
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-5.2's four reviews said "not ready". The decision on 2026-11-03 was to move on before their findings were fixed, so they are here. Each was found by reading or by a probe with a fake Claude. None has been fixed, and the first two groups should come before anyone else uses Truing.

Each fix comes with a test that fails without it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Zero config.** Every limit below works from what the session and the profile already know. The lists of writable paths and code-running commands come from Claude's read of the project, a person can see and change them on the review screen, and no fix adds a required config entry.
- [ ] #2 **Writes: ESLint runs code from its flags.** `eslint *` runs unasked. `-c evil.mjs` ran code from a file, and `--output-file=x` and `--fix=true` were honoured, as the `ask` globs miss those forms. Writable stories folders let Claude write that file. Plan: a Bash hook that lets those commands take file paths and no flags, in place of the `ask` globs.
- [ ] #3 **Writes: a dangling symlink passes the path guard,** and the write lands outside the project. `realPath` in `src/claude/path-guard.mjs` treats a link to nothing as a missing file. Use `lstat`, and refuse it.
- [ ] #4 **Writes: a bare `Bash` allow rule in a project's settings escapes the `ask` list** (`projectShellRules` in `src/claude/session.ts` matches only `Bash(`).
- [ ] #5 **Writes: Claude can write its own lasting instructions.** `.claude/rules/design-*.md` and `.claude/skills/design-*/**` are on the allow-list, so text injected from the page could persist across sessions, and the skills glob isn't limited to Markdown. Take them off the allow-list so each asks, and limit the guard to `.md`. A `SKILL.md`'s `allowed-tools` may also grant shell: check it.
- [ ] #6 **Undo restores any file that changed during the turn,** including someone's concurrent edit to `package.json`. Limit it to the writable paths, and name what it left.
- [ ] #7 **Undo always refuses when the project is below the repository's root** (`src/modules/claude/checkpoint.ts`: paths are from the root, and `hash-object` runs from the project).
- [ ] #8 **Undo: "all or none" isn't.** A write that fails partway leaves a partial undo, which then blocks a retry. Read every blob first, and roll back on a failure.
- [ ] #9 **Undo: outside git there is silently no Undo.** Say so on the turn.
- [ ] #10 **Runs:** Stop, then Send before the turn ends: the message stays stuck behind `paused` (`src/modules/claude/chat.ts`).
- [ ] #11 **Runs:** Stop before the process has started is ignored, and Claude runs on.
- [ ] #12 **Runs:** Keep, then New chat: `saveChat` restores the old `chatId`, and the next turn overwrites that chat. Set the id before the await, and run saves in order.
- [ ] #13 **Runs:** A prompt unanswered for 5 minutes is probably denied by `fetch`'s default timeout in `src/claude/mcp-server.mjs`, and stays clickable. Use `node:http`, set `MCP_TOOL_TIMEOUT`, and remove the prompt when its connection closes.
- [ ] #14 **Runs:** A hung run never gets SIGKILL, so Apply waits forever (`src/modules/claude/run.ts`).
- [ ] #15 **Runs:** An assistant `rate_limit` event erases a known `resetsAt` (`events.ts`).
- [ ] #16 **Runs:** The "couldn't carry on this chat" message overwrites plan and organisation errors on a resumed chat. Use it only for the generic stop.
- [ ] #17 **Reads: text in a screenshot has no data rule of its own in the message.** Images come last, with no reminder after them. Put the images before the person's words, label each with its element's number, and end with the reminder. The skill's wording is already in (version 2).
- [ ] #18 **Reads: element text isn't cleaned or capped** (`message.ts`): tag characters, zero-width and bidi characters survive, and 1,000,000 characters passed. `href` keeps its query string. Keep U+200C and U+200D, which some scripts need.
- [ ] #19 **Reads: a file name can close `<studio-note>`:** escape `<` there too.
- [ ] #20 **Reads:** The Next line belongs in `sessionPrompt`, only when the project has Next; the prompt should name the design paths Claude may write when asked.
- [ ] #21 **View: the prompt on a pick is clipped** for a pick in the page's left part: `translateX(-100%)` runs past the canvas. Clamp it to the frame.
- [ ] #22 **View:** Bypass runs unseen from the prompt on a pick, as only the foot's composer shows the note.
- [ ] #23 **View:** A chip's remove button is 20 px; the rule is 24.
- [ ] #24 **View:** A new file's editor opens without focus: `autoFocus` runs before `dialog.show()`.
- [ ] #25 **View:** The prompt on a pick has no close for a mouse.
- [ ] #26 **View:** Closing the viewer while editing loses the text without asking.
- [ ] #27 **View:** Signed out is a dead end: no Check again, and Run still shows.
- [ ] #28 **View:** The chat's bar scrolls away in a long chat; make it sticky.
- [ ] #29 **View:** Stop makes the composer's menus jump: keep it in the row, disabled when idle.
- [ ] #30 **View:** Many chips can push Send off the window.
- [ ] #31 **View:** A waiting permission prompt can't be seen from Properties.
- [ ] #32 **View:** Claude's answers show raw Markdown for lists and tables. Decide whether "plain text" means this; the renderer exists (`src/shell/controls/markdown.tsx`).
- [ ] #33 **View, smaller:** the current session marked by the selected background, not weight; `.claude-add`'s height; the viewer overlaps the rail by 10 px at 1280.
- [ ] #34 **Words:** "Don't ask" reads as going ahead, but it refuses: "Allowed only". "Accept edits" and "Auto" need a note each, from Claude Code's docs: Accept edits also runs `mkdir`, `touch`, `rm`, `rmdir`, `mv`, `cp` and `sed` in the project unasked.
- [ ] #35 **Words:** The bypass note understates it: a command can change or delete anything, even outside the project, and Undo can't bring every change back.
- [ ] #36 **Words:** "Changed 3 files" counts calls, not files, and a folded "Used" or "Asked" says nothing.
- [ ] #37 **Words:** Delete on a skill removes its whole folder, and should say so. "Yours to add" clashes with "Yours" meaning personal files. "Show Claude" rewords a string that's still true.
- [ ] #38 **Checks not yet run:** Plan mode: `ExitPlanMode` shows only the tool's name in the prompt, its behaviour in `-p` isn't documented, and the path guard may refuse its plan file.
- [ ] #39 **Checks not yet run:** `scripts/check-claude-session.ts`: its out-of-bounds write passed because Claude declined, before the guard ran. Make the write look allowed, as the symlink probe in TRU-5.2 did.
- [ ] #40 **Checks not yet run:** TRU-12.1 should measure the prompt: its hash and resolved model, attacks in element text and screenshots reported as k of n, benign labels such as "Delete account", and copy preserved in any language.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
