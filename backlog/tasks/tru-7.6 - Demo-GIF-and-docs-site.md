---
id: TRU-7.6
title: Demo GIF and docs site
status: In Progress
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 09:10'
labels:
  - docs
milestone: m-1
dependencies:
  - TRU-6.12
parent_task_id: TRU-7
type: docs
ordinal: 70060
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Someone deciding whether to try Truing should see it work in a few seconds, and find the docs without cloning anything.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Demo.** The README opens with a short GIF of a real run: `truing` in a folder, the review screen, picking an element, a change landing in source. It shows no private app.
- [ ] #2 **Docs site.** A small site carries the install line, the guide from TRU-13.3, `docs/modules.md`, and what works per framework (TRU-9.1).
- [x] #3 **Zero config first.** The first page's first command is the only thing a person needs. Any mention of `truing.config.ts` is marked optional and comes later.
- [ ] #4 **Published from the repo.** The site builds from `docs/` in CI, with no account or token a contributor has to hold.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The GIF comes from a real run on a small app, with a real `claude` read. `docs/getting-started.md` and `docs/frameworks.md` carry the content a site would. A hosted site conflicts with golden rule 12 (no hosted pages), so it's the owner's call. Recording the demo also found a real bug: on a default Tailwind project, typing a padding wrote `px-0`.
<!-- SECTION:NOTES:END -->
