# Running Claude on each designer's own subscription from a local tool, within Anthropic's terms (2026-10-31)

Feeds Truing (TRU-1.2, TRU-5.2, TRU-12.1, TRU-12.2, TRU-17.2) and the code-first workflow spec §6. Truing's AI must run through each designer's own Claude seat and Claude Code, with no separate API key (2026-10-31). It must also use the repository's Claude Code configuration (AGENTS.md, `.claude/` skills, rules and hooks). This note records what Anthropic's documentation and terms allow, which mechanism fits, and the traps. Quotes were taken from the live pages on 2026-10-31 through a fetch tool that summarises long pages, so **re-check exact wording on the live pages before quoting this in a policy decision**.

## Questions

1. Which mechanisms run Claude on a subscription login from a local tool, and which are documented?
2. What do the terms say about subscription login in tools, and does that reach an internal tool that people run on their own seats?
3. Which plans work, and do headless runs share the seat's limits?
4. What does Claude Code offer a designer-facing tool: streaming, permissions, hooks, images, MCP, sessions, settings, plugins? Is there an official visual-editing feature?
5. What architecture follows, and what are the traps?

## Research placeholders

- `[web]` `code.claude.com/docs/en/`:
  - `legal-and-compliance`, `agent-sdk/overview`, `authentication`
  - `headless`, `cli-reference`, `permissions`, `permission-modes`, `settings`, `mcp`
  - `sessions`, `channels`, `desktop`, `chrome`, `vs-code`, `costs`, `sandboxing`, `tools-reference`
- `[web]` `anthropic.com/legal/consumer-terms`, `anthropic.com/legal/commercial-terms`; support articles 11145838 (Pro/Max) and 11845131 (Team/Enterprise)
- `[local]` on a test seat:
  - `/usage` before and after one `claude -p` run;
  - `env -u ANTHROPIC_API_KEY claude -p …` then `/status` (which login);
  - the `system/init` event of a `-p` run in this repo (skills, MCP servers, plugins listed)

## Findings

### 1. Mechanisms

