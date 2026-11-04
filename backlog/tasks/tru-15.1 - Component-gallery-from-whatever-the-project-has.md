---
id: TRU-15.1
title: Component gallery from whatever the project has
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - inspector
  - zero-config
milestone: m-3
dependencies:
  - TRU-1.5
  - TRU-2.1
  - TRU-6.4
type: feature
ordinal: 150010
parent_task_id: TRU-15
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Figma Make shows a design system through its stories (`docs/research/figma-make-teardown.md`). A gallery mode in Truing lets someone refine a component in all its variants at once, rather than hunting for a page that shows each one. The same inspector and edits apply. A change to a component here is always a change to its definition, and is labelled as one (TRU-2.2).

Projects differ: some have Storybook or a similar tool, some a routes folder of examples, some nothing. The gallery has to work from whatever is there.

Decide whether the gallery embeds the project's story tool or mounts stories inside the app's own dev server so source mapping keeps working.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Claude finds what exists.** Claude reads the project, read-only, and reports where stories or components live and how they run (a story tool, plain story files, a primitives folder, or none), with its evidence. This goes in the profile, with no path set by anyone.
- [ ] #2 **It asks when it can't tell.** If Claude finds several candidates or none, the UI shows what it found and asks. With nothing to show, the gallery says so and offers a list of components from the source, with no stories.
- [ ] #3 **Gallery mode.** It lists components by name and shows a chosen component's stories side by side, at the current viewport preset.
- [ ] #4 **Selection works.** Selecting inside a story gives the same inspector as on a page: component, variant, tokens, source.
- [ ] #5 **Edits are labelled.** Edits work as on a page and are labelled as component-definition changes.
- [ ] #6 **Uses and instances.** Each component shows how many times it is used in the code and lists those uses with file and line, from TRU-2.2's `usages.ts`, plus the count per variant, so an unused variant stands out. The gallery reads the same index as the inspector.
- [ ] #7 **Coverage gaps.** A component with no story shows "no story yet", and a story that fails to render shows its error. Neither breaks the gallery.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
