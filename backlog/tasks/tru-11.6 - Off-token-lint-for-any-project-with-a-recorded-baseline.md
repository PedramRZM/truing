---
id: TRU-11.6
title: 'Off-token lint for any project, with a recorded baseline'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - tokens
milestone: m-2
dependencies:
  - TRU-1.4
  - TRU-6.4
type: feature
ordinal: 110060
parent_task_id: TRU-11
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People want any value that isn't on a token to be easy to spot. Truing does that on the page (TRU-11.2). This task does it in the source, without a browser, for people and Claude alike, in any project that has tokens.

The research (`docs/research/token-inspection-and-authoring.md`, section 2) ran eslint-plugin-better-tailwindcss 4.10.0 (MIT, ESLint 9) over one real project of about 400 files in 15 s. It found 1,503 arbitrary values, 713 standard-scale spacing classes, 294 Tailwind default colours, 37 classes that generate no CSS and 8 raw colours in `style`.

"Compiles" isn't "on token": `px-401` and `bg-red-50` compile fine. So the lint needs patterns built from the project's own tokens, on top of `no-unknown-classes`.

A project usually has old code and deliberate exceptions, and some Tailwind defaults like `text-sm` may match its body styles on purpose. So this starts as a warning, scoped, with a recorded baseline. It becomes an error only when the person decides which defaults count as tokens.

Research: `docs/research/token-inspection-and-authoring.md`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **No setup.** `truing lint` works in any folder that has a saved profile, with no config file, no edit to the project's ESLint config and no plugin added to its `package.json`. Truing brings the plugin itself.
- [ ] #2 **Claude finds the tokens.** The token stylesheet comes from the profile. If the profile has none, Claude is asked to find it, read-only, and to say what form the tokens take. If Claude can't tell, the person is asked. A project with no tokens gets a plain message, not a failure.
- [ ] #3 **Rules from the project.** `no-unknown-classes` (allowing the plain CSS classes Claude finds in the project), plus restricted patterns built from that project's scale: its spacing map with an autofix where one exists, a catch-all for other spacing numbers, arbitrary values including `(--x)` and `[prop:value]` forms, Tailwind default colours, and raw colours in `style={{}}`.
- [ ] #4 **Scope.** Every rule is a warning. Claude proposes which folders hold old or excluded code, with its evidence, and the person confirms. A test over fixtures proves each pattern, including that `md:gap-2` maps to `md:gap-300` on a fixture scale and that `group-data-[x]/tabs:` isn't flagged.
- [ ] #5 **Baseline.** `truing lint --baseline` records the counts per area outside the repository, next to the profile. The person may commit the baseline if they want one for a team, and nothing requires it.
- [ ] #6 **Ratchet.** With a baseline, the command exits non-zero only if a count rises, never on existing warnings, so a project can add it to its own CI as one line.
- [ ] #7 **Which defaults count.** Truing asks once which defaults are tokens (for example `text-sm`, `bg-white`), offers Claude's reading of the project's usage as the starting answer, and saves the answer in the profile.
- [ ] #8 **Class constants.** Classes in module-level constants, which the lint can't see, are reported as a known gap with a count.
- [ ] #9 **Runtime.** On a 400-file project the command takes under 20 s, and the design system loads once per run.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
