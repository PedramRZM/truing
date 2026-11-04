---
id: TRU-5.2
title: 'Claude in Truing: chat, inline prompts, undo, the repo''s skills and rules, UI-only permissions'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-11-03 13:18'
labels:
  - claude
dependencies:
  - TRU-1.2
  - TRU-1.5
  - TRU-5.1
  - TRU-3.10
type: feature
ordinal: 50020
parent_task_id: TRU-5
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The designer asks Claude for anything the panels can't do:

- in a chat panel, with the selection attached;
- inline on one element.

Claude also applies the changes the Changes tray routes to it (TRU-12.2).

Three things are non-negotiable (the maintainer, 2026-10-31; the code-first workflow spec §6):

- **It runs on the designer's own Claude seat through Claude Code.** No API keys. The bridge is the one TRU-1.2 proves.
- **It uses the repository's own Claude Code configuration**, so a designer's session follows the same rules as a developer's:
  - AGENTS.md;
  - `.claude/skills` (`react-patterns`, `ui-design`, `ux-copy`, `verify-ui`, …);
  - `.claude/rules` (`ui.md` and `react.md` attach to UI files; `nextjs-docs.md` points at `node_modules/next/dist/docs/`);
  - the `.claude/settings.json` hooks (the bash guard, the secrets guard, Prettier).
- **It can only touch UI files**, and every turn can be undone.

Truing also needs one thing the repo doesn't have yet: **a design skill**. It is the short, versioned statement of how Claude should apply design changes:

- tokens only, on the project's spacing scale;
- existing components and variants first;
- mobile-first breakpoint classes before restructuring;
- existing copy untouched;
- UI files only.

Designers extend it by conversation (TRU-17.2).

### Added later (2026-11-03)

- Truing will move out of a real app into a project of its own, with a setup that reads a project's files and brings them in. So what this task builds can't know about a real app: anything specific to it goes in `truing.config.ts`.
- TRU-17.2 and later teach Claude design rules through skills and rules, so what these sessions load must show in the Claude tab (TRU-5.1).
- No e2e runs and no new e2e tests. A spec this change breaks is skipped or removed.

After trying the first build, the same day:

