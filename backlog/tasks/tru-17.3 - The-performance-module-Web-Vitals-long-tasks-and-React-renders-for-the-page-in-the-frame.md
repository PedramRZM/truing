---
id: TRU-17.3
title: 'The performance module: Web Vitals, long tasks and React renders for the page in the frame'
status: To Do
assignee: []
created_date: '2026-10-31 16:46'
labels:
  - inspector
milestone: m-3
dependencies:
  - TRU-1.6
  - TRU-2.1
type: feature
ordinal: 170030
parent_task_id: TRU-17
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Performance monitoring of pages in Truing is the first optional module. TRU-1.3 found nothing for it in Airship or Cortex. The pieces exist and are maintained:

- `web-vitals` (Apache-2.0, Google): LCP, INP, CLS, FCP and TTFB, each with attribution to the element or interaction behind it.
- `PerformanceObserver`, for long tasks and long animation frames.
- `react-scan` (MIT): counts and times React renders, and it is built on bippy, the library our resolver uses.

Selection (TRU-2.1) is reused to answer "which component is slow, and where is it in the code".

Research: `docs/adr/0001-compose-our-own-injected-browser-modules.md`; `web-vitals` (attribution build), `react-scan`'s programmatic API, MDN `PerformanceObserver` for `long-animation-frame`; TRU-1.1's write-up on the bippy pin and why the hook must load first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **The two bippy versions.** First, check that react-scan's bippy (^0.5.39) and Truing's pinned bippy 0.7.3 can share one page, as both install React's DevTools hook. If they can't, use react-scan's render data through our own hook, or measure renders with bippy 0.7.3 directly. Record which.
- [ ] #2 **Web Vitals.** For the route in each frame, the panel shows LCP, INP, CLS, FCP and TTFB at the frame's viewport. Each is rated against Google's thresholds and names its attributed element, with that element's source location from TRU-2.1.
- [ ] #3 **Long tasks.** Long tasks and long animation frames over 50 ms are listed with their time and script while the person interacts.
- [ ] #4 **React renders.** For an interaction, the components that rendered are listed with count and time, linked to their definitions. In a project that doesn't use React, this part says so and the rest still works.
- [ ] #5 **Dev-mode caveat.** The panel says plainly that the numbers come from the project's dev server, which is slower than production, and that they are for comparing before and after, not for absolute targets.
- [ ] #6 **Built as a module, on by default.** Everything above comes through TRU-1.6's contract, and needs nothing from the project: no config entry, no dependency added, no path. It is on for every project. Turning it off is a setting in Truing, not an edit to a file.
- [ ] #7 **Tests.** A fixture page with a deliberately slow component and a layout shift. A Playwright test checks that the panel names both, with their source locations.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
