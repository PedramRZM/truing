---
task: TRU-14.2
status: active
updated: 2026-11-07
---

# Frames as records, Claude's frame and app tools, and takes it can compare

A living plan: keep Progress, Surprises, Decision log and Outcomes current as you work.
Another session (possibly another harness or model) must be able to continue from this file alone.

## Purpose

Afterwards a person can:

- lay out a saved board of frames, each with its own route and size, select one, and have the top bar (route box, device menu, Side by side) act on that frame only;
- open any page of the app as a new frame (a new-tab link already does, TRU-14.6), from a link, a duplicate, a typed URL or a Pages list;
- ask Claude to set up frames, look at the app at every size, move through it, and, for a click or typed text, answer Claude's question first;
- ask Claude for several takes of a change, see them side by side, and get Claude's comparison and recommendation, then keep one.

Tasks, in the order below: TRU-14.1, TRU-14.2 (absorbs TRU-14.6), TRU-14.3, TRU-12.1 (the part the frame and app tools need), TRU-18.2, TRU-18.3, TRU-18.1, TRU-18.4, TRU-14.4, TRU-14.5, TRU-18.9.

## Context and orientation

- **Shell frames today** (`src/shell/store.ts`): `layout` is `'single' | 'side-by-side'`; `frameIds(layout)` gives `['main']` or the presets; every frame shows one global `route` and `viewport`, and frames follow the `leader` (`follow()`, `onLocation`). TRU-14.6 added frames opened from new tabs, derived as "any frame not the layout's own" (`openedIds`), which navigate on their own. Nothing about frames persists between runs (only panels, tabs and token density in `localStorage`, `src/shell/panels.ts`).
- **Top bar** (`src/shell/canvas-bar.tsx`): the route form calls `store.navigate`; the device menu calls `store.setViewport` (which drops side by side back to single); the Side by side toggle calls `store.setLayout`.
- **Server → shell** (`src/protocol.ts`, `toShellSchema`): `frame-back`, `reload-frames`, `open-frame`, `notice`. Only `src/away-window.ts` sends frame messages. A module's server part has no way to send them (`ServerContext`, `src/module.ts:893-926`).
- **Claude's tools** (`src/module.ts:94-97`, `src/module-host.ts:815-866`): modules can declare `claude.tools`, the host lists and runs them, but no module declares one and nothing calls `host.tools`. Claude reaches Truing through `src/claude/mcp-server.mjs` (stdio, only `approve`), which posts to the bridge in `src/modules/claude/bridge.ts` (only `/permission`). `src/claude/session.ts:384-428` writes the session's `mcp.json`. A tool result carries text only.
- **Screenshots** (`src/screenshots.ts`): `frame(id)` and `element(id, selector)` crop the shell's own screenshot, so only what is on screen can be captured.
- **Pages**: Next exposes `get_routes` over `/_next/mcp`; Truing already adds `next-devtools` to Claude's session for Next apps (`session.ts:208`).
- **Research**: `docs/research/menus-spacing-frames-takes.md` ("Frames from pages", "AI takes side by side"); Airship caps 8 frames and loads only those near the view.
- **ADRs**: 0001 (composed from our own parts, features as modules, an MCP server as a second way in), 0002 (no config), 0006 (full access keeps limits).

## Plan of work

Each milestone ends with `make check` green, its task's criteria checked with evidence, and a commit.

1. **M1 · TRU-14.1 spike.** On the real reported app and on `test/fixtures/`: memory and CPU of 1, 4 and 8 frames on a heavy and a light route, idle and during a hot reload; whether a far-off frame can be unloaded and come back; Next's `get_routes` output; what Claude finds on a non-Next project. Note in `docs/research/`, a frame cap and off-screen policy, and TRU-14.2's criteria updated.
2. **M2 · TRU-14.2 frames as records.** A frame record `{ id, name, route, viewport, x, y, group?, by: 'person' | 'claude' }`. The selected frame owns the top bar. Side by side turns the selected frame into a Phone/Tablet/Desktop group that follows one route. Open in new frame (context menu, Cmd/Ctrl-click in Select mode), duplicate, rename, delete with undo. The board is saved per project next to the profile (`~/.config/truing/projects/<key>.board.json`) and comes back on restart. Cap and off-screen policy from M1. Panels follow the active frame. TRU-14.6's opened frames become ordinary records.
3. **M3 · TRU-14.3 Pages.** A Pages section in the Design tab from M1's page source; dynamic routes ask for a value; open navigates the selected frame.
4. **M4 · TRU-12.1, the part the tools need.** The MCP server forwards `tools/list` and `tools/call` to new bridge endpoints that call `host.tools`; tool results can carry an image; a server context method to read and change the board (the same records the person edits, through the shell).
5. **M5 · TRU-18.2 and TRU-18.3.** A `frames` module with tools to list, open, move, resize, navigate and close frames, and to take a screenshot of any frame or element at any size, off screen included. Frames Claude opened are marked and closing them leaves a person's alone.
6. **M6 · TRU-18.1 and TRU-18.4.** An ADR recording the person's decision (below), then tools to scroll, hover, click and type in a frame by role and name. Looking is free; a click, typed text or a submit asks the person through the existing permission prompt, in every permission mode. Every action is listed; Stop ends a run; a run has a budget.
7. **M7 · TRU-14.4 spike.** Three worktrees with their own dev servers and ports on the real app: memory, cold start, installs, sessions across ports, three Claude sessions. A recommendation and a cap.
8. **M8 · TRU-14.5 takes.** Ask for N takes; each gets a worktree, branch, dev server and Claude session; each is a frame group "Take 2 of 3"; the prompt says it is prototyping; keep one or discard all.
9. **M9 · TRU-18.9 compare.** Every take at every size from the same route, the same checks on each (tokens, layout shifts, performance), and Claude's recommendation with reasons. The person chooses.

