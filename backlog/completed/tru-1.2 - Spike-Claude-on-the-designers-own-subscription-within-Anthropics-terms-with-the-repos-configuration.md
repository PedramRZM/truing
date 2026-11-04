---
id: TRU-1.2
title: 'Spike: Claude on the designer''s own subscription, within Anthropic''s terms, with the repo''s configuration'
status: Done
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-10-31 15:31'
labels:
  - spike
  - claude
dependencies: []
type: spike
ordinal: 10020
parent_task_id: TRU-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every AI feature in Truing runs on the designer's own Claude seat through Claude Code (2026-10-31). No API keys. And it runs with the repository's configuration, so a designer's Claude behaves like a developer's:

- AGENTS.md;
- the `.claude/` skills (`react-patterns`, `ui-design`, `ux-copy`, …);
- the rules (`ui.md` and `react.md` attach to UI files; `nextjs-docs.md` always);
- the hooks (bash guard, secrets guard, Prettier).

The open question is how a local tool may drive it. Anthropic's terms treat subscription login as being for ordinary use of Claude Code and Anthropic's own apps. Products built on the Agent SDK are told to use API keys, and third parties may not offer claude.ai login. claude-agent-acp even refuses subscriptions for one commercial integration (`repos-notes/claude-agent-acp.md`). the code-first workflow spec §6 ranks three options:

| Option                               | How it works                                                 | Within the terms?  |
| ------------------------------------ | ------------------------------------------------------------ | ------------------ |
| a. Spawn the unmodified `claude` CLI | headless, stream-json in and out                             | clearly            |
| b. MCP the other way round           | the designer's own Claude Code calls Truing over MCP | clearly            |
| c. Agent SDK `query()`               | in-process, on the designer's login                          | grey for this case |

This spike proves (a) end to end, checks (b), and records the answer on (c).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Option (a), end to end.** A local bridge spawns `claude` in the repository, headless, with stream-json input and output; It streams a multi-turn conversation to a minimal page, resuming the same session between turns, and sends a screenshot as an image input; Claude edits a `.tsx` file.
- [x] #2 **The repo's configuration is loaded.** (Met after a fix: AGENTS.md loads only once Truing's settings name it; TRU-5.1 fixes that for the repository. See Result.) The session's init event lists the project's skills and the bridge's MCP server. Claude's edit is formatted by the repo's Prettier hook. The bash guard refuses a forbidden command. Record how skills and rules show up in headless mode.
- [x] #3 **Subscription only.** (Accepted by the maintainer, 2026-10-31. `/status` doesn't run in `-p`, so `claude auth status` stands in. One turn doesn't move `/usage`'s whole-percent counters; the evidence of counting is indirect. `rate_limit` and an expired login are recorded from the docs only. See Result.): The bridge starts Claude with `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `apiKeyHelper` removed, and never with `--bare`; It never reads `~/.claude/` credentials or stores a token; `/status` shows the claude.ai login; `/usage` before and after one turn shows it counted against the designer's seat; The seat type (Team or Enterprise, per the code-first workflow spec §6) is recorded; Behaviour on `rate_limit`, `authentication_failed` ("Login expired · Please run /login") and an org that disabled subscription access is recorded, with the exact events and messages.
- [x] #4 **Permissions.** (Met after fixes. The prompt tool must never return a changed input; the project's code-running allow rules need `ask` rules; the bridge token must stay out of Claude's environment. See Result.): Writes are limited to the product spec's UI paths by `Edit(...)` allow rules (`Write(...)` rules never match) and a `PreToolUse` path guard together; A write to server code is denied, and so is `git push`; With the run in headless Manual mode, a prompt reaches the page through `--permission-prompt-tool` and is answered there. Record the reply shape the tool must return; `bypassPermissions` is never used.
- [x] #5 **Packaging.** The design tools' MCP server and a stub design skill, loaded through `--strict-mcp-config --mcp-config` and through `--plugin-dir`. Record which is simpler, and whether it leaves developers' own sessions untouched.
- [x] #6 **Option (b).** The designer's own Claude Code (terminal or desktop) connects to the bridge's MCP server and calls a stub `get_selection`; Record whether Truing can push a staged change set into that running session (channels or notifications), or only answer when called.
- [x] #7 **Asking Anthropic.** (Not asked; option (a) chosen. The maintainer, 2026-10-31.) The written question to Anthropic sales is recorded with its answer, or as "not asked; option (a) chosen". It asks: whether a tool that drives the unmodified CLI on a person's own seat is fine; whether the Agent SDK on a subscription login would be.
- [x] #8 **Run choices** (added by the maintainer during the spike, 2026-10-31; closed by the maintainer the same day. Model, effort and fast mode reach the run; the thinking switch doesn't turn thinking off, so TRU-5.2 leaves it out. See Result.) The page sets the model, the effort, fast mode and thinking for each turn, and each choice is shown to reach the run.
- [x] #9 **Recommendation.** Which option, the flags and settings it needs, and the known limits. Carried into TRU-1.3's ADR and TRU-5.2.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Throwaway spike code on a scratch branch: a small bridge, an MCP server, a permission setup and Playwright drivers, run against a real project. The code is not part of this repo. Paths under `spike/` below are kept only as a record.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The spike code is under `spike/`, plus the fixture `spike-card.tsx`. Every check has a driver under `spike/e2e/` that reproduces it against the bridge (`node spike/bridge.mjs`, port 3211). The raw stream of every run, and each driver's JSON summary, are in `/tmp/spike/`. Those files don't survive a reboot; the drivers recreate them.

