# Architecture

| Document                                     | What it is                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| [golden-principles.md](golden-principles.md) | Rules every change must respect, each with its enforcement and fix hint |

## The system in brief

Truing is one Node process and one Chromium window, on the person's computer.

| Part     | Where           | Does                                                                                      |
| -------- | --------------- | ----------------------------------------------------------------------------------------- |
| Server   | `src/server.ts` | Serves the shell and speaks to it over a WebSocket, on loopback                           |
| Shell    | `src/shell/`    | Truing's own interface, around frames of the person's app                                 |
| Modules  | `src/modules/`  | Every feature, in up to four parts: declaration, probe, panel, server (`docs/modules.md`) |
| Edits    | `src/edits/`    | Turns a change into a source edit                                                         |
| Claude   | `src/claude/`   | Drives the person's own `claude` binary, within what the path guard allows                |
| Tokens   | `src/tokens/`   | Reads the project's design tokens                                                         |
| Adapters | `src/adapters/` | What depends on how the app is built, such as source maps                                 |

## To add here as they settle

- A dependency map: which parts may import which, kept current when a change moves a boundary.
- A feature map per module: its invariants and blast radius (what else breaks if it changes), checked so it can't silently rot.
- How data moves when a change is made: from a control, through staging and preview, to an edit in source.

Decisions live in [`../decisions/`](../decisions/), not here.
