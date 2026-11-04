---
id: TRU-11.1
title: 'A Tokens module: every token, read-only, in Truing'
status: To Do
assignee: []
created_date: '2026-10-31 21:35'
labels:
  - tokens
  - panels
milestone: m-2
dependencies:
  - TRU-1.4
  - TRU-1.6
  - TRU-3.4
  - TRU-6.4
type: feature
ordinal: 110010
parent_task_id: TRU-11
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-1.4 built the token table, but nothing in Truing shows it: you have to run `truing tokens` and read the output. People want to see every token in the project.

This is a module on the TRU-1.6 contract (`docs/modules.md`): a panel and a server part, with no probe and no change to Truing's core. It reads the table through `loadTokens` (`src/tokens/table.ts`) and edits nothing. Token creation stays in TRU-11.5.

Research: `docs/modules.md`, `src/modules/selection/` (a module's parts), `src/tokens/table.ts` and `manifest.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The module.** `src/modules/tokens/` holds `module.ts`, `server.ts` and `panel.tsx`, built only through the contract. It is on by default for every project, with no config entry needed.
- [ ] #2 **The list.** The Theme tab in the left panel (TRU-3.4) shows a count, a search field, and every token in collapsible groups by category: colour, spacing, radius, text style, shadow, font, container, animation and other. Each row has its class name, the effective value, light and dark swatches for colours, px for lengths, and line height and weight for text styles.
- [ ] #3 **Origin.** The project's tokens are listed first. Aliases, library and Tailwind defaults are marked and hidden by default. Each row names its source file and line.
- [ ] #4 **Chains.** A semantic token shows its chain (`primary` → `--primary` → `brand-1-600`) in light and dark.
- [ ] #5 **Shadowed.** Keys declared twice are flagged, with both lines and which one wins.
- [ ] #6 **Fresh.** Editing the token source refreshes the list without restarting Truing: the server reloads the table when the file changes. The file to watch comes from the profile.
- [ ] #7 **Any project.** The token location comes from the profile, and no path is hard-coded. With no tokens found, the tab says so, shows what Claude looked for, and offers to read again or lets the person point at a file. Tokens read through Claude (TRU-8.3) appear in the same list, with their source.
- [ ] #8 **Checked.** Unit tests for the server op. Screens checked at Truing's sizes in light and dark against `docs/design-language.md`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