| Mechanism                                                                                    | Subscription login?                                                                                                                                            | Status                                                                                                                                            |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`claude -p`** with `--output-format stream-json`, `--input-format stream-json`, `--resume` | Yes. A non-bare `-p` run uses the `/login` credential. `--bare` "never reads OAuth credentials or the system keychain"                                         | Documented; Anthropic's own examples call `claude -p` from scripts ([headless](https://code.claude.com/docs/en/headless.md))                      |
| **MCP server that the designer's Claude Code connects to**                                   | Yes. The designer's own Claude Code calls the model; our server only exposes tools                                                                             | Documented ([MCP](https://code.claude.com/docs/en/mcp.md)). Lowest exposure: our bridge never calls Claude or touches a credential                |
| `claude setup-token` / `CLAUDE_CODE_OAUTH_TOKEN`                                             | Yes; a one-year token "for CI pipelines, scripts"                                                                                                              | Documented for scripts, but storing it in our tool runs into the "may not … store" rule below                                                     |
| **Agent SDK** (`@anthropic-ai/claude-agent-sdk`)                                             | Not documented. The SDK pages say to set `ANTHROPIC_API_KEY`. The SDK bundles the same CLI, so a `/login` credential may work in practice, but no page says so | API-key route documented only                                                                                                                     |
| VS Code / JetBrains extensions, desktop app's Code tab                                       | Yes ("any paid Claude subscription … no API key is required")                                                                                                  | No API for another program to drive them                                                                                                          |
| ACP adapter (Zed)                                                                            | Zed: "authenticate with an API key or with Claude Code where supported"                                                                                        | Third-party; not evidence that Anthropic approved our pattern                                                                                     |
| **Channels**                                                                                 | Needs claude.ai or Console login; Team/Enterprise must enable it; the server must be named in `--channels`                                                     | Research preview; a possible later way to push events (an Apply) into a running session ([channels](https://code.claude.com/docs/en/channels.md)) |

### 2. What the terms say

From the Agent SDK overview ([link](https://code.claude.com/docs/en/agent-sdk/overview.md)):

> "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK."

From legal and compliance ([link](https://code.claude.com/docs/en/legal-and-compliance)):

> "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider."
>
> "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens."
>
> "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code."
>
> "Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential."
>
> "For questions about permitted authentication methods for your use case, please contact sales."

**Plan terms.** The legal page maps **Team and Enterprise to the Commercial Terms** and **Pro and Max to the Consumer Terms**. The Consumer Terms ([link](https://www.anthropic.com/legal/consumer-terms), as extracted) say:

> "You agree not to use our Services for any commercial or business purposes."

They also restrict automated or scripted access except via an API key "or where we otherwise explicitly permit it". The extract's introduction scopes that version to UK-resident consumers, so check which version covers each person.

**Does this reach a local tool on a person's own seat?** The text doesn't say.

- **For Truing:** the rules target developers who _offer_ a login or _route others'_ plan credentials. Our bridge does neither. Each designer signs in to the **unmodified binary** with their own seat, which the legal page names as allowed.
- **Against us:** there is no internal-use carve-out, "products or services" is undefined, and the only stated route for exceptions is "contact sales".

**Rules that keep us inside the text:**

- no claude.ai login screen of our own;
- never read `~/.claude/.credentials.json`;
- never copy a setup-token into the repo or tool configuration;
- never run one designer's login for anyone else;
- never modify the binary or its auth.

### 3. Plans and limits

|                | Pro                                       | Max                      | Team seat                                                                               | Enterprise                                                             |
| -------------- | ----------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Claude Code    | yes                                       | yes                      | yes, every seat (premium seats have more usage)                                         | yes                                                                    |
| Terms          | Consumer                                  | Consumer                 | **Commercial**                                                                          | **Commercial**                                                         |
| Usage          | 5-hour and weekly limits shared with chat | same windows, more usage | per-seat 5-hour and weekly allowance, shared with chat; admins can enable usage credits | new self-serve plans: usage-based at API rates; older plans seat-based |
| Admin controls | none                                      | none                     | server-managed settings, Remote Control and channels toggles, spend reports             | same, plus roles and a compliance API                                  |

- **Shared limits.** "These limits are shared across Claude and Claude Code, meaning all activity in both tools counts against the same limits." Headless runs are not mentioned separately. The legal page's "ordinary, individual usage of Claude Code and the Agent SDK" implies the same pool. Confirm with `/usage` on a test seat.
- **An API key silently wins.** If `ANTHROPIC_API_KEY` is set, Claude Code uses it, "resulting in API usage charges rather than using your subscription's included usage". In `-p` mode, "the key is always used when present".

### 4. What Claude Code gives a designer-facing tool

- **Streaming events.** `--output-format stream-json --verbose --include-partial-messages` emits newline-delimited JSON:

  - `system/init` (tools, MCP servers, plugins);
  - text deltas;
  - `api_retry` with an error category (`authentication_failed`, `rate_limit`, `billing_error`);
  - `permission_denied`;
  - a final `result` with a cost estimate and the session ID.

  `--input-format stream-json` exists, but the raw stdin shape is documented only through the SDK's message types, where image content blocks work.

- **Permissions.**
  - Since v2.1.302, a `-p` run with no mode set starts in **Manual**: calls needing approval are denied unless an allow rule, a hook or `--permission-prompt-tool` approves them.
  - Limit edits with `Edit(src/**)` (relative to the working directory). **`Write(...)` rules never match; use `Edit(...)`.** Edit rules don't cover files a script writes, which is what sandboxing is for.
  - A `PreToolUse` hook exiting with code 2 blocks a call before the permission rules run, and a hook's "allow" never overrides a deny.
  - `PermissionRequest` hooks can answer approvals in `-p`.
  - Auto mode approves edits anywhere in the working directory, so it doesn't fit.
- **The repository's configuration loads in `-p`.** Project hooks run without a trust prompt (unless `--bare`), so our `.claude/hooks` (bash guard, secrets guard, Prettier) apply. Project `.mcp.json` servers load without asking; `--strict-mcp-config` limits loading to the servers we pass.
- **Settings layers:** managed, then `--settings` (one session), then `.claude/settings.local.json`, `.claude/settings.json`, then `~/.claude/settings.json`. Array keys such as `permissions.allow` merge across layers.
- **Plugins.** `--plugin-dir` loads a local plugin, which can bundle **our MCP server, hooks and skills**. That is one tidy way to ship Truing's design tools (TRU-12.1) and design skill (TRU-5.2) without changing developers' sessions.
- **Images.** The Read tool returns PNG, JPEG, GIF and WebP as visual content. An MCP tool that returns an image shows it inline, and Claude also gets the saved file's path. Tool output over 10,000 tokens warns; the default cap is 25,000.
- **Sessions.** `--resume` takes an ID, a name or a transcript path; `--continue` and `--session-id` also exist. Transcripts are JSONL under `~/.claude/projects/`.
- **No official visual source editor.**

  - The desktop app's Browser pane can start a dev server, take screenshots, inspect the DOM and "select an element", but it doesn't say what is sent to Claude, and it uses a clean profile without our logins.
  - Claude in Chrome (`claude --chrome`) reads console and DOM, clicks and screenshots, using the browser's logins. It needs `/login`; an API key or setup-token turns it off.
  - Claude Design (Labs preview, 2026-04-17) hands a bundle to Claude Code one way.

  None of these edits source by element. The element → source mapping is ours to build (TRU-1.1).

### 5. Traps

- **Never `--bare`.** It ignores the subscription login.
- **Strip the auth variables.** Remove `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and any `apiKeyHelper` from the child's environment.
- **Process lifetime.** A `-p` run ends after its turn. Idle background work is stopped after 10 minutes by default. SIGTERM exits with code 143 and leaves the turn unfinished, so use SIGINT to end a turn cleanly.
- **Concurrency.** Each run is a subprocess (Anthropic's hosting guide starts at 1 GiB per agent), and all runs on a seat share its limits. Same-directory sessions "can conflict if editing the same files". So run **one active Claude run per designer**, and serialise it with the direct edits.
- **Cost guards.** `total_cost_usd` is a client-side estimate, and `--max-budget-usd` is "estimated spend on API calls", not a subscription guard. Use `--max-turns`, timeouts and a queue.
- **Auth expiry.** An expired login fails each request with "Login expired · Please run /login". Map `authentication_failed` to "run `claude` and `/login` on this machine".
- **Org policy.** Team and Enterprise admins can force the login org or method, or disable subscription access ("Your organization has disabled Claude subscription access"). Check with the admin before rollout.
- **Security.** Project `.mcp.json` servers and hooks load in `-p` without a trust prompt. Our bridge passes its own MCP config with `--strict-mcp-config`.

## Recommendation

**Spawn the unmodified `claude` CLI from the local bridge, one run per designer turn:**

```
claude -p --output-format stream-json --verbose --include-partial-messages
  --resume <session>
  --settings <run-settings.json>   # allow Edit(src/**/*.tsx), Edit(the project's token stylesheet), Edit(the project's stories folder), a few Bash commands
  --strict-mcp-config --mcp-config <design-tools-mcp.json>   # TRU-12.1 design tools; or ship them with --plugin-dir
  --permission-prompt-tool <tool>          # prompts answered in Truing (TRU-1.2 verifies the reply shape)
cwd = the repository, environment without ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / apiKeyHelper
```

- It loads AGENTS.md, the `.claude/` skills, rules and hooks, the same as a developer's session. That is what the maintainer asked for, and it is verified by reading the `system/init` event (TRU-1.2).
- Keep **"MCP the other way round"** as a second mode, for designers who prefer Claude Code's own window. Channels (research preview, Team/Enterprise toggle) could later let Apply push a change set into that session.
- **Seats.** Team and Enterprise seats fall under the Commercial Terms; Pro and Max fall under Consumer Terms with a no-business-use clause. Which applies is for each person using Truing to check.
- **Don't use the Agent SDK on a subscription login** unless Anthropic says in writing that it is allowed. This note was written when the tool was internal: re-read the terms for a public, open-source tool before a release.

**The trade-off we accept:** parsing the CLI's JSON stream instead of the SDK's typed API, and answering permission prompts through a prompt tool. In return we stay inside the documented "unmodified binary, own subscription" case.

**What would change this:**

- written approval of the Agent SDK on a subscription login (a richer API);
- channels becoming generally available (better MCP-the-other-way-round);
- an official Claude Code visual editing feature (adopt it).

## Not confirmed

1. Whether the Agent SDK on a subscription login is allowed for a tool like this. Only "contact sales" is documented.
2. Whether the SDK picks up a `/login` credential without an API key.
3. Whether `-p` runs share the seat's limits (implied, unconfirmed).
4. The raw stdin format for `--input-format stream-json`.
5. The reply shape a `--permission-prompt-tool` must return (the SDK's `canUseTool` shapes are documented).
6. A localhost HTTP MCP server example.
7. Which version of the Consumer Terms applies to whom.
8. The JetBrains extension docs.

## Sources

All read on 2026-10-31 (official Anthropic documentation and terms; long pages read through a summarising fetch, so verify exact wording):

- Claude Code docs: `https://code.claude.com/docs/en/headless.md`, `authentication.md`, `agent-sdk/overview.md`, `agent-sdk/quickstart.md`, `legal-and-compliance`, `mcp.md`, `channels.md`, `permissions.md`, `permission-modes.md`, `settings.md`, `sessions.md`, `sandboxing.md`, `tools-reference.md`, `costs.md`, `desktop.md`, `chrome.md`, `vs-code.md`, `remote-control.md`, `computer-use.md`, `agent-sdk/hosting.md`, `agent-sdk/typescript.md`, `agent-sdk/streaming-vs-single-mode.md`, `cli-reference.md`.
- Anthropic legal: `https://www.anthropic.com/legal/consumer-terms`, `https://www.anthropic.com/legal/commercial-terms`.
- Claude support: `https://support.claude.com/en/articles/11145838`, `https://support.claude.com/en/articles/11845131`; pricing `https://claude.com/pricing`.
- Anthropic, "Claude Design" announcement: `https://www.anthropic.com/news/claude-design-anthropic-labs`.
- Zed external agents: `https://zed.dev/docs/ai/external-agents`; claude-agent-acp repository.
