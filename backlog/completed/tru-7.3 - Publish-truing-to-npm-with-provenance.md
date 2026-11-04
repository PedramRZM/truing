---
id: TRU-7.3
title: Publish `truing` to npm with provenance
status: Done
assignee: []
created_date: '2026-11-03 13:45'
updated_date: '2026-11-04 10:01'
labels:
  - infra
milestone: m-1
dependencies:
  - TRU-6.12
parent_task_id: TRU-7
type: chore
ordinal: 70030
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The name `truing` was free on npm as of 2026-11-03. Publish it so `npx truing` is the only install step, with provenance so anyone can see which commit built it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Small and clean.** The package holds only what it needs. A test lists its files, and proves it contains no fixtures, no backlog and no secrets.
- [x] #2 **Zero install config.** `npx truing` needs no global install, no postinstall step the person has to approve, and no settings. It goes straight to setup, with Node as the only prerequisite, and says so when Node is too old.
- [x] #3 **Works from any folder.** It runs from a folder with no `package.json`, and leaves nothing behind in the folder it started from.
- [x] #4 **Published.** `npm view truing` shows the package, and `npx truing` starts it on a clean machine.
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
Proven from a real packed tarball installed with pnpm's strict layout into an empty folder: `--version`, `--help`, `setup`, `tokens`, and the shell built and connected a frame with no page errors. `npx` itself and provenance can only follow a publish, which is the owner's: npm needs a package to exist before a trusted publisher can be set.

Provenance dropped on 2026-11-04: it needs CI, and the owner removed CI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`truing-cli@0.1.0` is on npm, 174 files, as npm refused `truing` as too similar to another package. The project and its command keep the name. From an empty folder with an empty npm cache on Linux: `npx -y truing-cli` took 27s the first time, `--version`, `--help`, `setup` and `tokens` all answered, the real setup window opened and served its screen, and nothing was left in the folder. That machine already had Truing's browser; the download itself was proven earlier with a real install into an empty folder. npm first showed a `0.0.0-stage` placeholder while it reviewed the upload, and `0.1.0` went live 35 seconds after we started watching. That placeholder stays in the version list. No provenance, as the owner removed CI.
<!-- SECTION:FINAL_SUMMARY:END -->
