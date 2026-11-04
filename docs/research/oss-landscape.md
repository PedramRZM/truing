# Tools that let a designer edit a running React app and write the change to source (survey, 2026-10-31)

Feeds Truing. The question is whether something open source, or something we can fork, already does what the design team asked for. That means a Figma Make–style editor over **our** Next.js 16 repository, with tokens, same-component selection, drag and drop, viewports and inline AI, all running on each designer's Claude subscription. The live look at Figma Make itself is in `figma-make-teardown.md`. The code-level reading of the repositories named here is in (18 shallow clones, one note per repo).

## Questions

- Which tools edit an existing React/Next.js app visually and write the change back to its source files, rather than to their own JSON or CMS?
- Which work on Next 16 App Router with Turbopack, React 19 and Tailwind 4?
- Which can run their AI on the designer's own Claude subscription?
- What can we adopt, fork, or compose from parts, and under which licences?

## Research placeholders

- `[web]` GitHub, the npm registry and vendor docs for each tool in the tables below: licence, latest release, 2026 activity, how it attaches to an app, write-back mechanism, AI provider
- `[web]` search "open source Figma Make alternative", "visual editor existing Next.js codebase", "design mode coding agent", "Claude Code visual editor"
- `[web]` `code.claude.com/docs/en/legal-and-compliance` and `code.claude.com/docs/en/agent-sdk/overview` for subscription-login rules
- `[docs]` `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md` and `.../05-config/01-next-config-js/turbopack.md` (Babel and loaders under Turbopack); `.../allowedDevOrigins.md`
- `[github]` re-check activity on `0xnyn/airship`, `onlook-dev/onlook`, `zh-lx/code-inspector`, `aidenybai/react-grab`

## Findings

### The short answer

**No open-source tool covers the whole brief.** The candidates fall into three groups:

