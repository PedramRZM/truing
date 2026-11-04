# Truing: the right-click panel, spacing at a glance, frames from pages, and AI takes side by side

Written on 2026-11-01, during TRU-2.3. Feeds TRU-2.4, TRU-2.5, TRU-14.1, TRU-14.2, TRU-14.4 and TRU-14.5.

## Questions

- What do Airship, Onlook, Cortex and the other tools show on a right-click over an element or a layer, beyond TRU-2.3's menu?
- How do they make the spacing between elements easy to see, beyond TRU-2.3's bands and Alt-hover?
- How do they put several pages of an app on the canvas as their own frames, and keep the board?
- Does any tool ask the AI for several implementations, show them side by side and let the designer choose one? How is each take served, and how does the model know it is exploring?

## Research placeholders

- `[code]` the local clones: airship (`packages/overlay/src/app.ts`, `picker.ts`, `popover-host.ts`, `box-model.ts`, `inspector/measure-overlay.ts`, `inspector/context-outlines.ts`, `canvas/frames.ts`, `packages/server/src/proxy.ts`), onlook (`apps/web/client/src/app/project/[id]/_components/`, `components/store/editor/frames/`, `branch/`, `packages/db/src/schema/`), cortex (`cortex-editor/src/browser/`), react-grab, locatorjs, nextjs-locator, code-inspector, ProjectVisBug, stagewise, frontman.
- `[web]` Figma Dev Mode measurements; Subframe "prompt to design" variations; Figma's agent "generate UI variations"; Cursor `/best-of-n`; Claude Code worktrees.
- `[docs]` `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (one `next dev` per folder).

## Findings

Two read-only sweeps by subagents on 2026-11-01. File references are into the local clones; Airship and Cortex are MIT, Onlook Apache-2.0, and we take ideas, not code.

### The right-click panel

- **Airship:** a plain five-row menu (Edit text, Duplicate, Delete, Zoom to selection, Copy selector, `app.ts:1093-1137`). Its key hints come from the command registry (`popover-host.ts:1052-1056`). It has no menu on layer rows. The clone holds no earlier "panel"; an older Airship swallowed right-click (`edit-guard.ts:84-88`).
- **Onlook:** one Radix menu on the frame and on the layers (`right-click-menu/index.tsx:131-160`), in three groups: code and AI (view instance or component code, open in IDE, Add to AI Chat, New AI Chat), Group and Ungroup, and the edits (Edit text, Copy, Paste, Cut, Duplicate, Delete). Each row shows its key. It also floats a chat bar with an "open code" button over every selection (`overlay/elements/buttons/chat.tsx:83-134`), which is likely the richer "panel" remembered.
- **react-grab:** a card with a `Component.tag` header that opens the file, then Copy (C), Comment (Enter, a prompt box at the element), Open (O) (`components/context-menu.tsx:315-361`).
- **LocatorJS, nextjs-locator, code-inspector:** a list of the element's ancestors, each linking to its source; nextjs-locator adds "Ask Claude" on each row (`lib/context-menu.ts:224-239`).
- **Cortex, Puck, stagewise, VisBug, Frontman:** no element menu. Puck puts Select parent, Duplicate and Delete in a bar on the selection.
- **None of them** lists the elements stacked under the pointer; Figma's "Select layer" submenu does. That is what TRU-2.3's hit-test fix (`probe.ts`, a picture over a real page) would have needed as a way out.

### Spacing at a glance

- **Airship:** Alt-hover shows the box model of whatever is under the pointer, with nothing picked, including hatched **gap bands between children**, measured from the boxes, so `space-between` counts (`box-model.ts:149-172`). It outlines the selection's parent, and siblings while their parent is hovered (`inspector/context-outlines.ts:1-27`). Distance lines draw a dashed elbow when boxes don't line up (`measure-overlay.ts:155-170`).
- **Onlook:** padding and margin bands with `auto`, Alt distance lines (`rect/click.tsx:106-230`, `measurement.tsx`); no gaps.
- **VisBug:** a Guides tool that needs no modifier: crosshairs off the hovered element, click-then-hover measures, Shift+click pins several, Esc clears (`features/guides.js:33-107`).
- **Figma Dev Mode:** with a layer selected, hovering others shows distances without Alt; Shift+M pins measurements.
- **No tool** shows the spacing token's name on the canvas; we can, from the token manifest (the project's spacing scale).

### Frames from pages

- **Airship:** frames are sizes of one route; each navigates on its own (the proxy keys on `Sec-Fetch-Dest: iframe`, `proxy.ts:156-159`); the board (id, name, preset, size, x, y) is in `localStorage` per shell path, not the route (`frames.ts:848-901`). At most 8 frames, "each is a full app instance" (`frames.ts:316-320`), and frames load only within 400 px of the view (`:818-845`).
- **Onlook:** a frame is a database row (url, x, y, width, height, branch, `schema/canvas/frame.ts:8-26`), made by duplicating or forking; its pages panel moves the active frame rather than adding one (`pages/index.ts:230-256`); every move is saved, debounced 1 s.
- **Us today:** one shared route that the other frames follow (`shell/store.ts`), nothing saved.

### AI takes side by side

- **Onlook** is the only tool that shows takes side by side: a branch forks the whole cloud sandbox with its own dev server and URL, and its frame goes to the right (`server/api/routers/project/branch.ts:89-230`). Agent tools take a `branchId`; the prompt only lists branch ids, and never says the work is exploratory. There is no picker: deleting a branch deletes its frames.
- **Airship:** "Branch" forks the Claude conversation for a second try, one at a time in the same tree.
- **Stagewise:** a git worktree per agent, with a setup hook that copies `.env` and installs; no canvas to compare.
- **Web:** Cursor `/best-of-n` runs one task on several models in worktrees, compared by reading code; Subframe makes 1–4 variations as real pages on its canvas and you delete the losers; Figma's agent compares parallel prompts on the canvas; Lovable and v0 fork one at a time. Claude Code's worktrees (`--worktree`, `.worktreeinclude`, subagents with `isolation: worktree`) give one branch per take.
- **One Next dev server can't serve several worktrees:** Next 16 locks a folder to one `next dev` (`version-16.md:918-922`). We hit it on 2026-11-01: `real-app.spec.ts` can't start its own server while another one runs ("Another next dev server is already running"). Each take needs its own worktree, server and port, unless the takes live in one tree behind a switch, which puts code in the app (against ADR 0001).

## Implications for Truing

- **TRU-2.4, the right-click panel:** a header (`Component · tag` and the call site), groups, Select parent, the ancestors, and a "Select layer" list of what is under the pointer. All read-only. "Ask Claude about this" joins it with TRU-5.2; the edit rows with TRU-4.1.
- **TRU-2.5, spacing at a glance:** gap bands between the pick's children; a Spacing toggle that shows it all without Alt; token names on the labels; the parent's outline; pinned measurements. All read-only.
- **TRU-14.1 then TRU-14.2, frames from pages:** a frame becomes a saved record (name, route, size, position, follow group) in a gitignored file, made from a page list (Next's `get_routes` over `/_next/mcp`), a link, a duplicate or a typed URL. Capped, and lazy off screen. The spike measures what 8 frames of `/main` cost.
- **TRU-14.4 then TRU-14.5, takes side by side:** a take is a worktree with its own dev server and port and its own Claude session, told it is prototyping; its frames are a group labelled "Take 2 of 3"; Keep this take merges it, Discard all removes the rest. The spike measures three dev servers on a designer Mac and the sign-in across ports. It touches TRU-4.1 (a change set per take), TRU-5.2 and TRU-12.1 (a take id on every tool), TRU-13.2 (only the winner reaches the PR), and argues against inline (TRU-16.12), which shows one app instance.
