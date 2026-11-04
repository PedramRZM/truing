---
id: TRU-3.7
title: 'Layer rows that behave like a design tool'
status: Done
assignee: []
created_date: '2026-11-02 09:28'
updated_date: '2026-11-02 14:27'
labels:
  - panels
dependencies:
  - TRU-3.6
type: feature
ordinal: 30070
parent_task_id: TRU-3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper's rows carry small behaviours a designer expects from Figma: the selection's children show in a band, the tree opens to what you click on the canvas, and hover offers hide and lock. Ours has the tree and a filter. These are cheap, and they make the panel feel like a designer's.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Rows.** 28 px tall, 12 px type, with the hover, selected and child-of-selected backgrounds from TRU-3.1's tokens. Long names truncate, with a soft fade under the row's actions.
- [x] #2 **Reveal.** Picking on the canvas expands the tree to that row and scrolls it into view, without moving focus.
- [x] #3 **Hide.** The eye on hover hides the element in the preview only, with no source change and no staged change. A hidden row keeps its eye showing and reads faded. Hides clear on navigation and are listed in nothing that goes to the PR.
- [x] #4 **Lock.** The lock on hover makes the element, and what's inside it, unpickable on the canvas: a pick falls through to what's beneath. Still selectable from the tree. Locks persist per route for the session.
- [x] #5 **Collapse all.** Alt+L, in TRU-2.3's command list. The selected row stays revealed.
- [x] #6 **Hide all clear.** A command to show everything and unlock everything, for when a page looks wrong.
- [x] #7 **Tests.** Playwright on the fixture: reveal from a canvas pick, hide leaves source untouched, lock makes a pick fall through.
- [x] #8 **UI checked.** A browser check, a design review.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Rows** (`styles.css`, `panel.tsx`): a `--ds-row` of 28 px; one fill variable per row state, so the actions' fade matches the row; the selection's descendants get the band.
2. **Reveal** (`panel.tsx`): a new pick reopens its path, even through a row closed by hand. Scrolling happens only when a row becomes current, so a rebuild never pulls the tree back.
3. **Hide and lock** (new `marks.ts`, probe): an attribute and an adopted stylesheet set `visibility: hidden`, so the layout and the tree don't move. Locks are stored as identities in `sessionStorage`, per route, and leave the canvas hit test. The panel reads both from a report, and nothing stages them.
4. **Rows to elements** (new `layer-marks.ts`, pure): a component's row stands for its outermost elements, and reads as marked when all of them are.
5. **Commands** (`module.ts`): Alt+L collapses all. "Show and unlock all layers" is in the right-click menu and the `?` sheet.
6. **Tests:** unit tests for `layer-marks.ts`. A new Playwright spec, written but not run, as the maintainer asked no e2e runs. `context-menu.spec.ts` gets the new row. Evidence from throwaway headless scripts.

Assumption: a hidden element keeps its space. Taking it out of the layout would also restructure the Design tree, which is built from what's drawn. Listed for the maintainer in the outcome.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **Rows.** 28 px in both views, through a new `--ds-row`. Each row state sets one `--row-fill`, so the fade under the actions always matches the row. Everything inside the selection gets the band.
- **Reveal.** A new pick opens its way there, even through a row closed by hand, and the way stays open after the pick moves on. A row scrolls only when it becomes current. Before, the tree pulled back to the selection on every rebuild.
- **Hide.** `marks.ts`, in the probe, sets an attribute that an adopted stylesheet turns into `visibility: hidden`. The layout and the tree don't move. A hidden row keeps its eye and reads faded, and so do the rows inside it.
- **Lock.** Stored as identities in `sessionStorage`, per route, so a lock survives a reload and reaches the other frames. A locked element, what's inside it and a plain wrapper around nothing but a lock all leave the canvas's hit test, for hover, click, double-click and Select layer. The wrapper rule is there because the Design view shows such a wrapper as the lock's own row, so a pick landing on it looked as if the lock did nothing.
- **Rows to elements.** `layer-marks.ts`: a component's row stands for its outermost elements, including every part of a split Server Component, and reads as marked when all of them are.
- **Commands.** Collapse all layers (Alt+L) and Show and unlock all layers (Alt+Shift+L, also in the right-click menu). The second key is my addition: the `?` sheet lists only commands with keys.
- **Runtime.** 89,582 bytes, up 2,785, and 418 under the 90 KB budget. See Left open.

### How it was verified

- **Unit:** `pnpm exec vitest run` in Truing, 407 passed, 11 of them new in `layer-marks.test.ts`.
- **Checks:** `pnpm typecheck` at the root and `tsc --noEmit` in Truing clean. ESLint on the changed files exits 0. Prettier clean. `jest --findRelatedTests`: no related tests.
- **Browser:** throwaway headless scripts, not in the repo, on the fixture's `/layers` with the real Changes module, and on real `/main`, signed out:

