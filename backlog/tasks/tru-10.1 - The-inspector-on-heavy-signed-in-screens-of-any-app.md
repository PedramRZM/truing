---
id: TRU-10.1
title: The inspector on heavy signed-in screens of any app
status: To Do
assignee: []
created_date: '2026-11-01 10:44'
labels:
  - inspector
milestone: m-1
dependencies:
  - TRU-2.1
type: feature
ordinal: 100010
parent_task_id: TRU-10
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TRU-1.1 measured React's 10,000-element owner-stack cap only on signed-out routes, the largest of which had about 1,300 elements. The signed-in screens of a real app can be much heavier.

Past the cap, React gives host elements a shared "unknown owner" stack. The inspector then shows "This page has more elements than React keeps locations for." instead of a location. If that happens to visible project elements on real screens, TRU-1.1's fallback has to be built: an HTML-only loader that writes the location into the markup at compile time.

Research: TRU-1.1 (the cap section and the fallback loader), `src/modules/selection/` (`stacks.ts` sets `capped`, `inspect.ts` applies the rule).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Signing in stays the person's own.** Truing's window keeps a persistent browser profile, so the person signs in to their app there once, the way they would in any browser. Truing asks for no test account, no auth setup and no config, and never reads credentials or cookies.
- [ ] #2 **Find the heavy screens without being told.** Truing counts the elements on each route the person visits and notes when a page passes the cap. It needs no list of routes.
- [ ] #3 **Cap counted.** On at least two long signed-in screens, in two different apps, count the elements past the cap as TRU-1.1's script did. Record the counts, and how many of them are visible project elements.
- [ ] #4 **Owners checked.** Sample 20 elements on those screens and check by hand that the inspector names the right component, call site and definition. Record each mismatch.
- [ ] #5 **Loader, only if needed.** If visible project elements lose their location, build the HTML-only loader from TRU-1.1 as a framework adapter that adds nothing to the project's files, and show the same screens resolving with it on. Otherwise record that it isn't needed.
- [ ] #6 **Past the cap, say so.** The inspector explains the cap in plain words on any app that reaches it, and offers a way forward.
- [ ] #7 **Recorded.** The counts, the sample and the decision go in this task's final summary, with dates. No app's name or data is recorded.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
