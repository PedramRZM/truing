# ADR 0001: Truing is composed from our own parts, injected by its own browser, with features as modules

- Status: accepted
- Date: 2026-10-31
- Spec: [../specs/product.md](../specs/product.md)
- Workflow: [../specs/code-first-workflow.md](../specs/code-first-workflow.md)
- Evidence: TRU-1.3 (Result), TRU-1.1, TRU-1.2

Note added when the project moved to this repository: names were updated, and the decision is unchanged. "Everything specific to a project lives in one config file" has since become a saved profile that Claude fills by reading the project, with `truing.config.ts` as an optional override (TRU-6).

## Context

We needed a local tool where people refine the real app ([product spec](../specs/product.md)). Three bases were on the table:

- forking Airship (MIT);
- building on Cortex (MIT);
- composing our own from the parts the code study found.

Adopting open source was not a goal in itself; the best option wins. Two more requirements came up during the spike:

- Features must plug in, starting with page performance monitoring and with handing performance findings to Claude.
- The tool should be easy to carry to another project, wherever that costs no quality.

TRU-1.3 ran all three against a real Next 16 app on `next dev --turbopack`:

- **Airship's proxy breaks the app.** Server Actions fail ("Invalid Server Actions request."), streamed pages arrive all at once after 3 s, and a sign-in returns the person to the bare app.
- **Neither base finds call sites:** 0 of 9 each. Cortex has no location at all for 7 of 10 elements, every `<Button>`. TRU-1.1's resolver is exact on 10 of 10 definitions and 9 of 9 call sites.
- **Neither base writes the project's edits directly.** Airship sends every edit to Claude, at 15–22 s each. Cortex's resolver maps a 16 px padding to `pl-4`, off the project's scale. A prototype writer that addresses nodes by TRU-1.1's positions matched Claude's diffs with no model, including a Phone-only stack.
- **Injecting the runtime from the tool's own browser works without touching the app.** An init script puts it into every frame. Every app check passed: HMR after idle, navigation, a Server Action, streaming, a sign-in redirect, the service worker. Elements resolved exactly on that app, and on a plain Next 16.4.3 app with nothing of ours installed.
- **Neither base can be extended cleanly.** Neither has a plugin seam or any performance feature, and each feature would mean editing files of 1.6–4.9k lines.

## Decision

We compose the tool, **Truing**, ourselves.

- **Where it lives.** Its own package, which imports nothing from the app it opens. What it needs to know about a project is the dev command and port, the primitives folder, the token stylesheet, the writable paths and the branch naming.
- **How it attaches.** No proxy, and nothing added to the app.
  - Truing opens its own Chromium window. It injects its runtime into every frame of the app through an init script: the selection, the owner-stack resolver and the overlays.
  - The runtime talks to Truing's local server over a token-protected loopback WebSocket. The token is handed over in the init script, never in page markup.
  - The server serves the shell, which frames the app at real viewport widths.
- **The bridge to Claude** is TRU-1.2's: the unmodified `claude` CLI spawned per turn on the person's own login. Its MCP server doubles as a second way in, for people who prefer their own Claude Code window.
- **Every feature is a module** with up to four parts: a runtime probe inside the frame; a panel section in the shell; server handlers and direct-edit operations; Claude tools plus a skill. The core features (inspect, tokens, edits, chat) are modules too. Performance is the first optional one.
- **Portability never costs quality.** Where the best choice for one stack ties Truing to it, the best choice wins, and the dependency goes behind an adapter. Today that means Next, React 19 owner stacks, Tailwind v4 and cva.

What we take:

| Part                                                                                          | Taken as                                        | Licence                     |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------- |
| bippy 0.7.3; react-grab's `next-server-frames.ts`                                             | dependency, pinned exactly; vendored file       | MIT                         |
| Onlook's `code-edit` operations and fixtures, readdressed by `file:line:col` with MagicString | fork of the logic, licence kept, changes marked | Apache-2.0                  |
| Cortex's `TailwindRewriter` (`cn()` arguments, ternaries) and its MCP loop's shape            | vendored file; idea                             | MIT                         |
| Airship's `frames.ts` and cascade engine                                                      | vendored files                                  | MIT                         |
| tailwindcss-intellisense's `util/rewriting/*` and `color.ts` (TRU-1.4)                        | vendored files                                  | MIT                         |
| puck's drop-position maths (TRU-16.9); VisBug's measurement and contrast code                 | vendored files                                  | MIT; Apache-2.0             |
| eslint-plugin-better-tailwindcss (TRU-11.6); `magic-string`; Playwright's Chromium            | dependencies                                    | MIT; Apache-2.0             |
| `web-vitals`, `react-scan` (the performance module); `chrome-devtools-mcp` for Claude         | dependencies; an MCP server                     | Apache-2.0, MIT, Apache-2.0 |

`THIRD_PARTY_NOTICES.md` lists every vendored file, with its source and licence.

## Alternatives

- **Fork Airship.** We would own about 100k lines of vanilla TS from one maintainer, behind a proxy that breaks three app flows. We would also have to replace its resolver, token layer, AI path and git flow, and add a direct writer. The parts worth keeping are vendored above.
- **Build on Cortex.** Its loop is right: MCP into the person's Claude Code, with direct class swaps. But it is dormant, with one maintainer. It doesn't see uppercase components or a project's tokens, it has no viewports, git or plugin seam, and it has to be installed into the app.
- **A dev-only import in the app** (`instrumentation-client`) instead of Truing's browser. It works too, and lets people use their everyday browser. But the app would carry a hook, a check would have to prove it never ships, and every new project would need the same change.

## Consequences

- **Good:**
  - Every flow measured in TRU-1.3 works with the app as it is.
  - The app ships none of Truing's code, by construction.
  - Clicks resolve exactly.
  - Most visual edits skip the model.
  - Licences of everything taken are MIT and Apache-2.0 only.
  - Features, performance first, plug in without touching the core.
- **Bad:**
  - We build and own the shell, the panels and the module contract.
  - People work in Truing's Chromium window, not their everyday browser. The resolver is Chromium-only anyway (TRU-1.1).
  - The runtime depends on React's internals and Next's dev endpoint. TRU-1.1's contract test must run on every Next or React upgrade.
  - The vendored files are ours to maintain.

## Follow-ups

- **TRU-1.5:** the package, Truing's browser and injection, the shell and frames, and the notices file.
- **TRU-1.6:** the module contract.
- **TRU-17.3:** the performance module. It starts by checking that react-scan's bippy 0.5 coexists with our pinned bippy 0.7.3.
- **TRU-17.4:** performance findings handed to Claude, with `chrome-devtools-mcp`.