57 bridge runs, two interactive sessions and one plain `claude -p` were used. Runs 51–57 re-check the fixes made after the task review (`spike/e2e/review-fixes.mjs`). Over the spike, the seat's five-hour window went from 7% to 9%. That figure includes this working session too, so it is an upper bound for the spike.

### Option (a), end to end: works

`spike/e2e/option-a.mjs` drives the page (`spike/page.html`) with Playwright: three turns, runs 48–50.

- **Every turn is one `claude -p` process.** The user message goes in on stdin as one stream-json line, then stdin closes. Turns 2 and 3 pass `--resume <session_id>`, taken from the previous run's events. All three report the same session ID.
- **The message line the CLI accepts:** `{"type":"user","message":{"role":"user","content":[{"type":"text","text":…},{"type":"image","source":{"type":"base64","media_type":"image/png","data":…}}]},"parent_tool_use_id":null,"session_id":…}`.
- **Streaming.** Text arrives on the page as `stream_event` text deltas, and tool calls as `assistant` messages. The final `result` carries the session ID. The page screenshot is `/tmp/spike/option-a-page.png`.
- **Memory and image.** Turn 1 gives a code word. Turn 2 attaches a PNG that reads "MANGO 42" and asks about both. The answer: "The screenshot shows MANGO 42, and the code word you gave me earlier was PELICAN."
- **The edit.** Turn 3 asks for one Edit that writes `<p     className={"text-sm"}>…`. The Edit's `new_string` has exactly that. On disk it reads `<p className={'text-sm'}>…`, so the repo's Prettier hook ran. Claude was told about it through the hook's context, and said so in its answer. An earlier run of the driver gave the same result, but a bridge restart overwrote its logs, so only runs 48–50 are kept.

### The repo's configuration: loaded, once AGENTS.md is named in the settings

From `system/init`:

- `skills` lists all 17 project skills (`react-patterns`, `ui-design`, `ux-copy`, …) besides Claude Code's own. They are the project's copies: `verify` and `playwright-trace` exist only in the project, and the person's user-only skills are absent.
- `agents` lists the project's five reviewers.
- `mcp_servers` is `[{name: "spike", status: "connected"}]`.
- `apiKeySource` is `none`, `permissionMode` is `default` (that is, Manual).

Hooks:

- **Prettier:** shown above.
- **The bash guard** refused `git clean -f spike/none` with "Blocked by .claude/hooks/guard-bash.py: git clean -f deletes untracked files …".
- **Both project hooks only run because the bridge clears `CLAUDE_PERSONAL_HOOKS`.** the maintainer's `~/.claude/settings.json` sets that variable, and the project's `.claude/settings.json` skips every hook while it is set. The bridge strips it from the child's environment, sets it empty in `--settings`, and leaves the user settings layer out (`--setting-sources project,local`). Which of the three alone would be enough wasn't isolated.

