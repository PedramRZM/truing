---
id: TRU-11.5
title: 'Create tokens from Truing, written where the project defines them'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - tokens
  - panels
milestone: m-2
dependencies:
  - TRU-1.4
  - TRU-4.1
  - TRU-11.1
  - TRU-3.9
  - TRU-6.4
type: feature
ordinal: 110050
parent_task_id: TRU-11
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
If a new size, colour or any new token is needed, the person defines it in Truing and it lands in the project's tokens, with no code to write. Tokens live in code first: the project's token source is the source of truth.

The research (`docs/research/token-inspection-and-authoring.md`, section 4) worked out where each kind of token goes on Tailwind v4:

| Kind                                         | Where                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Palette, spacing, radius, text style, shadow | `@theme`                                                                                      |
| Semantic aliases                             | `:root` **and** `.dark` inside `@layer base`, plus a `--color-x: var(--x)` in `@theme inline` |

A text-style or shadow token also needs the tailwind-merge groups, when the project has them (TRU-1.4). The write is a PostCSS edit that copies the neighbours' whitespace, and an unedited round trip is byte-identical.

The checks that matter before writing: name patterns; a new key that would override a Tailwind default and change every existing use; a class that already means something else; shared roots (`text-` is colour and size); near-duplicates (ΔE2000 under about 1.0, exact px for spacing).

Tailwind before 4.3.3 shows a new `@theme` variable one edit late under Turbopack, even after a reload.

Research: `docs/research/token-inspection-and-authoring.md` section 4, `docs/research/paper-design-teardown.md`, (colour editing, contrast pairs, live preview through an injected `@layer theme` block).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Claude finds where tokens live.** Before the first write, Claude reads the project and reports where tokens are defined and in what form (`@theme`, `:root` variables, a v3 config, CSS-in-JS, token JSON), with the file and its evidence, and this is saved in the profile. No path is configured or assumed. If Claude can't tell, Truing asks in the UI. Where the form isn't one Truing can write yet, it says so and offers to hand the new token to Claude.
- [ ] #2 **The project's naming.** Name patterns come from the project's existing tokens, read by Claude and checked against the token table, not from a fixed list. A project with no pattern yet gets a suggested one to confirm.
- [ ] #3 **Paper's shape.** The Theme tab (TRU-3.4) gets a `+` whose menu lists the kinds of token. Clicking a token's row opens a small floating editor beside the panel: preview, name, value, duplicate, delete. TRU-3.9's token menu has the `+` that starts it from a value control.
- [ ] #4 **Where it starts.** From any value control, "New token…" opens the editor with the category, name and value, and the name prefilled from the project's pattern.
- [ ] #5 **Checks before writing.** The editor refuses or warns on: a malformed name; an existing key, offering to edit it instead; a Tailwind default the new key would override, with a count of its uses; a class that already compiles to something else; a near-duplicate, offering the existing token with its distance.
- [ ] #6 **Placement.** The token lands in the right block and order of the file. A semantic alias is written to every block it needs together. The diff contains only the new lines, and the edited CSS compiles before it is saved.
- [ ] #7 **Same Apply.** The element the person started from uses the new token in the same Apply, through TRU-4.1. The new class renders without a page reload.
- [ ] #8 **Old Tailwind.** If the project's own Tailwind is older than 4.3.3, Truing says a new token may show one edit late, and doesn't fail.
- [ ] #9 **Merge groups.** For a text-style or shadow token, the tailwind-merge groups update when the project has them, so `cn()` keeps it. A project without them skips this step silently.
- [ ] #10 **Changing a value.** Editing an existing token's value shows how many places use it, from the table and a source search, before Apply.
- [ ] #11 **In the hand-back.** New and changed tokens are listed in the PR (TRU-13.2).
- [ ] #12 **Tests.** Unit tests cover placement for each category, each refusal case and round-trip identity. A Playwright test creates a spacing token, applies it and sees the element change.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