- A new chat, and earlier chats to resume.
- Claude's configuration moves from the left panel into the Claude view, behind a button.
- The model menu shows real versions, such as Opus 5.5.
- A menu with every permission mode Claude Code has, bypass included. **This replaces the criterion "`bypassPermissions` is never used".**
- Designers add, edit and remove their configuration there, with Markdown files and their tables read as text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Where it lives (2026-11-02).** A Properties | Claude switch at the top of the right panel, at the same height and in the same control as the left panel's Design | Theme. The panel widens from 280 to 360 px while Claude shows, and the canvas gives up the room. Layers and the canvas stay in view, so picking an element attaches it to the message. The view and width persist. Claude's view reaches the right panel through the module contract (TRU-3.8), so Properties needs no change.
- [x] #2 **The chat's look.** Paper has no chat panel in its web app, so this is ours, built from `docs/design-language.md`. A designer's message sits on the control colour; Claude's answer is plain text on the panel, with no bubbles or avatars. Activity is a quiet row in text 2. A turn's diff is a Section with its files as Rows, and its keep and undo at the end.
- [x] #3 **The composer.** `docs/design-language.md`'s Composer pattern, after Paper's Create image box: chips for what's attached, then the text, then small menus at the left and Send at the right. It sits at the panel's foot, under TRU-3.10's Changes summary. The inline prompt uses the same shape, smaller, floating by the element.
- [x] #4 **Chat.** The panel streams Claude's answer and shows its activity in plain words ("read `search-card.tsx`", "changed 2 files"); Selected elements are attached as chips that carry source locations, component, variant, tokens and a cropped screenshot; New messages queue while Claude is working.
- [x] #5 **Inline prompt.** In Select mode, a small prompt box on the selected element sends a request scoped to that element.
- [x] #6 **First prompts (the maintainer, 2026-11-02, from Paper's Connect your agent dialog).** With nothing selected, the right panel (TRU-3.8) shows Claude's status. A designer who hasn't used it yet sees two or three example prompts they can run or copy.
- [x] #7 **Undo.** Each Claude turn ends with its diff and the changed frames. The designer keeps it, which becomes a commit (TRU-13.2), or undoes it as one step.
- [x] #8 **Repo configuration.** Sessions load it. A test reads the session's init event and checks that the project's skills and Truing's MCP servers are listed. It also proves that the Prettier hook formatted Claude's edit and that the bash guard refused a forbidden command.
- [x] #9 **Design skill.** The skill exists under `.claude/skills/` (name agreed with the maintainer), with the rules above, and is loaded in every Truing session; `.claude/skills/README.md` lists it; a prompt review reviews it.
- [x] #10 **Permissions.** Writes are limited to `src/**/*.tsx`, the project's token stylesheet and the project's UI folders, plus design-scoped configuration for TRU-17.2; Both a path-guard hook and the tool allow-list enforce this; Shell access is limited to an allow-list (typecheck and lint of touched files); Permission prompts are answered in Truing; ~~`bypassPermissions` is never used.~~ Replaced by the maintainer, 2026-11-03: the designer chooses any mode Claude Code has, for each message. Manual is the default, and bypass doesn't survive a reload. The path guard and the deny rules hold in every mode, checked live. In bypass, shell commands run unasked and aren't limited to UI files, and the session carries no `ask` rules, as Claude Code would still prompt for them; A test proves a write to server code is denied.
- [x] #11 **Subscription only.** The bridge removes `ANTHROPIC_API_KEY` and `apiKeyHelper` before starting Claude; No API key appears in Truing's code or environment; a test checks this; An expired login shows "sign in to Claude again", with the exact command; A reached usage limit shows when it resets, and the direct edits keep working.
- [x] #12 **Next context.** Next's dev MCP endpoint (`/_next/mcp`) is available to Claude for route and error context.
- [x] #13 **One run at a time.** Each designer has one active Claude run, serialised with the direct edits. A request made while Claude is working is queued, never run in parallel on the same files.
- [x] #14 **Packaging.** The design skill and the design tools (TRU-12.1) are loaded the way TRU-1.2 chose (`--plugin-dir` or explicit flags). A developer's own `claude` session in the same repo is unchanged by Truing.
- [x] #15 **Bridge rules (carried from TRU-1.2).** Each has a test.: The permission prompt tool answers allow with the original input only, and deny with a message: an edited `updatedInput` runs without the hooks or deny rules; Commands that run project code (tests, lint with fixes, build, Playwright, `git switch`) get `ask` rules, so the project's allow rules don't let them through; The path guard fails closed, resolves symlinks, matches forbidden paths case-insensitively and refuses test files; The bridge answers only its own loopback `Host`. The page and the MCP server hold separate tokens, and neither token is in Claude's environment; Every run sends a model. There is no thinking switch, because `alwaysThinkingEnabled: false` didn't turn thinking off.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
**A conflict, and the call taken .** The criteria put the design skill in `.claude/skills/`, but a skill in a project's folder would change developers' sessions there too. So the skill ships with Truing, in its own plugin (`src/claude/plugin/skills/design-rules/`), loaded with `--plugin-dir` as TRU-1.2 chose, and `.claude/skills/README.md` points at it. It knows nothing about one project: the session's prompt adds the tokens file, primitives folder and writable paths from the config, and AGENTS.md carries the project's own conventions such as the project's spacing convention. The name `design-rules` is mine. Designers' own rules (TRU-17.2) stay in the project, as `.claude/rules/design-*.md`.

**Slices:**

