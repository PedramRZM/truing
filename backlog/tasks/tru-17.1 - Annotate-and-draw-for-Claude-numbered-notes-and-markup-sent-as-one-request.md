---
id: TRU-17.1
title: 'Annotate and draw for Claude: numbered notes and markup, sent as one request'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - claude
  - inspector
milestone: m-3
dependencies:
  - TRU-2.1
  - TRU-5.2
type: feature
ordinal: 170010
parent_task_id: TRU-17
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Some refinements are easier to show than to describe. Figma Make has two tools for this (`docs/research/figma-make-teardown.md`): a numbered pin on an element with a note, sent together, and freehand markup on the preview, with a note.



In Truing, every pin carries its element's context into Claude's request: source location, component, tokens and a cropped screenshot.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Annotate mode** (key A). Clicking an element drops a numbered pin and opens a note field in place. Pins persist across reloads within the session and can be edited or removed.
- [ ] #2 **Draw mode.** The person draws on the page with undo and clear, then attaches a note. The request carries a screenshot of the frame with the markup.
- [ ] #3 **Sending.** "Send" sends every open pin and drawing as one request to Claude. Each pin carries its element's context in a structured block. A test checks the exact payload.
- [ ] #4 **Results.** Claude's answer links each change back to the pin it addresses. Pins it addressed are marked done.
- [ ] #5 **Any app.** Pins work on any page Truing can show, with nothing added to the project and no config. On a page where source can't be resolved, a pin still carries its selector, text and screenshot, and the request says the location is unknown.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
