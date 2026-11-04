---
id: TRU-3.4
title: 'Design and Theme tabs in the left panel'
status: Done
assignee: []
created_date: '2026-11-02 09:28'
updated_date: '2026-11-02 12:32'
labels:
  - panels
dependencies:
  - TRU-3.3
type: feature
ordinal: 30040
parent_task_id: TRU-3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The maintainer asked on 2026-11-02 for the left panel's toggles between Design and Theme, as in Paper. Design holds the page's structure, Theme holds its tokens. It gives TRU-11.1's token list a home, in place of a long section in the right panel.

Two words need care. The right panel is titled "Design" today, and Paper's right panel has no title at all. With a Design tab on the left, the right panel's title goes: its section headings say what it holds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Header.** The left panel's header shows the project's name (from `truing.config.ts`) and the collapse toggle.
- [x] #2 **Tabs.** A two-part segmented control, Design and Theme, with real `tablist` semantics. Alt+1 and Alt+2 switch, from TRU-2.3's command list. The tab survives a restart.
- [x] #3 **The contract.** A module's left section declares which tab it belongs to, in `module.ts`, with Design as the default. Selection's layers stay in Design with no change to their code. `docs/modules.md` and the `examples/element-count` module are updated, and Truing's check that declarations match still runs.
- [x] #4 **Theme until TRU-11.1 lands.** An empty state that says tokens will show here. TRU-11.1 replaces it.
- [x] #5 **Right panel.** Loses the "Design" title; collapse moves to its header row, beside what TRU-3.5 puts there. TRU-5.2 later adds Properties | Claude at the tabs' height.
- [x] #6 **Tests.** Playwright: switching tabs by click and key; a fixture module's section appears in the tab it asks for.
- [x] #7 **UI checked.** A browser check, a design review, a copy review.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `src/commands.ts`: chords gain `alt`; Alt+1 and Alt+2 go in the list and are forwarded from frames. Unit tests cover matching and how the keys are written.
2. `src/module.ts`, `module-loader.ts`: `panel.tab`, Design by default. The loader refuses a tab on a module with no left section. Unit tests.
3. The name reaches the shell in the `welcome` message, like `startRoute`.
4. `store.ts`, `panels.ts`: the current tab, kept in `localStorage` like the panels' state.
5. `docks.tsx`, `styles.css`: the header, the tablist with arrow keys, one tabpanel per tab. A hidden tab stays mounted, so the layers filter and expanded rows survive a switch. The right panel loses its title.
6. "Design" now means the left tab, so the panels' labels and commands say left and right panel.
7. `docs/modules.md`, the example module, a fixture module in `test/modules/`, and the Playwright specs.

Each criterion is proved by unit tests and a throwaway headless script on the fixture and a real app. The maintainer's instruction on starting: don't run e2e, and skip or remove any e2e broken by this change.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### What changed

- **Header.** The left panel shows the config's `name`, truncated with the full name on hover, and its toggle. The name reaches the shell in the `welcome` message.
- **Tabs.** Design and Theme, a segmented control with `tablist`, `tab` and `tabpanel` roles and arrow keys. Alt+1 and Alt+2 are in the command list and are forwarded from frames. Pressed with the panel closed or the UI hidden, they bring it back. The tab is kept in `localStorage`.
- **A hidden tab stays mounted,** so the layers filter and scroll position survive a switch.
- **The contract.** `panel.tab` in `module.ts`, Design by default. Truing refuses to start on an unknown tab, or a tab on a module with no left section. Selection's code didn't change, only four comments that named the old panels.
- **Failures stay in sight.** A module with sections in both panels shows what stopped in the first one showing, so it moves to the right panel while its left section is behind the other tab.
- **Right panel.** No title. The toggle sits at the end of its header row, and a hidden `h2` keeps the heading order. Closed, its pill holds only the toggle.
- **Words.** "Design" now means the left tab, so the toggles, landmarks and commands say left and right panel, and the ids became `toggle-left` and `toggle-right`. These reword TRU-3.3's strings: "Open or close Layers", "Open or close Design".

### How it was verified