1. **Contract.** A module's server can publish state to its panel (`server.state`, `ctx.publish`, `props.state`). A panel can read another module's reports and call its ops (`panel.follows`, `props.peers`). A section can sit in a right-panel view (`panel.view`), with something pinned under the Changes summary (`foot`) or on the canvas (`canvas`). `ctx.exclusive` serialises everything that writes source, and Apply goes through it. `ctx.screenshot` crops a frame without scrolling it.
2. **Right panel.** Properties | Claude in the same control as the left tabs, 360 px while Claude shows, remembered. Without a module in that view, no switch.
3. **The session, for any project** (`src/claude/`): flags, the per-run settings (allow-list from `writable`, `ask` for every project Bash rule outside `claude.shell`, deny for pushing and committing), the path guard, the MCP server holding the permission prompt tool, the bridge it calls, Next's `/_next/mcp` when the project is a Next app, the plugin and its skill. The Claude tab asks with the same flags, so it follows.
4. **The `claude` module:** one process per turn resumed by session ID; the stream turned into plain activity; a queue; permission prompts answered on the panel; a git checkpoint in a temporary index around each turn for its diff and its undo; sign-in and limit states.
5. **The UI:** chat, composer, chips from picks, first prompts, inline prompt on a pick. New patterns go in `docs/design-language.md`.
6. **Proof.** Unit tests with a fake `claude` and no model call. A live script (`scripts/check-claude-session.ts`, not part of the suite) for what only a real session can show: the init event, Prettier, the bash guard, a denied write, a prompt answered. Driven by hand in Truing, then a task review, a design review, a copy review, a prompt review.

**How each criterion is proved:** placement, look, composer, chat and inline by driving the real studio with screenshots at 1280 and 1440, light and dark. Undo, queue, one run at a time, permissions, subscription and bridge rules by unit tests. Repo configuration, packaging and Next context by the live script. No Playwright spec is added or run, by request.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**Truing has Claude: a chat behind Properties | Claude, a prompt on a pick, Keep and Undo per message, sessions to resume, a menu of every permission mode, and a configuration view where designers edit their own rules and skills. It works end to end on a real seat, but its reviews said not ready and the findings aren't fixed.** the maintainer asked to move on (2026-11-03), so they are all in TRU-5.3, which should come next. Nothing in the module or `src/claude/` names a real app; what is a real app's is `claude.dropEnv` and `claude.shell` in `truing.config.ts`.

**For the standalone project:** the session's flags, settings, guard, MCP server and skill live in Truing and read everything else from the config and the project's Claude files. `next` connects only when the project depends on it. Sessions and chats are kept outside the project.

**Not built:** TRU-12.1's design tools on the MCP server; the commit on Keep, which is TRU-13.2's (Keep only closes the decision).

**How each criterion was checked**