## Concrete steps

From `/home/pedrum/Dev/truing`:

- Gate: `make check` (expect exit 0).
- One test file: `pnpm exec vitest run test/unit/<file>.test.ts`.
- Real app: `pnpm dev <project folder>` opens Truing on it; nothing is configured.
- Browser evidence: a one-off script under `.scratch/` (git-ignored), as in `.scratch/new-tab-check.mts`; there is no browser suite (owner's choice).

## Validation and acceptance

Each milestone's task criteria, checked with a test name, a command and its output, or a look recorded in the task's notes. UI changes: `verify-ui` at 1280 and 1440 px, light and dark. Prompts and tool descriptions: the `ai-features` skill, and `pnpm check-claude` where it applies.

## Interfaces and dependencies

To exist at the end (names may change; update here when they do):

- `FrameRecord` and the board file schema (zod), shared by the shell, the server and Claude's tools.
- ToShell messages to set the board, and ServerContext `frames` methods (list, open, update, close).
- MCP: `tools/list` and `tools/call` forwarded through the bridge; image content in tool results.
- Tools in a `frames` module: `list_frames`, `open_frame`, `move_frame`, `resize_frame`, `navigate_frame`, `close_frame`, `screenshot`; in an app-actions module: `scroll`, `hover`, `click`, `type`.
- Takes: a take id on every tool, from M8.

## Progress

- [x] 2026-11-07 Scope, order and the person's decisions recorded (this file).
- [x] 2026-11-07 M1 TRU-14.1 spike: `docs/research/frame-cost-and-page-list.md`. Cap 12, keep frames loaded, page list from Next `get_routes` filtered; signed-in screens and non-Next projects not measured.
- [x] 2026-11-07 M2 TRU-14.2 frames as records: 6f81680, aaca591, 130d578, be3d9df, review fixes 3d6d61a. Page list moved to TRU-14.3.
- [ ] M3 TRU-14.3 Pages
- [x] 2026-11-07 M4 TRU-12.1 tool plumbing (MCP forwarding through the bridge, image results, `ctx.tools`): 45eb7ba, on branch TRU-12.1-claude-tools.
- [x] 2026-11-07 M5 TRU-18.2, TRU-18.3 frame tools: 866310e. Capture brings the frame into view on the canvas; pictures at most 1568 px.
- [x] 2026-11-07 M6 ADR 0007 (15d25ce) and app actions (edc7400): asks enforced at the bridge, 60-call turn budget. Not measured: TRU-18.1's real-app sorting and cost (need real Claude runs).
- [x] 2026-11-07 M7 TRU-14.4 spike: `docs/research/takes-worktrees-and-sessions.md`. Worktrees, cap 3, about 2.3 GB and a 45 s first compile per take, three Claude takes at once about $0.55 each. Environment files in a take need the owner's decision (ADR) before M8.
- [ ] M8 TRU-14.5 takes
- [ ] M9 TRU-18.9 compare

## Surprises and discoveries

- A module's `ctx.frames()` lists only frames running its own probe; a server-only module needs `ctx.canvas.loaded()` (TRU-18.2).
- The module loader's spec schema strips unknown tool fields, so a new tool field (`asks`) must be added there too (TRU-18.4).
- After a failed commit, what was staged stays staged: commit with explicit paths (`git commit -- <paths>`) so unrelated work isn't swept in.

- Frames of one app share one renderer process: after the first (170 to 216 MB) each costs 30 to 60 MB, and idle CPU stays near zero (TRU-14.1).
- `get_routes` mixes route handlers and files in with the pages; a page list must filter them (TRU-14.1).

- TRU-14.6 found that a page opened in a tab loads once before Truing closes the tab, so the app sees it twice.
- Two existing tests build partial shell states with a cast; a new required state field breaks them. Derive new frame data from `frames` where possible, or update the fixtures only with the owner's say.

## Decision log

- The top bar acts on the selected frame; Side by side turns the selected frame into a Phone/Tablet/Desktop group. The person's choice · 2026-11-07.
- Claude may look without asking (frames, navigate, scroll, hover, screenshots); clicking, typing and submitting ask the person every time. The person's choice · 2026-11-07. To be recorded as an ADR in M6.
- M2 model: `FrameState` gains optional `viewport`, `group`, `name` and `by`; the layout's own frames (main, or Phone/Tablet/Desktop) stay one implicit group that works as today, and every other frame is a record. The top bar acts on the selected record frame's group, or on the layout when none is selected. Optional fields keep existing partial-state test fixtures valid, so no existing test changes · 2026-11-07.
- The board is saved per project, outside the repository, next to the profile. The person's choice · 2026-11-07.
- The takes spike may run on the reported app for real: worktrees outside its folder (removed after), installs, two or three dev servers, and real `claude` sessions on the person's plan. The person's choice · 2026-11-07.
- Prototyping and comparing are in scope: the takes spike, takes side by side, and Claude's comparison with a recommendation. The person's request · 2026-11-07.

## Outcomes and retrospective

(Written at each milestone.)
