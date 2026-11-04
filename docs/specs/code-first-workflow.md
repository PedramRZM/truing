# Code-first workflow: developers build first, people refine the real UI in Truing

- Status: draft. The base, the Claude bridge and the element-to-source mechanism are settled by the spikes TRU-1.1, TRU-1.2 and TRU-1.3. It becomes an ADR after the pilot (TRU-13.3).
- Date: 2026-10-31
- Related: epic TRU-20, [product spec](product.md), [ADR 0001](../adr/0001-compose-our-own-injected-browser-modules.md). Research: [README](../research/README.md).

## 1. Problem

Design usually runs design-tool-first. A designer draws, a developer translates, and the two drift.

Coding agents have changed the cost on the developer's side: a developer now ships a complete feature to a branch in hours. The slow part is everything after that. Each spacing, colour, copy or responsive correction becomes a comment, a ticket, a wait and a re-check. A designer can see the real product but can't touch it.

So flip the order:

- the developer builds the whole feature first;
- someone then refines the **real** UI, visually and without writing code, on their own machine;
- they hand the result back as a reviewable change.

The model is Figma Make, as other teams now work ("code-first design"). Unlike Make, it has to work over the **real** repository, components and tokens, and on **each person's own Claude subscription**.

## 2. Proposal

1. **The workflow:**
   1. A developer finishes `feat/x`.
   2. Someone runs one command to get `feat/x` running locally.
   3. They refine it in Truing. Changes are committed to a hand-back branch and opened as a PR **into `feat/x`**.
   4. The developer reviews and merges.
2. **Truing.** A local-only, Figma Make–style editor around the running app.
   - **Inspect:** select anything to see its component, variant, both source locations (call site and definition), and every style as a token; see every instance of a component; see off-token values flagged.
   - **Edit:** token-aware panels; create tokens; drag to reorder; edit text inline; Phone, Tablet and Desktop side by side.
   - **Claude:** ask Claude inline, by annotation or by drawing.
   - **Applying:** every change is staged once and applied by the right path (section 4).
3. **Tokens live in code first.** The project's token source is the source of truth. People create and change tokens through reviewed PRs, and any Figma file follows from an export.
4. **Claude runs on each person's own plan, through their own unmodified Claude Code,** with the repository's own configuration: AGENTS.md, the `.claude/` skills, rules and hooks, the same as a developer's session. People can teach Claude design rules and skills by conversation, and those changes are reviewed in the PR like any other.
5. **Zero config.** All of this works in a project Truing has never seen. A project's specifics come from a saved profile, which Claude fills by reading the folder. When Claude can't tell, Truing asks in the UI.

## 3. The workflow in detail

| Step      | Who                          | What happens                                                                                                                     | Task                                                                                                                                                 |
| --------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build     | Developer (with Claude Code) | `feat/x` is a complete, working feature using the project's components and tokens                                                | none                                                                                                                                                 |
| Set up    | The person refining          | `truing feat/x`: prerequisites, branch, install, start                                                                           | **TRU-13.1**, TRU-6                                                                                                                                  |
| Refine    | The person refining          | Truing: inspect, edit, tokens, Claude, viewports                                                                                 | **TRU-1.5, TRU-2.1, TRU-2.2, TRU-11.2, TRU-4.1, TRU-4.2, TRU-11.5, TRU-16.9, TRU-4.3, TRU-5.2, TRU-12.1 and TRU-17.1, TRU-15.1, TRU-12.2, TRU-17.2** |
| Hand back | Truing                       | a commit per Apply on the hand-back branch; Send opens a PR into `feat/x` with changes, new tokens, rule changes and screenshots | **TRU-13.2**                                                                                                                                         |
| Review    | Developer                    | reviews the PR like any other; CI runs                                                                                           | none                                                                                                                                                 |
| Ship      | Developer                    | `feat/x` merges as usual                                                                                                         | none                                                                                                                                                 |