| Criterion | Evidence |
| --- | --- |
| Where it lives | Driven: 280 to 360 px, kept after a reload. Both tab rows span y 40 to 63 at 24 px, with the line at y 72. |
| Chat's look, composer | Screenshots at 1440 light, read by me and a design review. The composer sits under the Changes summary. |
| Chat | Your own test turn ran through the UI: streaming, web search, a helper, edits, lint and typecheck calls (session `7a4d8a1b`). A chip from a pick carried source, component, variant and tokens to Claude, with a screenshot. Queue: unit tests. |
| Inline prompt | Driven: `A` opens it, and it holds focus. **Known bug:** clipped for picks on the page's left (TRU-5.3). The fixed pill's place has no screenshot. |
| First prompts | Driven: three with Run and Copy, when nothing is picked and it's unused. |
| Undo | Unit tests on real git repositories: restores, deletes what was new, refuses when a file moved on, never touches the index. A snapshot of a large repository takes 68 ms and leaves its index alone. **Known bugs in TRU-5.3.** |
| Repo configuration | `pnpm --filter truing check-claude` on Haiku, 11 of 11: init lists the design skill, 37 skills and the connected MCP server; `apiKeySource` is `none`; Prettier turned `{"b":    "c"}` into `{ b: 'c' }`; the bash guard refused `git clean`; a prompt reached the bridge. |
| Design skill | In Truing's plugin, not `.claude/skills/`: see the plan. Listed in `.claude/skills/README.md` and the Configuration view. Sent with every message, and Claude quoted rule 4 back. a prompt review reviewed it: findings in TRU-5.3. |
| Permissions | Path guard unit tests, and live on a scratch project: a write through a symlink was refused in bypass and in manual. A deny rule and the bash guard held in bypass (`init` reported `bypassPermissions`). **Known bugs in TRU-5.3,** including a way past the shell allow-list. |
| Subscription only | Unit tests on the environment and on the code's text; `apiKeySource: none`. Sign-in and limit states by unit tests on the documented events: **an expired login and a reached limit have not happened live.** |
| Next context | `next` connected in `init`, and `mcp__next__*` tools were listed. Claude hasn't been seen calling one. |
| One run at a time | Unit tests: a queue, and Apply waits behind a turn with a notice. |
| Packaging | `--plugin-dir` and `--mcp-config`, files in a private temp folder. A unit test shows nothing lands in the project. |
| Bridge rules | Unit tests: original input only, Host and tokens, fail closed, model always sent, no thinking switch. |
| Added: new chat, sessions | Driven on Haiku: a code word, New chat, Sessions, resume, and Claude still knew it. |
| Added: configuration | Driven: opens from the chat's button, under the Claude tab. A rule made, edited with a table, shown as a table, deleted, and a bad name refused. |
| Added: models | Menu showed Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5, asked of Claude Code at no cost (`total_cost_usd: 0`, about 4.5 s). |
| Added: permission modes | All six in the menu, chosen per message. Only bypass and manual have been run live. |

**Commands, last run:** package `tsc` clean; `vitest run` 754/754 (44 files), with the guard that fails if a test starts Claude; root `pnpm typecheck` clean; ESLint 0 errors, 13 warnings;  No e2e spec ran, none was added or skipped. By reading, a task review found none that plainly breaks.

**What the reviewers said: all four not ready.** Passes: the bridge rules, one run at a time, packaging, the data block (63 of 63 attacks held), colour tokens, contrast and the switch. Everything else is TRU-5.3. Found while driving and fixed: the prompt on a pick re-tracking in a loop, as `command` is a new function each render.

**After the maintainer tried it (2026-11-03), both reproduced first:**

- **Bypass still asked.** `pnpm exec jest --version` reached the designer as a prompt, as the session carried 34 `ask` rules, which Claude Code honours in bypass. Bypass sessions now carry none: live on Haiku it printed `29.7.0` with 0 prompts, and a unit test failed before the fix. Deny rules and the path guard stay.
- **The message box filled with text.** On Linux a middle click pastes the current selection, and that button pans here. Selecting a rule in the viewer and middle-clicking the box gave 810, 1620, then 2430 characters; after the fix, 0, by a throwaway drive, as no e2e spec was to be added. Middle-click paste is off in all Truing's own fields. That this was the trigger is inferred from the text's shape, not observed.

**Left open**

- **TRU-5.3** before anyone else uses this.
- **Your index:** every TRU-5.2 file showed as staged at some point before 12:03, by something other than the checkpoint, which leaves the index alone in both tests. I couldn't find what did it.
- **Bypass** resets to Ask first on a reload. That was my call: say if it should stick.
- **Canvas at 1280:** with Claude showing it's 638 px, under `MIN_CANVAS`, as the criterion has the canvas give up the room.
- **Undo goes with a chat:** New chat or resuming counts a turn still waiting for a decision as kept.
- **Sessions** are Truing's own chats, in `~/.cache/truing-chats/`. Your terminal sessions don't list there.
- **Editing:** designers change only `.claude/rules/design-*.md` and `.claude/skills/design-*`. The rest of the configuration is read-only: say if "their configs" meant more.
- **Taste:** accumulating chips rather than replacing them, the words on the mode menu, and the "Ask Claude" pill on every pick.
- **Not checked:** A browser check as a tool, since Truing only runs in its own browser. Dark mode of the newest screens, the working, failed, diff and permission states have no screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
