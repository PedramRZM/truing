---
id: TRU-14.3
title: A Pages section from the app's routes
status: To Do
assignee: []
created_date: '2026-11-02 09:28'
updated_date: '2026-11-07 09:39'
labels:
  - panels
milestone: m-3
dependencies:
  - TRU-14.1
  - TRU-3.4
references:
  - docs/changes/TRU-14-frames-claude-takes/plan.md
parent_task_id: TRU-14
type: feature
ordinal: 140030
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Paper's Design tab opens with Pages. In Truing the pages are the app's routes, and today you have to know a route and type it. TRU-14.1 is already answering where a page list comes from, so this is that list's first home. TRU-14.2's saved board then builds on it.

Research: TRU-14.1's outcome and TRU-14.2's board; `docs/research/paper-design-teardown.md` ("The left panel").
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The list.** A collapsible Pages section above the layers in the Design tab. Pages from TRU-14.1's source, grouped by top-level folder, with a tick on the one showing. Its height is limited so the layers keep most of the panel.
- [ ] #2 **Open.** Clicking a page navigates the frame, the same way the route box does, and the route box updates.
- [ ] #3 **Dynamic routes.** A route with a parameter asks for its value, and remembers the last one per route. A page visited in this session with a real value is listed under it.
- [ ] #4 **Search.** A filter across the list when there are more than a dozen.
- [ ] #5 **Signed-in pages.** A page that redirects away to sign in says so in place, and doesn't silently show the sign-in page. Works with TRU-10.1.
- [ ] #6 **No setup.** The route source comes from a framework adapter where one exists, and otherwise from Claude's read of the routes in the profile. There is nothing to configure. If neither finds routes, the section says so and the route box still works.
- [ ] #7 **Tests.** Unit tests for route listing on the fixture app. Playwright: click a page, and enter a parameter.
- [ ] #8 **UI checked.** Screens and text checked against `docs/design-language.md`.
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
From TRU-14.1: on Next, the page list comes from `get_routes` on the dev server's `/_next/mcp`, filtered: drop `/api/` entries, entries with a file extension and `/.well-known/`. On the real app that left 39 static pages and 67 with parameters. Other frameworks: Claude reads the routes into the profile at setup; how often it is right still needs real runs.
<!-- SECTION:NOTES:END -->