**For developers:** build with tokens and components from the start, since these tools are only as good as the code's use of them. Expect PRs into your feature branch, and review rule changes in them as well as code.

**For designers:** one command per feature. No git, and no terminal beyond that command.

## 4. Two paths for every change

Every change is staged once and applied by one of two paths, chosen per change and shown before Apply.

| Path       | Applied by                     | What it covers                                                                                                                                                                                                                             |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Direct** | Truing, with no model call     | token swaps on static class strings (including in `cn()` and `cva()`); breakpoint-prefixed classes on static strings; JSX text; a variant prop; static sibling reorder; creating a token                                                   |
| **Claude** | Claude Code, in the same Apply | responsive restructuring (stack this on Phone, table to cards, hide below Tablet, move on one size only); classes or text built at runtime; elements from `.map()`; new variants or props; changes across components; anything handed over |

Figma Make sends every change through its agent: 8 credits and several seconds for one radius change ([teardown](../research/figma-make-teardown.md)). Airship does the same. Cortex already splits the two paths this way.

**Direct edits** are exact source edits. A parser finds the node at the selected location, a MagicString splice changes only the target characters, the project's class-merge config merges classes, and Prettier formats. Before any write, the file's hash is checked against what the overlay saw ([research](../research/element-to-source-react19.md)).

**Claude changes** travel as one structured request. It carries each element's source locations, component and variant; the intended values per viewport, with tokens; and cropped screenshots of each affected frame.

Claude's result is checked at Phone, Tablet and Desktop and shown as a diff. The person can undo Claude's part without losing the direct edits made in the same Apply (TRU-12.2).

## 5. Architecture (ADR 0001)

```
Truing's own Chromium window (opened by `truing`)
┌──────────── Truing shell (dev only) ──────────────────────────────┐
│ chat · Changes tray · inspector · panels · layers · viewports     │
│ ┌─ frame(s): the app at Phone / Tablet / Desktop ───────────────┐ │
│ │ runtime injected by the window's init script, not by the app: │ │
│ │ selection, owner stacks                                       │ │
│ │ (bippy), instances, computed styles, live CSS-override preview│ │
│ └───────────────────────────────────────────────────────────────┘ │
└──────────────┬────────────────────────────────────────────────────┘
               │ WebSocket on 127.0.0.1 · origin check + session token
┌──────────────▼──────────── Truing server (dev only) ──────────────┐
│ project profile, read by Claude (TRU-6.4)                         │
│ source resolver (owner stacks + Next dev stack-frame endpoint)    │
│ token table (TRU-1.4) · direct edit engine (TRU-4.1)              │
│ token writer (TRU-11.5) · git: hand-back branch, PR (TRU-13.2)      │
│ Claude bridge (TRU-1.2/TRU-5.2) ─ design tools over MCP (TRU-12.1) │
└──────────────┬────────────────────────────────────────────────────┘
               │
   Claude Code on the person's own login, in the repo:
   AGENTS.md · .claude/skills · .claude/rules · hooks
   UI-only permissions
```

- **Shape** (ADR 0001). No proxy: TRU-1.3 measured Airship's proxy breaking Server Actions, streaming and the sign-in return. Nothing is added to the app. Every feature, the core ones included, is a module with up to four parts: probe, panel, server, Claude tools (TRU-1.6).
- **Element to source** (TRU-1.1). React 19 owner stacks, read through **bippy**, map exactly through Turbopack's source maps. One walk gives the primitive's JSX and the feature call site. Server Component frames resolve through Next's dev endpoint `/__nextjs_original-stack-frames`, using react-grab's adapter, under a contract test. The weak spots are the 10,000-element cap on captured stacks, Buttons written in server components, and `asChild`. The fallback is an HTML-only loader that stamps `data-*` attributes (TRU-10.1).
- **Instances** (TRU-2.2): group fibers by resolved type. Server Components are grouped by `_debugInfo` name and location.
- **cva variants** are parsed from source, because cva keeps its config private.
- **Tokens** (TRU-1.4): Tailwind's own `__unstable__loadDesignSystem` gives every token, inline alias and Tailwind default, each with origin and offsets. A PostCSS pass resolves `:root`/`.dark` chains. "Compiles" isn't "on token": `px-401` and `bg-red-50` compile. Other forms of tokens are read through Claude into the same table (TRU-8.3).
- **Off-token lint** (TRU-11.6): eslint-plugin-better-tailwindcss with patterns from the project's scale. It starts as a warning, with a ratchet.
- **Token writer** (TRU-11.5): PostCSS edits at the right block. A semantic alias is written in several places. Tailwind before 4.3.3 serves CSS one edit late under Turbopack.

