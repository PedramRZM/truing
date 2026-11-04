---
id: TRU-8.3
title: Read tokens through Claude for projects not on Tailwind v4
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - zero-config
  - tokens
  - claude
milestone: m-1
dependencies:
  - TRU-6.4
  - TRU-6.9
type: feature
ordinal: 80030
parent_task_id: TRU-8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-1.4's token table reads Tailwind v4's design system. Many projects keep tokens elsewhere: plain CSS variables, a Tailwind v3 config, CSS-in-JS themes, or token JSON. Rather than writing a parser for each, ask Claude to read them into the same table, so every panel works the same.

Research: `docs/research/token-inspection-and-authoring.md`; `src/tokens/table.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Same table.** Tokens read through Claude land in the same structure as Tailwind v4's: name, category, value, light and dark values, source file and line. No panel knows which path they came from.
- [ ] #2 **Claude finds them.** Claude finds where tokens live and in what form, read-only and with its evidence. A person sets no path, format or list. When there are several candidates, or none it trusts, the UI shows what it found and asks.
- [ ] #3 **Forms covered.** Plain CSS variables, a Tailwind v3 config, a CSS-in-JS theme object and token JSON (DTCG or similar) each have a fixture, and the read gets all their tokens right.
- [ ] #4 **Values are checked.** Every value is checked against the file it names, and for CSS variables against the running page. A token that fails the check is dropped and counted, never shown as fact.
- [ ] #5 **Evaluated.** An evaluation over at least five real open-source projects records how many tokens were right and how many were missed.
- [ ] #6 **Says what it can't do.** Where the form can be read but not written, the Theme tab says tokens are read-only here.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
