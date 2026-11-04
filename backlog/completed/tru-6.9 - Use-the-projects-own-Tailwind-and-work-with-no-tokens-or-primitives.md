---
id: TRU-6.9
title: 'Use the project''s own Tailwind, and work with no tokens or primitives'
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 01:01'
labels:
  - zero-config
  - tokens
milestone: m-0
dependencies:
  - TRU-6.4
parent_task_id: TRU-6
type: feature
ordinal: 60090
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Truing shouldn't pin a Tailwind version and read a project with it. It uses whichever Tailwind the project has installed, so a project's classes mean what they mean in that project. A project with no tokens, or no primitives folder, still gets the inspector and the panels.

Code: `src/tokens/design-system.ts`, `src/tokens/table.ts`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **The project's Tailwind.** The design system loads from the project's own installed `tailwindcss`, resolved from the project's folder. Truing ships no copy that it reads a project with.
- [x] #2 **No tokens.** A project with no token source opens normally. The inspector shows raw values, the panels work, and the Theme tab says no tokens were found.
- [x] #3 **No primitives.** A project with no primitives folder opens normally, and nothing assumes one exists.
- [x] #4 **Older or no Tailwind.** Tailwind v3, or no Tailwind at all, doesn't stop Truing from opening. The UI says what is limited, and TRU-8.3 covers reading those tokens.
- [x] #5 **No paths assumed.** The token location comes from the profile and is never hard-coded. Tests run on fixtures with Tailwind 4, with no Tailwind and with no tokens.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `make check` passes and its output is quoted in the final summary
- [x] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [x] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [x] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audit on 2026-11-03 before the first push, reading the code and tests against each criterion (fresh-context review, then checked here). Only criteria with evidence are checked; this task isn't done. Open: #2 the Theme tab says tokens "will show here" (src/shell/docks.tsx:58). #3 no-tokens.spec's second test is failing (it looks for a Theme button, now a tab). #4 src/setup/draft.ts:64-75 clears tokens, but no UI says so. #5 no no-Tailwind fixture.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Uses the project's own Tailwind, only after a person confirms. No tokens, no primitives and no Tailwind all open normally, and the Theme tab and review screen say what's limited. Evidence: pnpm test:e2e: 192 passed, on two full runs in a row; make check: 880 unit tests passed; pnpm check-first-run on the real claude 2.1.317: 16 of 16 passed. Clean copy of the tree with a fresh install: `make check` passes.
<!-- SECTION:FINAL_SUMMARY:END -->