## 6. Claude on the person's subscription (TRU-1.2 proves the recommendation)

**Requirements, whatever the bridge:**

- **Configuration.** The session runs in the repository with its project configuration loaded: AGENTS.md (through CLAUDE.md), `.claude/skills`, the project's Claude Code rules and the `.claude/settings.json` hooks. Their Claude must behave like a developer's.
- **Billing.** It runs on the person's own claude.ai login. The bridge never reads, stores or relays a credential; the terms forbid that. When a login exists, it removes `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `apiKeyHelper` from Claude's environment, because any of them silently takes priority over the subscription (TRU-19.1 covers people with no login). It never passes `--bare`, which ignores the login.
- **Permissions.** UI files only, from the profile, plus design-scoped configuration for TRU-17.2. A `PreToolUse` path guard backs the allow-list up. A headless run starts in Manual mode, so anything not pre-approved is denied or routed to Truing through `--permission-prompt-tool`.
- **One run at a time.** One active Claude run per person, serialised with the direct edits. Sessions in the same directory can collide on files.
- **Design tools.** Claude gets design tools over MCP (TRU-12.1): the selection, the token table, screenshots at a viewport, and the direct edit operations. It prefers tokens and exact edits to free-form rewriting.

**The subscription rule** (read on 2026-10-31; [research](../research/claude-subscription-bridge.md)):

- Anthropic's legal page says developers of "products or services … including those using the Agent SDK, should use API key authentication". It also says third-party developers may not "offer Claude.ai login into their own applications, or … route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users", and "may not collect, store, or intermediate Claude.ai credentials or session tokens".
- It does not prevent "an end user from signing in to the unmodified Claude Code binary with their own Claude subscription".
- Team and Enterprise seats fall under the Commercial Terms. Pro and Max fall under the Consumer Terms, which limit business use. Which applies is for each person to check.

So the options rank as follows:

| Option                                                                                                                                        | How                                    | Within the terms?                                    | Trade-off                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| a. **Spawn the unmodified `claude` CLI** headless (`-p`, stream-json in and out, `--resume`), from the bridge                                 | Truing drives Claude Code              | clearly: it _is_ Claude Code on the user's own login | parse its JSON stream; permissions through settings, hooks and `--allowedTools`        |
| b. **MCP the other way round.** The person runs Claude Code. Truing is an MCP server Claude calls; Apply hands the change set to that session | the person's Claude Code drives Truing | clearly                                              | the chat is in Claude Code, not Truing, unless notifications can push into the session |
| c. **Agent SDK `query()`** with the person's login                                                                                            | in-process; tools and hooks as code    | grey; don't rely on it                               | the richest API, the least certain terms                                               |

**Recommendation: (a).** The bridge spawns `claude -p --output-format stream-json --verbose --include-partial-messages --resume <session>`. It adds a per-session `--settings` file (the allow-list), `--strict-mcp-config --mcp-config` for the design tools, and `--permission-prompt-tool`. It runs in the repository.

Headless runs load the project's hooks, skills and rules, so the repo's configuration applies. The design tools and the design skill can ship as one local plugin (`--plugin-dir`), without touching a developer's sessions. Keep (b) for people who prefer Claude Code's own window.

