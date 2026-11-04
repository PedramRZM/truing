---
id: TRU-17.4
title: 'Hand performance findings to Claude, and let it measure before and after'
status: To Do
assignee: []
created_date: '2026-10-31 16:46'
labels:
  - claude
  - inspector
milestone: m-3
dependencies:
  - TRU-17.3
  - TRU-12.1
type: feature
ordinal: 170040
parent_task_id: TRU-17
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A finding from TRU-17.3 should go to Claude like any other change, through the Changes tray, with the evidence attached: the metric, the attributed element and its source location, the components that re-rendered, and the viewport.

Claude should then be able to measure for itself. `chrome-devtools-mcp` (Apache-2.0, Google) gives it `performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight` and `lighthouse_audit`. Claude can check a fix against a trace instead of guessing.

Research: `docs/adr/0001-compose-our-own-injected-browser-modules.md`; TRU-1.2's recommendation (every MCP tool needs its own allow rule, or it prompts); TRU-12.1; `chrome-devtools-mcp`'s options for attaching to an existing browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Stage a finding.** From the performance panel, "Ask Claude to fix this" stages the finding in the Changes tray, labelled Claude. The request carries the metric and its value, the element's call site and definition, the render list, the viewport and a cropped screenshot.
- [ ] #2 **Claude can measure.** `chrome-devtools-mcp` is added to the bridge's `--mcp-config`, attached to Truing's own browser rather than starting another. Its trace and Lighthouse tools have allow rules, and nothing else from it is allowed without a prompt. Claude's run shows a trace taken before and after its change.
- [ ] #3 **Nothing to install or configure.** Truing brings and starts the MCP server itself for the run. The person adds nothing to `.mcp.json` or the project, and no port or browser path is set by anyone. If it can't start, the finding still goes to Claude, and the panel says the before and after trace isn't available.
- [ ] #4 **The result.** After Claude's change, the panel re-measures the same interaction. Before and after are shown side by side with the diff, and the person keeps or undoes it as one step.
- [ ] #5 **Limits.** Edits stay inside the profile's writable paths, as with every Claude change. A fix that needs server code is reported as advice for a developer, not written.
- [ ] #6 **Evaluation.** Three seeded findings on fixture pages: an expensive render in a `.map()`, a layout shift from an image without size, and a long task in a click handler. Each is run through the flow, with the before and after metrics recorded.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