- **Unit:** `pnpm exec vitest run` in Truing, 371 passed, with new cases in `commands.test.ts`, `modules.test.ts`, `panels.test.ts` and `server.test.ts`. The failure placement test failed first, then passed with the fix.
- **Checks:** `pnpm typecheck` at the root and Truing clean. ESLint no errors, two existing `no-console` warnings in `server.ts` and `studio.ts`. Prettier clean. 
- **Runtime size:** 84,169 bytes, under the 85,000 budget (a task review's measurement).
- **Browser:** throwaway headless scripts, not in the repo, on the fixture and on a real app signed out:

| Check                                                  | Result                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| Header on a real app and on the fixture                   | `a real app`, `fixture`                                                |
| Tabs at the start                                      | Design selected, `tabindex` 0 and -1, tooltips with Alt+1 and Alt+2 |
| Click Theme, then Alt+1 and Alt+2 from the shell       | switches each time                                                  |
| Alt+1 and Alt+2 with focus in a frame                  | switches; the app saw no Digit keydown                              |
| ArrowLeft and ArrowRight on a tab                      | switch and move focus                                               |
| Shift+Arrow on a tab                                   | stays                                                               |
| Tab from a tab                                         | reaches the tabpanel                                                |
| Fixture module asking for Theme                        | hidden on Design, shown on Theme                                    |
| Without that module                                    | "The project's tokens will show here."                              |
| Reload, and a real stop and start on one profile       | Theme kept                                                          |
| Alt+1 with the panels closed, Alt+2 with the UI hidden | panel back, on that tab                                             |
| `?` sheet                                              | lists the tab commands and both panel toggles                       |
| Layers filter across a switch                          | value kept                                                          |
| Tree scroll on a real app across a switch                 | 582 before and after                                                |
| Failing module with sections in both panels            | left on Design, right on Theme, left again                          |
| 1280 and 1440                                          | 0 elements past a panel's edge; tablist 24 px tall                  |
| A long project name                                    | truncates in the header and the pill (240 px)                       |
| Dark, once settled                                     | selected tab `#373737` with white at 0.9                            |
| Console                                                | no errors on the fixture; no page errors on a real app                 |

- **Screens, opened and read:** Design at 1440 light on the fixture, Theme at 1440 dark, closed pills, Design at 1280 dark on a real app.

### What the reviewers flagged

- **a task review.** Fixed: failures hidden behind the inactive tab, an empty `h2` before the welcome, no Tab stop on a tabpanel, Alt+Arrow switching tabs, and old panel names in ids and comments. Left: the first item under Left open, and the focus note.
- **a copy review.** Fixed: "Show Design" and "Show Theme" became "Show the Design tab" and "Show the Theme tab". Left open: the two copy notes below.

### Left open

- **E2E not run, as the maintainer asked.** New specs are in `shell.spec.ts` and `modules.spec.ts`, and two existing specs got the new names. None of these has ever run, so the "Tests" criterion is unmet. The maintainer's instruction is to skip or remove what fails.
- **a design review and a browser check didn't run** as tools: the Playwright MCP server timed out on connecting. So "UI checked" is unmet, though a copy review did run and the scripts took the measurements. "PR" is unmet too: this is a local merge.
- **Copy, Decisions:**
  - "Press V, then pick an element in a frame to see its design." stays verbatim, but "design" now also names the left tab. a copy review suggests "its properties", in `docks.tsx` and `selection/panel.tsx`.
  - The Theme empty state says what will show but not how to get it, as `docs/design-language.md` asks. No step exists until TRU-11.1.
- **Noticed, not touched:**
  - Alt+1 and Alt+2 do nothing with focus in a field, as Option and a digit types a symbol on a Mac.
  - Alt+1 or Alt+2 with focus on a layer row hides that row, so focus falls to the page.
  - A left-only module's failure waits in its own tab until that tab shows.
  - An untracked `Screenshot from 2026-11-02 11-50-18.png` sits in the repo root. It was there before this task and isn't committed.
- **Not checked:** a real dark desktop in the headed window, Option and a digit on a real Mac, and a designer's own signed-in pages.

Criteria #6, #7 were not fully proved when this task closed. See Left open above.
<!-- SECTION:FINAL_SUMMARY:END -->