**Teaching Claude** (TRU-17.2). A person's "from now on…" becomes a design rule (`.claude/rules/design-*.md`, attached to UI files), an update to the design skill, or a suggestion for a developer. It is shown in plain words, confirmed, and takes effect in Claude's next turn. It is reviewed in the PR's "Claude configuration" section.

## 7. Build or adopt (TRU-1.3)

The full survey is [oss-landscape.md](../research/oss-landscape.md).

- **No open-source tool covers the brief.** The closest are **Airship** (MIT: proxy, frames, inspector, staged changes, undo; it writes everything through the agent, and its source mapping fails on Turbopack) and **Cortex** (MIT: direct writes for simple edits and Claude through MCP, but it doesn't know a project's tokens or components, and has no viewports or git).
- **Onlook's open-source editor** is in maintenance mode and tied to hosted services. Its parser's edit operations are the best code to fork.
- **The closed tools** that meet the subscription rule are benchmarks, not bases.
- **Composing our own** reuses bippy and react-grab's server-frame adapter, Onlook's edit operations, puck's drop-position maths, VisBug's measurement and contrast code, tailwindcss-intellisense's colour and rewriting helpers, and eslint-plugin-better-tailwindcss. The genuinely new pieces are the token-aware direct writer, the change-set routing, and the glue.
- **TRU-1.3 decided** (2026-10-31; ADR 0001): compose our own.

## 8. Safety

- **Never in a build:** Truing is injected by its own browser, and a marker check proves its code doesn't reach a build.
- **Writes:** the write endpoint accepts only Truing (origin plus session token), and writes only inside allowed paths. An app can run behind a remote proxy, so "localhost" is not assumed safe.
- **Reading a project:** read-only tools, secrets denied, and every value checked against the folder. A person confirms the start command before anything runs.
- **Licences:** stagewise's app and Webstudio are AGPL, and some other tools carry restrictive terms. We take ideas only from those, or nothing. MIT and Apache code is vendored with attribution.
- **Hygiene the study warns against copying:** `--no-verify` commits (Airship, Onlook); `data-oid` written into source (Onlook); uploads of instruction files to a vendor (Frontman); default telemetry (react-grab, next-devtools-mcp).

## 9. Decisions taken

1. Changes go to a hand-back branch, with a PR into the feature branch. A developer reviews and CI runs before it lands.
2. Tokens live in code first, and Figma follows (TRU-19.3).
3. AI runs on each person's Claude plan through their own `claude`. Claude in Truing uses the repo's configuration, and people can add design rules and skills by conversation (TRU-17.2). Changes are applied directly where possible and through Claude where needed, responsive work especially (section 4).
4. Truing needs no config (TRU-6).

The rest is confirmed or revised after the pilot (TRU-13.3).

## 10. Alternatives considered

- **Stay design-tool-first, with a design-tool MCP.** It keeps the drift.
- **Use Figma Make itself.** It works on its own sandbox project, not the real repo. Its token support is page CSS variables, every visual edit costs credits, and its AI is Figma's.
- **Round-trip through Figma** (code-to-canvas, then design-to-code). Flat layers come back through an agent, which loses components and tokens.
- **Closed tools** (Tempo, midcode, Cursor, Builder.io, v0). Closed, Mac-only or billed through their own AI. Benchmarks only.
- **Claude Design.** It works on its own prototype, not the running app.
- **A component-only or mock-data tool.** Decided against: people refine whole pages and flows.

## 11. Migration plan

1. **Decide:** TRU-1.1, TRU-1.2 and TRU-1.3, with an ADR. Done.
2. **Foundations:** TRU-1.4 (token table), TRU-1.5 (shell), TRU-1.6 (modules), TRU-2.1 (inspect), TRU-4.1 (edits), TRU-5.2 (Claude). Done.
3. **Zero config:** TRU-6.
4. **Round trip:** see `docs/roadmap.md`.
5. **Pilot:** TRU-13.3, on a project Truing has never seen, measured against the product spec. This document then becomes an ADR.
