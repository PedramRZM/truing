---
id: TRU-7.3
title: 'Publish `truing` to npm with provenance'
status: To Do
assignee: []
created_date: '2026-11-03 13:45'
labels:
  - infra
milestone: m-1
dependencies:
  - TRU-6.12
type: chore
ordinal: 70030
parent_task_id: TRU-7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The name `truing` was free on npm as of 2026-11-03. Publish it so `npx truing` is the only install step, with provenance so anyone can see which commit built it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Published.** `npm view truing` shows the package, and `npx truing` starts it on a clean machine.
- [ ] #2 **Provenance.** Each release is published from CI with npm provenance, so the package links to the commit and workflow that built it.
- [ ] #3 **Small and clean.** The package holds only what it needs. A test lists its files, and proves it contains no fixtures, no backlog and no secrets.
- [ ] #4 **Zero install config.** `npx truing` needs no global install, no postinstall step the person has to approve, and no settings. It goes straight to setup, with Node as the only prerequisite, and says so when Node is too old.
- [ ] #5 **Works from any folder.** It runs from a folder with no `package.json`, and leaves nothing behind in the folder it started from.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
