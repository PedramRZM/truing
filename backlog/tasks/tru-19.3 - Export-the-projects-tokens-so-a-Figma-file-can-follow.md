---
id: TRU-19.3
title: 'Export the project''s tokens so a Figma file can follow'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - tokens
milestone: m-3
dependencies:
  - TRU-1.4
type: feature
ordinal: 190030
parent_task_id: TRU-19
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tokens live in code first, and a project's Figma file is updated from code when needed. People can create tokens in Truing (TRU-11.5), so Figma falls behind unless something carries the changes across.

Writing variables through Figma's REST API needs an Enterprise plan, and most teams don't have it. So the export has to work without API writes. It also has to be cheap enough to run after every token change.

Research: `docs/research/token-inspection-and-authoring.md` (the W3C DTCG format and the one-way sync options).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Exporter.** `truing tokens --export` turns the token table into a DTCG JSON file: palette, spacing, radius, text styles, shadows, and the semantic aliases as references.
- [ ] #2 **Nothing to configure.** It reads the table Truing already holds, whatever form the tokens came from. The output path defaults to the working folder and can be set with a flag. It needs no Figma file key, token or plan, and Truing never contacts Figma.
- [ ] #3 **Import path.** A documented way gets that file into Figma as variables without API writes (a native import or a plugin). It is tried once on a scratch file, and a screenshot is recorded here.
- [ ] #4 **Same values.** Running the export twice on the same token source produces the same file. A test covers this.
- [ ] #5 **Divergence report.** Running the export after a token change shows exactly what differs from the last export, so whoever updates Figma knows what to touch.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