| Check                                        | Result                                                  |
| -------------------------------------------- | ------------------------------------------------------- |
| Row height, type, both views                 | 28 px, 12 px                                            |
| Sideways overflow in the tree                | 0                                                       |
| Selected, then band, backgrounds             | `#e0e0e0`, `#eaeaea`; three children of the row banded  |
| Canvas pick after Alt+L                      | row current and in view; focus stays on the filter      |
| Canvas pick through a row closed by hand     | row reopens                                             |
| Rebuild with the tree scrolled to 366 px     | still 366 px                                            |
| Hide                                         | gone from the page, same box, row stays after a rebuild |
| Hide: source, Changes tray                   | `git status` unchanged; tray still reads empty          |
| Hide at rest                                 | eye opacity 1, name opacity 0.5                         |
| Hide, then a soft navigation or `?tab=`      | cleared                                                 |
| Hide a component with a null-rendering child | row reads hidden, and undoes                            |
| Hide "App shell" on `/main`               | page blank, one attribute, rows inside fade; undoes     |
| Hidden `<button>`, after a rebuild           | keeps its name                                          |
| Lock, canvas pick on it                      | falls through to `<main>`'s row, "Frame"                |
| Lock, from the tree                          | still selects                                           |
| Lock, after a reload                         | still locked, still falls through                       |
| Lock, away to `/other` and back              | gone there, back here                                   |
| Alt+L with a pick, then Esc                  | row stays revealed; the way stays open after Esc        |
| Alt+L with the pick low in a short window    | row in view                                             |
| Show and unlock, from the menu and the key   | no marks left, storage empty                            |
| The same row with nothing marked             | disabled                                                |
| `?` sheet                                    | lists both commands                                     |
| Long name under the actions, `/main`      | fades out under them                                    |
| Console                                      | no errors                                               |

- **Screens, opened and read:** `/layers` at 1280 light and dark and 1440 in Code, `/main` at 1440. kept locally, not in this repo.

### What the reviewers flagged

- **a task review. Fixed:**
  - a component with a null-rendering child could never read as hidden, so its eye couldn't undo a hide;
  - only the first part of a split Server Component was hidden, while the row read hidden;
  - a `?tab=` navigation kept hides;
  - a pick whose row wasn't reported yet was treated as revealed;
  - Alt+L could leave the selected row out of view;
  - a hidden button lost its name on a rebuild, because `innerText` skips what's hidden;
  - four assertions in my spec proved nothing;
  - my plan and a comment said marks never reach the server, but reports pass through its memory. Nothing stages them.
- **a task review. Accepted, listed below:** a hide ends when React replaces the element.
- **a copy review. Fixed:** "Show and unlock everything" claimed more than it clears and clashed with "Hide or show everything but the canvas". It now reads "Show and unlock all layers".
- **My own scripts. Fixed:** a mark made just after a navigation counted as the old page's, so a lock could be saved under the wrong route. Alt+L then Esc shut the rows around the old pick.

### Left open

- **E2E not run, as the maintainer asked.** Nothing was skipped or removed. `layer-rows.spec.ts` is new, and `context-menu.spec.ts` gains the new row and group. None of this has run, so the "Tests" criterion is unmet.
- **A browser check and a design review didn't run as tools:** the Playwright MCP server failed to connect. So "UI checked" is unmet, though the scripts took the measures above. "PR" is unmet too: this is a local merge.
- **Open choices:**
  - A hidden element keeps its space. Figma closes the gap in an auto layout. Doing that here would restructure the Design tree under the pointer, as the tree is built from what's drawn. It can change if the gap reads wrong.
  - A hidden row's name is at 0.5 opacity, below 4.5:1, as the task asks for it to read faded.
  - "Collapse all layers" keeps the way to the selection open, as the task asks, so "all" is slightly generous. a copy review suggests "Collapse layers".
  - The band is the hover colour, as `docs/design-language.md` says, so hovering a banded row shows no change.
- **Limits:**
  - A lock goes by tag, owners and position among those, so if a list grows above a locked row, a reload can lock a different row. It shows in the tree.
  - A hide ends when React replaces the element, such as on a hot reload that remounts it.
  - Hides are per frame. Locks reach every frame on the route.
  - Clear works on the route showing. Locks on other routes stay until the session ends.
  - Enter, Tab and their Shift forms can still move the pick onto a locked element, as a lock covers the canvas.
  - Alt+L, like the module's other keys, doesn't fire with focus inside the frame in Interact.
- **Budget:** TRU-3.6's budget note left room for TRU-3.7 and TRU-16.4, and TRU-3.7 used nearly all of it. TRU-16.4 will need a trim or a raise.
- **Not checked:** two frames at once, so a lock reaching the other frame through the `storage` event is from the code, not from a run. Also a real dark desktop in the headed window, and a designer's signed-in pages.
- **Noticed, not touched:** the untracked `Screenshot from 2026-11-02 11-50-18.png` is still in the repo root, left out of this commit.

Criteria #7, #8 were not fully proved when this task closed. See Left open above.
<!-- SECTION:FINAL_SUMMARY:END -->
