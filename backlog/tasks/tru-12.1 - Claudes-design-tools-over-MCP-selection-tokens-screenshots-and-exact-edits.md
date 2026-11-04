---
id: TRU-12.1
title: 'Claude''s design tools over MCP: selection, tokens, screenshots and exact edits'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
updated_date: '2026-11-04 07:45'
labels:
  - claude
milestone: m-2
dependencies:
  - TRU-1.4
  - TRU-2.1
  - TRU-5.2
  - TRU-5.3
parent_task_id: TRU-12
type: feature
ordinal: 120010
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude can edit any file with its own tools, but nothing makes it reach for the project's tokens and components. Free-form edits come back with `p-[13px]`, `text-gray-700` or a hand-rolled button.

The study's best tools let the agent call back into the editor: Cortex's project MCP server (17 tools), stagewise's per-session MCP server, Onlook's "edit actions are the agent's tool surface", agentation's queue tools, and Next's own `/_next/mcp` for routes and errors.

With design tools, Claude can read what the person selected, look up the right token, take a screenshot at a viewport to check its work, and make exact edits through the same engine the panels use.

An MCP server bound to the Truing session, never listening beyond the machine, exposes:

| Tool                          | What it does                                                       |
| ----------------------------- | ------------------------------------------------------------------ |
| `get_selection`               | elements, source locations, component, variant, tokens, screenshot |
| `get_tokens` and `find_token` | search the token table, nearest tokens to a value                  |
| `screenshot`                  | route, viewport, optional element                                  |
| `list_instances`              | every instance of a component                                      |
| `get_off_token`               | off-token values for a page                                        |
| `get_change_set`              | the staged Claude changes from TRU-12.2                             |
| `apply_direct_edit`           | runs TRU-4.1's engine and returns the diff                         |
| `resolve_change`              | marks a staged change done, with a note                            |

Research: `docs/research/claude-subscription-bridge.md` (how MCP servers attach to a session).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Tools.** The server above exists, is bound to the session, and listens only on the machine.
- [ ] #2 **Comes with the session.** Truing passes the server to `claude` itself for each run. The person adds nothing to `.mcp.json`, to Claude's settings or to the project. A project with no tokens still gets the tools, and `find_token` answers that there is no token table.
- [ ] #3 **Snapshot-tested.** Tool names, descriptions and schemas are snapshot-tested, so a changed description shows in review.
- [ ] #4 **Errors Claude can act on.** Tools return errors Claude can use ("no token within ΔE 1.0; nearest are …"), never a stack trace.
- [ ] #5 **Tokens over free-form edits.** In a scripted session of 10 design requests on a fixture project, Claude uses `find_token` or `apply_direct_edit` for token-level changes rather than free-form edits, and at least 9 of the 10 resulting diffs use only that project's tokens, judged by TRU-11.6's lint. The run is recorded here.
- [ ] #6 **Scoped.** Tools can only see the current session's selection and change set, and write only through TRU-4.1's guarded endpoint, inside the profile's writable paths.
- [ ] #7 **The prompt is measured.** Its hash and resolved model are recorded. Attacks in element text and screenshots are reported as k of n, along with benign labels such as "Delete account", and copy stays preserved in any language. Moved here from TRU-5.3, since these tools change what Claude is handed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