- **Closest open match: Airship** ([0xnyn/airship](https://github.com/0xnyn/airship), MIT, created 2026-08-10, 730 stars, CLI 0.3.1 on 2026-10-24).
  - A CLI reverse proxy that puts live desktop and phone frames over the dev server.
  - A Figma-style inspector, text editing, drag-to-move in a DOM tree, and controls bound to CSS custom properties, with explicit handling of Tailwind 4 `oklch()` and `@theme`.
  - Runs Claude through `@anthropic-ai/claude-agent-sdk` on the designer's login.
  - Two catches: **every change, even a padding nudge, is written by the model**, and its source mapping was written for Vite. Nothing shows it working on Turbopack or with Server Components.
- **Closed tools that already meet the AI rule:**
  - **Tempo** (desktop, macOS and Windows): style-panel edits write to source. Claude Code signs in with `claude /login`. Its `tempo-sdk` adds a dev-only loader that the vendor says is validated on Next 16 with Turbopack.
  - **midcode** (macOS, $119–$199 one-time): deterministic minimal-diff Tailwind edits per breakpoint, taken from `@theme`, with variant-by-state grids and up to 200 undo steps.
- **Onlook has split.**
  - The 27k-star open-source web editor is in maintenance mode: 6 commits in 2026, and the README points to a waitlist. It runs projects in CodeSandbox and calls models through OpenRouter.
  - Its theme manager reads `tailwind.config`, which in this repo deliberately holds no theme.
  - The new Onlook desktop app runs Claude Code on your plan but edits only through chat, and its source was not yet published.

### What decides fit on our stack

- **Babel no longer blocks Turbopack.** Next 16's Turbopack runs Babel when it finds a Babel config, and webpack loaders that return JS can be registered under `turbopack.rules`. The cost is compile time (bundled docs, `08-turbopack.md`, `turbopack.md`).
- **React 19 removed `fiber._debugSource`** ([facebook/react#28265](https://github.com/facebook/react/pull/28265)), which broke the older click-to-source tools. Two approaches work now:

  - Read `fiber._debugStack` and map it through source maps at runtime: bippy, React Grab, Airship.
  - Stamp `file:line:col` attributes at compile time with a dev-only loader: code-inspector-plugin, `tempo-sdk`, midcode.

  Compile-time attributes also cover Server Components, because the attribute is in the HTML the server renders.

- **Turbopack's dev source maps can be sectioned (index maps).** Next 16.2.9's own dev middleware resolves frames per section (`node_modules/next/dist/server/dev/middleware-turbopack.js`). `@jridgewell/trace-mapping` reads sectioned maps only through `AnyMap`, and [nextjs-locator](https://github.com/stkang9409/nextjs-locator) needed its own decoder. Runtime resolvers written for Vite's inline maps, Airship's included, must be tested here.
- **The real project's specifics:** a theme in `@theme` in its token stylesheet, a wrapped `next.config.js` whose `turbopack` block has no `rules`, and an app sometimes run from a remote workspace.

### The candidates

| Tool                               | Licence                                                                 | Status (2026-10-31)                          | How it attaches                                                                        | Writes back by                                                                                                  | AI on the Claude subscription?                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Airship                            | MIT                                                                     | Active, young, mostly one author             | Reverse proxy, nothing added to the repo                                               | The agent writes every change                                                                                   | Yes, Agent SDK with the `claude` login (see the policy point)                                                             |
| Onlook (open source)               | Apache-2.0                                                              | Maintenance mode                             | Web app + CodeSandbox sandbox; writes `data-oid` into every JSX element of your source | Babel transform: move, insert, remove, style, text, group                                                       | No (OpenRouter, Morph, Relace keys)                                                                                       |
| Onlook desktop                     | Free, source "coming"                                                   | Beta, Apple silicon only                     | Git worktree + your dev command                                                        | Claude Code, through chat only                                                                                  | Yes                                                                                                                       |
| stagewise                          | AGPL-3.0 (app), MIT (agent packages)                                    | Very active; an agentic IDE since 2026-05-08 | Desktop IDE with built-in Chromium                                                     | Its own agent                                                                                                   | No (API keys, local models)                                                                                               |
| code-inspector-plugin              | MIT                                                                     | Active, 2.0.9 (2026-09-12)                   | Bundler plugin; `turbopack.rules` for Next ≥ 15.3; injects `data-insp-path`            | Agent (AI panel since 2.0.0)                                                                                    | Yes: `claude` CLI, Agent SDK, or a terminal. **Its Agent SDK mode defaults to `bypassPermissions`; don't use that mode.** |
| React Grab                         | MIT                                                                     | 0.2.0 (2026-08-16)                           | Dev-only script in the root layout                                                     | None: copies element, component stack and `file:line` for an agent; `react-grab/primitives` for your own picker | Through `@react-grab/mcp`; its Claude Code bridge was deprecated on 2026-03-24                                            |
| Agentation                         | PolyForm Shield 1.0.0 (source-available; free for internal company use) | 3.1.2 (2026-09-22)                           | `<Agentation />` toolbar + local MCP server                                            | Agent reads notes over MCP (9 tools)                                                                            | Yes, any agent over MCP                                                                                                   |
| Frontman                           | Apache-2.0 client, AGPL-3.0 server                                      | Active                                       | `npx @frontman-ai/nextjs install` adds `proxy.ts`; UI at `/frontman`                   | Its own Elixir agent server                                                                                     | Bring your own key; its "Claude Pro/Max" option needs checking against the policy point                                   |
| Cortex                             | MIT                                                                     | 0 stars, last push 2026-08-28                | Targets Next 16 App Router on Turbopack                                                | Claude over MCP                                                                                                 | Unclear                                                                                                                   |
| Tempo                              | Closed; free tier                                                       | Very active                                  | Desktop app + `tempo-sdk` loader (`TEMPO=true` only)                                   | Style panel writes source; chats run in worktrees                                                               | Yes, `claude /login`                                                                                                      |
| midcode                            | Closed; one-time licence                                                | Active                                       | Mac app starts `next dev` with an in-memory loader that adds `data-mc`                 | **Deterministic**: parse, verify, replace only the changed characters                                           | Your own Claude Code alongside                                                                                            |
| Cursor visual editor / Design Mode | Cursor plan                                                             | Active                                       | Cursor's browser                                                                       | Cursor agent                                                                                                    | No                                                                                                                        |
| Builder.io Projects (Fusion)       | Credits or API key                                                      | Active                                       | Proxies localhost into Builder's hosted editor                                         | "The AI implements those changes"                                                                               | No                                                                                                                        |
| v0 Design Mode                     | v0 credits                                                              | Active                                       | Hosted sandbox                                                                         | A model writes a new version                                                                                    | No                                                                                                                        |
| Figma code to canvas               | Figma seat                                                              | Since 2026-02-17                             | Claude Code calls `generate_figma_design` on Figma's remote MCP                        | Flat Figma layers; back to code via an agent                                                                    | Claude Code on our plan + a Figma seat. Figma says it doesn't count against standard MCP rate limits                      |
| Claude Design                      | Claude Pro, Max, Team, Enterprise                                       | Research preview since 2026-04-17            | Hosted canvas; reads the codebase to infer the design system                           | Handoff bundle for Claude Code                                                                                  | Yes, but it works on its own prototype, not our running app                                                               |

Out because they keep designs in their own model rather than editing our JSX: Puck (JSON), Craft.js (dormant since 2025-02), GrapesJS, Webstudio (AGPL), Plasmic. Dead or archived: Codux (discontinued), VisBug (archived). Young 2026 projects, none mature: Surface (npm licence CC-BY-NC-4.0), design-loop, Retune, eregion, Muse, OpenMagic, agent-devtools, designmode.dev.

### The policy point: Claude subscription login

Anthropic's Claude Code legal page treats subscription login as meant for "ordinary use of Claude Code and other native Anthropic applications". Products built on the Agent SDK are told to use API keys, and third-party developers may not offer claude.ai login. A user signing in to the unmodified `claude` binary with their own subscription is allowed ([legal and compliance](https://code.claude.com/docs/en/legal-and-compliance), [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), read 2026-10-31). The two designs that are clearly inside the rules are:

1. spawn the unmodified `claude` CLI (`claude -p --output-format stream-json`) on each designer's machine, or
2. make Truing an MCP server that the designer's own Claude Code session calls.

Driving the Agent SDK with a designer's subscription login (Airship's default) is a grey zone for an internal, unpublished tool. Ask Anthropic before relying on it. `claude-subscription-bridge.md` covers this in detail.

### Composing our own: the parts that exist

| Concern                                               | Reuse                                                                                                                                                                            | Licence                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Element → `file:line:col`, Server Components included | code-inspector-plugin's loader, or a small loader in the style of `tempo-sdk` / midcode                                                                                          | MIT                    |
| Component and owner tree, instances                   | bippy, `element-source`                                                                                                                                                          | MIT                    |
| Overlay                                               | `react-grab/primitives`, or Airship's overlay (inspector, cascade, oklch token matching, frames)                                                                                 | MIT                    |
| Deterministic writes                                  | `@babel/parser` to locate the JSX; `magic-string` for minimal diffs (midcode's approach); `recast` for structural moves; Onlook's `packages/parser/src/code-edit` as a reference | MIT; Onlook Apache-2.0 |
| Class conflicts                                       | `tailwind-merge` configured with our spacing and text scales                                                                                                                     | MIT                    |
| Token catalogue                                       | `postcss` over `@theme`; `@tailwindcss/node` to compile and check classes                                                                                                        | MIT                    |
| Props and cva variants                                | `ts-morph` or `react-docgen-typescript`; parse `cva()` with `@babel/parser`                                                                                                      | MIT                    |
| Drag                                                  | `@dnd-kit/react`                                                                                                                                                                 | MIT                    |
| Viewports                                             | iframes at 1440, 768 and 390 px (Next 16 blocks cross-origin dev requests from hosts not in `allowedDevOrigins`)                                                                 | —                      |
| AI                                                    | the unmodified `claude` CLI per designer, or an MCP server the designer's Claude Code calls                                                                                      | —                      |
| History                                               | a commit per Apply on the design branch; in-memory snapshots for undo                                                                                                            | —                      |

The only genuinely new piece is **a deterministic className writer that respects our token scale and cva variants**, plus the glue between overlay and writer.

## Recommendation

**Prototype in this order and let the spikes decide (TRU-1.3):**

1. **Airship against a real app, unmodified.** It is MIT, needs no repo changes, and already has frames, inspector, text, drag and inline Claude.
   - **Test:** on 10 elements across server and client components, compare its `file:line` with the truth. Then apply five edits and read the diffs and timings: `px-400` → `px-500`, a `text-title-m` swap, a reorder, a copy change, `variant="tonal-neutral"`.
   - **If attribution fails on Turbopack:** fork it, feeding it compile-time attributes from code-inspector's approach.
   - **Either way:** put deterministic writers in front of the agent and swap its Agent SDK bridge for the CLI.
2. **code-inspector-plugin as the cheapest baseline.** One `turbopack.rules` entry gives exact locations for every element, plus point-and-prompt through the unmodified `claude` CLI. It shows how far "precise location + Claude Code" gets before anyone builds a panel.
3. Optionally, try **Tempo** and **midcode** for half a day each as benchmarks of the finished experience. Both are closed, so neither is a base.

**The trade-off we accept:** composing (or forking Airship) means owning a dev tool, but no closed product works on Linux, keeps every change deterministic and reviewable in git, and stays inside the subscription rule.

**What would change this:** Airship working on Turbopack out of the box, with an extension point for deterministic writers, would turn "fork" into "adopt". Onlook publishing its desktop app under an open licence with direct styling would put it back on the list. Anthropic confirming that Agent SDK + subscription login is fine for internal tools would simplify the bridge.

## Couldn't verify

- Airship's mapping on Turbopack and Server Components; whether it edits props or per-breakpoint styles.
- Tempo: whether canvas edits are AST transforms or model calls, per-breakpoint editing, cva handling.
- midcode: cva fidelity and behaviour with our custom spacing scale.
- Onlook desktop: release date and licence.
- code-inspector's AI panel under Turbopack specifically.
- Cortex's README was seen only through a search index before cloning; Frontman's Claude Pro/Max option. Both are covered in their repo notes.
- Anthropic's pages don't cover our exact case: an internal tool, staff on their own seats, through the Agent SDK.

## Sources

Read on 2026-10-31 by a survey agent (primary sources only; no tool was installed or run), and spot-checked through the clones in the package.

- Next.js 16.2.9 bundled docs: Turbopack, `turbopack` config, `allowedDevOrigins`; and `node_modules/next/dist/server/dev/middleware-turbopack.js`. Official, for the installed version.
- React PR #28265 (removal of `_debugSource`), `https://github.com/facebook/react/pull/28265`. Primary.
- Anthropic, Claude Code legal and compliance, `https://code.claude.com/docs/en/legal-and-compliance`; Agent SDK overview, `https://code.claude.com/docs/en/agent-sdk/overview`. Official.
- Airship, `https://github.com/0xnyn/airship` and `https://www.npmjs.com/package/@airshiplabs/cli`. Primary.
- Onlook, `https://github.com/onlook-dev/onlook` (commits, releases, `packages/parser`, `packages/code-provider`), `https://docs.onlook.com/developers/architecture`. Primary.
- stagewise, `https://github.com/stagewise-io/stagewise`, `https://stagewise.io/news/becoming-the-open-source-agentic-ide`. Primary.
- code-inspector, `https://github.com/zh-lx/code-inspector`, `https://inspector.fe-dev.cn/en/more/changelog.html`, `https://inspector.fe-dev.cn/guide/feature/ai.html`. Primary.
- React Grab, `https://github.com/aidenybai/react-grab`, `https://www.npmjs.com/package/@react-grab/mcp`; bippy `packages/bippy/src/source/get-source.ts`. Primary.
- Agentation, `https://github.com/benjitaylor/agentation`, `https://agentation.com/mcp`. Primary.
- Frontman, `https://github.com/frontman-ai/frontman`. Primary.
- Tempo, `https://docs.tempo.new/product/canvas`, `/guides/quick-start`, `/changelog`, `https://www.npmjs.com/package/tempo-sdk`. Vendor docs.
- midcode, `https://midcode.app/`, `/integrations/nextjs`, `/docs/start/how-it-works.md`. Vendor docs.
- Cursor, `https://cursor.com/blog/browser-visual-editor`, `/changelog/2-2`, `/changelog/3-0`. Vendor.
- Builder.io, `https://www.builder.io/c/docs/projects-local-repo`. Vendor.
- v0, `https://v0.app/docs/design-mode`. Vendor.
- Figma, `https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/`. Vendor.
- Anthropic, "Claude Design", `https://www.anthropic.com/news/claude-design-anthropic-labs`. Official announcement.
- Codux discontinuation, `https://www.codux.com/faq`. Vendor. VisBug archived, `https://github.com/GoogleChromeLabs/ProjectVisBug`. Primary.
- `@jridgewell/trace-mapping` sectioned maps, `https://github.com/jridgewell/trace-mapping#sectionedsourcemaps`; nextjs-locator, `https://github.com/stkang9409/nextjs-locator`. Primary.