How skills and rules show up headless (read from the session transcript under `~/.claude/projects/`, not from the stream, which doesn't carry them):

- Skills are listed in `init` and run through the `Skill` tool, as in a terminal session.
- At session start, an `instructions` attachment carries `nextjs-docs.md`, `working-here.md`, the user's `~/.claude/CLAUDE.md` and auto memory.
- **AGENTS.md was missing from runs 1–50** (found by the task review). The repository has no `CLAUDE.md`; AGENTS.md reaches Claude only through a personal setting `pluginConfigs["cc-plugin-agents-md@builtin"].options.instructionFiles: "claude-md-and-agents-md"`, which `--setting-sources project,local` leaves out. A plain session of the maintainer's lists AGENTS.md; a teammate's or a designer's never would. Truing's settings now carry the same setting, and run 51's `instructions` attachment lists `AGENTS.md`. TRU-5.1 makes the repository load it for everyone.
- When Claude reads `spike-card.tsx`, `nested_memory` attachments add `ui.md`, `react.md` and `typescript.md`: the project's copies, and a person's own from `~/.claude/rules/`.
- **`--setting-sources project,local` leaves out the user `settings.json` and the user's skills, but not the user's instructions.** `~/.claude/CLAUDE.md`, auto memory and `~/.claude/rules/` still load. So a designer's personal instructions apply in Truing too, while their personal skills don't. That seems right, but it is a choice for TRU-5.2.

**Untrusted workspace.** A run whose config directory has never accepted the workspace trust dialog prints "Ignoring 33 permissions.allow entries from .claude/settings.json: this workspace has not been trusted" on stderr. The project's hooks still run (the docs say so for `-p`). Truing's own rules come through `--settings`, so they are unaffected. Still, designer onboarding (TRU-13.1) should run `claude` once in the repository and accept the trust dialog.

### Subscription only: on the login, never an API key; partly checked

- **Environment.** The bridge removes `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT` and `CLAUDE_PERSONAL_HOOKS` from the child's environment. Its settings pin `"apiKeyHelper": ""`, and the user settings layer, where a helper usually lives, is left out. No helper exists on this machine, so that pin is untested. It never passes `--bare`.
- **Credentials.** The bridge reads no file under `~/.claude/` and stores no token. Its only secret is its own random loopback token, written to `/tmp/spike/token` with mode 600.
- **Login.** `/status` doesn't run in `-p`: it answers "/status isn't available in this environment." `claude auth status` stands in:
  - `--text` with the bridge's environment: "Login method: Claude Ultra account", and a personal organisation;
  - `--json`: `authMethod: "claude.ai"`, but `subscriptionType: "max"`. The two disagree on the plan name.
- **Usage.**
  - `/usage` does run in `-p`, at no cost (`num_turns: 0`). Its first line is "You are currently using your subscription to power your Claude Code usage".
  - **Before and after one turn**, an Opus run at high effort that read three long files, it showed the same "Current session: 8% used" and "Current week (all models): 15% used". One turn is under the counters' whole-percent resolution, so this check doesn't show the turn being counted.
  - **The evidence that it is counted** is indirect: that first line of `/usage`, `apiKeySource: none`, and a `rate_limit_event` on every turn with the seat's own windows: `{"five_hour":{"utilization":0.07,…},"seven_day":{"utilization":0.14,…}}`, `overageDisabledReason: "org_level_disabled"`. An API-key run wouldn't have those windows.
- **Seat type.** A personal Ultra plan (`auth status --text`; `--json` says `max`). Ultra has no organisation admin, so the org-level switches (disabled subscription access, fast mode and channels toggles) don't apply to it.
- **Not logged in.** `CLAUDE_CONFIG_DIR` pointed at an empty directory, which never touches the real credentials:

  - no `api_retry` event first;
  - a synthetic `assistant` message (`model: "<synthetic>"`, `error: "authentication_failed"`) with the text "Not logged in · Please run /login";
  - a `result` with `subtype: "success"`, `is_error: true`, `terminal_reason: "api_error"`;
  - exit code 1.

  "Login expired · Please run /login" needs an expired login and wasn't reproduced. The docs give it the same `authentication_failed` category.

- **`rate_limit`.** Not reached. Each turn's `rate_limit_event` carries `status` (`allowed` here), `rateLimitType`, `resetsAt` and the utilisations, so the page can show what is left before the limit hits. The documented failure is `api_retry` with `error: "rate_limit"`.
- **Org switch.** "Your organization has disabled Claude subscription access" is from the docs only; this seat has no admin. The documented `api_retry` category for a disallowed org is `oauth_org_not_allowed`.

### Run choices: model, effort, fast mode, thinking

The maintainer asked for these during the spike. The page has a model select (Default, Fable, Opus, Sonnet, Haiku), an effort select (Default, Low to Max), and checkboxes for fast mode and thinking. The bridge turns them into `--model`, `--effort`, and per-run settings (`fastMode`, `alwaysThinkingEnabled`) merged into the `--settings` file. Drivers: `run-options.mjs` and `effort.mjs`.

- **Model: works, and can change within one session.** One resumed session ran Haiku, Sonnet, then Opus. `init.model` and every assistant message's `model` matched the choice, and `result.modelUsage` listed all three. Without a choice the run uses Opus 5.5: leaving the user settings layer out also drops the designer's own `model` setting, so the page should always send one.
- **Effort: works, but is not echoed anywhere.** Neither the stream nor the transcript records the level. Its effect was measured instead, on Sonnet with the same prompt in fresh sessions (runs 6–9; thinking tokens from `result.modelUsage[model].thinkingTokens`):

  - `low`: 47 and 0 thinking tokens, 105 and 58 output tokens;
  - `max`: 244 and 265 thinking tokens, 302 and 324 output tokens.

  So the bridge has to remember what it asked for.

- **Thinking: the switch doesn't turn thinking off.** Measured on Sonnet at medium effort, the same prompt in fresh sessions (runs 54–57): `alwaysThinkingEnabled: true` gave 195 and 195 thinking tokens; `false` gave 137 and 163. An earlier `false` run on Opus showed none (run 3), but it also changed model and effort, so it proves nothing. Effort is the control that works. TRU-5.2 should leave the thinking switch out unless it is checked again.
- **Fast mode: switched on, but the turn ran at standard speed.** `fastMode: true` in `--settings` turned `init.fast_mode_state` from `off` (`sdk_opt_in_required`) to `on`. But the result's `usage.speed` was `standard`, and no notification said why. The docs say fast mode on a subscription is paid only from usage credits, and this seat has them off (`overageDisabledReason: "org_level_disabled"`). So the page must read `usage.speed` from the result, not `init`. On Ultra, fast mode needs usage credits switched on in the account's settings.

### Permissions: limited as intended, with one security finding

`spike/e2e/permissions.mjs` runs each probe in a fresh session, Sonnet at low effort, and answers prompts by clicking on the page. The settings (`spike/settings.json`) allow `Edit(src/**/*.tsx)`, `Edit(the project's token stylesheet)` and `Edit(the project's stories folder)`, plus the design tool `mcp__spike__get_selection`. They deny `Bash(git push)` and `Bash(git push *)`. A `PreToolUse` path guard (`spike/hooks/path-guard.mjs`) covers `Edit|Write|MultiEdit|NotebookEdit`.

| Probe                                       | Outcome                                    | What decided it                                                         |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Edit the fixture                            | done, no prompt                            | `Edit(src/**/*.tsx)`                                                    |
| `Write` a new `*.tsx`        | done, no prompt                            | `Edit(...)` rules also cover `Write`                                    |
| `Write` `server/probe.tsx`         | refused, file absent                       | the path guard; `Edit(src/**/*.tsx)` alone would have allowed it        |
| Edit `package.json`                         | refused before any prompt                  | the path guard                                                          |
| `git push --dry-run origin HEAD`            | refused: "Permission to use Bash … denied" | the deny rule                                                           |
| `git clean -f spike/none`              | refused                                    | the repo's `guard-bash.py`                                              |
| `node -e …` (no rule)                       | prompt reached the page; Allow; it ran     | `--permission-prompt-tool mcp__spike__approve`                           |
| `node -e …` (no rule)                       | prompt reached the page; Deny              | the same; Claude got "The designer said no."                            |
| `get_selection` before it had an allow rule | prompt reached the page                    | Manual mode prompts for MCP tools too, so each design tool needs a rule |

- **What the prompt tool receives:** `{tool_name, input, tool_use_id}`.
- **What it must return.** A text content block holding JSON. The CLI's own error for anything else gives the contract: "Expected {behavior: 'allow', updatedInput?: object} or {behavior: 'deny', message: string}". Checked with `prompt-replies.mjs`:
  - `{behavior: "allow"}` without `updatedInput` works.
  - `{behavior: "deny"}` without a `message` is invalid, and so is `{ok: true}`. Both are refused, and the call is denied.
- **Security finding: a changed `updatedInput` skips every check.** The page answered a `node -e` prompt with `allow` and an `updatedInput` whose command had been changed:

  - to `git clean -f spike/none`: it ran, and the bash guard didn't run again;
  - to `git push --dry-run origin HEAD`: it ran, and the deny rule didn't apply. Its output was the dry run's `* [new branch]`. `git ls-remote` confirmed that nothing reached the remote.

  So `approve` now ignores whatever the page sends except allow or deny. It always answers with the original input, and it adds a message to a deny. Re-run after the fix, both rewrites ran the original command (`prompt-rewrites-after-fix.json`). TRU-5.2 must keep this rule: the page may never edit a tool call through the prompt tool.

- **The project's own allow rules opened a way around the UI-only limit** (found by the task review). In a trusted workspace, `.claude/settings.json` lets `pnpm test *`, `pnpm lint *`, `pnpm exec jest *`, `pnpm exec eslint *`, `pnpm build`, `git switch *` and others run without a prompt. Claude may edit any UI component, tests import those components, so `pnpm test` runs code Claude wrote; `eslint --fix` writes files outside the UI paths. Truing's settings now add `ask` rules for those commands, which take precedence over allow rules. Run 52: `pnpm exec jest --version` reached the page as a prompt and was denied there.
- **Claude's shell could see the bridge token** (found by the task review). The bridge passed `T211_BRIDGE_TOKEN` in Claude's own environment, so any Bash command could call `/answer` and approve its own prompts. It now reaches the MCP server only through `--mcp-config`. Run 53: `printenv T211_BRIDGE_TOKEN` printed nothing and exited 1. The plugin-only packaging still needs it in the environment, which is one more reason not to use it.
- **The path guard was hardened** (found by the task review). It resolved paths as text, matched case-sensitively, and let an edit through if it crashed. It now resolves symlinks through the deepest existing directory, matches the forbidden paths case-insensitively, refuses test files (`*.test.tsx`, `*.spec.tsx`, `__tests__/`, `e2e/`; the product spec forbids tests), and blocks on any error. `spike/hooks/path-guard.test.sh` checks 17 cases, including a symlink from the project's components folder into `server`, `Server/`, `..` and malformed input: all pass.
- **`bypassPermissions` is never used.** The bridge always passes `--permission-mode manual`, because the maintainer's user settings set `defaultMode: auto`, which a child would otherwise pick up. (The user layer is also left out.)

### Packaging: plugin for the skill and the guard, our own config for the MCP server

`spike/e2e/packaging.mjs` makes the same checks three ways: the stub skill answers ("HERON"), `get_selection` returns the selection, the guard refuses server code, and a prompt reaches the page.

| Packaging                                                                   | Skill | MCP servers that connected                             | Guard | Prompt tool name                        |
| --------------------------------------------------------------------------- | ----- | ------------------------------------------------------ | ----- | --------------------------------------- |
| `--strict-mcp-config --mcp-config`, guard in `--settings`                   | n/a   | `spike` only                                            | works | `mcp__spike__approve`                    |
| `--plugin-dir` (server, guard and skill in the plugin)                      | works | the plugin's, **plus a person's own `exa` and `github`** | works | `mcp__plugin_spike-design_t211__approve` |
| `--plugin-dir` plus `--strict-mcp-config`                                   | works | **none**: strict mode drops the plugin's server too    | —     | —                                       |
| `--plugin-dir` for skill and guard, plus `--strict-mcp-config --mcp-config` | works | `spike` only                                            | works | `mcp__spike__approve`                    |

- **Simplest:** `--mcp-config` plus a hook in `--settings`. That is two files, with no plugin structure, but it can't carry a skill.
- **Recommended:** the last row. The plugin ships the design skill and the path guard as one folder, and our config is the only MCP server that connects. The plugin-only row also connected the MCP servers the maintainer configured for this project in the user-level Claude Code configuration (`source: local`); the repository has no `.mcp.json`.
- **Developers' own sessions are untouched.** Nothing is written to `.claude/`, `.mcp.json` or `~/.claude/`; `git status` stayed clean. A plain `claude -p` in the repository afterwards showed a person's own plugins and MCP servers, `permissionMode: auto`, and no `spike` anywhere in `init`.

### Option (b): the designer's own Claude Code calls Truing, and Truing can push into it

`spike/e2e/option-b.py` drives the real interactive `claude` through a pty, with a person's own settings, as a designer's terminal would.

- **Call.** With `--mcp-config` naming the same stdio server, Claude called `get_selection` 7 s after the prompt appeared. The bridge counted the call, and the answer (`spike-card.tsx:4:5`) was on screen 1 s later. The user's `auto` mode approved the MCP call. A designer in Manual mode would get Claude Code's own dialog.
- **Push: works, but only on the development flag.** The server declares `experimental: {"claude/channel": {}}` and forwards events from the bridge as `notifications/claude/channel`.
  - Started with `--dangerously-load-development-channels server:spike`, Claude Code asks for confirmation every time: "WARNING: Loading development channels … for local channel development only". Then it shows "Channels (experimental) messages from server:spike inject directly in this session".
  - A push from the bridge appeared as `← spike: TRU-1.2 staged change set ready…`, and Claude answered "OSPREY" as the event asked, 2.3 s after the push.
- **What a real rollout of the push needs:**

  - Claude Code ignores the development flag with `-p`.
  - Custom channels must come from a plugin on an allowlist (`allowedChannelPlugins`, in an internal marketplace).
  - On Team and Enterprise, an Owner must turn `channelsEnabled` on.
  - Channels are a research preview.

  Until then, option (b) can only answer when called, or be prompted by the designer.

- **Why a hand-written server.** The spike's MCP server is hand-written because the repo's `@modelcontextprotocol/server` 2.4.0 implements MCP revision 2026-07-28. The docs say Claude Code doesn't register a channel server that negotiates it. That claim wasn't tested with the SDK.

### Asking Anthropic: not asked; option (a) chosen

The maintainer decided not to send a written question (2026-10-31). The draft described an internal tool, so it no longer fits an open-source release: re-read the terms before a public release.
 2. Would it also be permitted if the tool used the Claude Agent SDK (`query()`) in-process on the same subscription login, instead of spawning the CLI?
> 3. Do headless runs started this way draw on each seat's normal Claude Code usage limits?

Status: **not asked; option (a) chosen** (2026-10-31). Option (a) and option (b) stay within the "unmodified binary, own subscription" case, so the question only gates option (c).

### Recommendation (for TRU-1.3's ADR and TRU-5.2)

**Option (a): the bridge spawns the unmodified `claude` CLI, one run per designer turn, resumed by session ID.** Keep option (b) for designers who prefer Claude Code's own window: it works for calls today, and pushes once channels can be enabled for an organisation. Don't use the Agent SDK on a subscription login unless Anthropic says yes in writing.

```
claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages
  --permission-mode manual                       # never bypassPermissions; overrides a user's defaultMode
  --setting-sources project,local                # leaves out the designer's settings.json (and any apiKeyHelper)
  --settings <per-run file>                      # Edit(...) allow-list, design-tool allows, deny git push,
                                                 #   ask for code-running commands, apiKeyHelper "",
                                                 #   the AGENTS.md pluginConfigs (until TRU-5.1), fastMode
  --plugin-dir <design plugin>                   # design skill + PreToolUse path guard
  --strict-mcp-config --mcp-config <design tools>
  --permission-prompt-tool mcp__<server>__approve
  --model <alias> --effort <level> --max-turns <n>
  [--resume <session_id>]
cwd: the repository
env: without ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN,
     CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SSE_PORT, CLAUDE_PERSONAL_HOOKS,
     and never the bridge's own token
stdin: one {"type":"user","message":{…text, image…}} line, then close
```

Rules the bridge must keep:

- **The prompt tool** answers allow with the original input, and deny with a message. It never forwards an edited input.
- **Every design tool** has its own allow rule, or each call prompts.
- **Commands that run project code** (tests, lint with fixes, build, Playwright, `git switch`) get `ask` rules, so the project's allow rules don't let them through without the designer.
- **The path guard fails closed,** resolves symlinks, and matches forbidden paths case-insensitively.
- **The bridge** answers only requests whose `Host` is its own loopback address (checked: a foreign or `localhost` Host gets 403). Its token reaches the MCP server through the MCP config, never Claude's environment. TRU-5.2 should also give the page and the MCP server separate tokens, so the server's can't answer prompts.
- **One run at a time per designer.** The spike's bridge refuses a second.
- **Model and effort:** always send a model, because the default becomes Opus 5.5 once the user layer is left out. Show the effort that was sent; nothing echoes it back. Leave out a thinking switch: `alwaysThinkingEnabled: false` didn't turn thinking off.
- **Fast mode:** show the speed from `result.usage.speed`.
- **Limits:** show what is left from each turn's `rate_limit_event`.
- **Errors:** map `error: "authentication_failed"` to "Run `claude` in a terminal and sign in with `/login`."

Known limits:

- **Seats.** The maintainer used Ultra (2026-10-31), the plan the spike ran on. Fast mode needs usage credits on the account.
- **Trust.** In an untrusted workspace, the project's own allow entries are ignored. Onboarding (TRU-13.1) runs `claude` in the repository once.
- **Startup cost.** Each turn starts a process and reloads the session. A one-line first turn was estimated at $0.08 on Opus (run 48; client-side estimate), most of it creating the prompt cache.
- **Unverified:** `rate_limit`, an expired login, and turn-level usage accounting.
- **Changing ground.** Headless details (`--permission-prompts`, Manual by default, the init fields) are new in 2.1.2xx–2.1.30x. The bridge should check `init.claude_code_version` and the `capabilities` array.

**What would change this:**

- written approval of the Agent SDK on subscription login;
- channels becoming generally available, or enabled for an organisation (which makes option (b) a full alternative);
- an official visual-editing feature in Claude Code.

### Left for a person to check

- **Decided by the maintainer on 2026-10-31:**
  - Anthropic: not asked; option (a) chosen.
  - A designer's personal `~/.claude/CLAUDE.md`, memory and rules keep applying in Truing.
  - AGENTS.md: carried in Truing's settings now; TRU-5.1 makes the repository load it for everyone.
  - The project's code-running allow rules: `ask` rules in Truing.
  - Merge back: only this write-up and the plan.
- "Run choices" closed without a working thinking switch; TRU-5.2 leaves it out.
- If they ever merged:
  - `spike-card.tsx` would ship as an unused component;
  - `spike/` would add files that Jest and ESLint don't expect.
- **Stale generated types.** The pre-commit typecheck first failed on `.next/dev/types/validator.ts`, left by TRU-1.1's dev server: it pointed at `spike routes` pages that don't exist on this branch. Deleting the generated `.next/dev/types/` fixed it. Expect the same on any branch switch after a dev server ran.
<!-- SECTION:FINAL_SUMMARY:END -->
