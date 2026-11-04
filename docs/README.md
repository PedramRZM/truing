# Docs map

The repository is the system of record. Agents and humans read the same docs. Start from `AGENTS.md` at the repo root, then come here for anything deeper.

| Where                                    | Holds                                         | Written by                            |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------- |
| [getting-started.md](getting-started.md) | Start here: the one command, and what follows | humans                                |
| [frameworks.md](frameworks.md)           | What works per framework, styling and system  | humans                                |
| [roadmap.md](roadmap.md)                 | Where Truing is going, in order               | humans                                |
| [design-language.md](design-language.md) | How Truing's own interface looks and behaves  | humans; every shell change follows it |
| [modules.md](modules.md)                 | How to write a Truing module                  | whoever changes the module API        |
| [architecture/](architecture/README.md)  | Golden principles, and the system map         | `adr` / `capture` skills              |
| [adr/](adr/)                             | Architecture decision records (MADR)          | `adr` skill; humans accept            |
| [specs/](specs/)                         | Living capability specs                       | `capture` merges spec deltas          |
| [changes/](changes/README.md)            | In-flight epics: spec delta, plan, research   | `shape-epic`, `plan-task`             |
| [research/](research/)                   | Dated, cited research reports                 | `research` skill                      |
| [references/](references/README.md)      | Notes on reference repos                      | `study-repo` skill                    |
| [learnings/](learnings/README.md)        | Durable lessons (gotchas, root causes)        | `capture` skill                       |
| [harnesses/](harnesses/README.md)        | How each coding agent works with this repo    | humans                                |
| [templates/](templates/)                 | Templates for all of the above                | humans                                |

The backlog (epics, tasks, milestones) lives in `../backlog/` and is managed with the `backlog` CLI.

`make check` keeps this knowledge base honest: it checks links, paths named in docs, metadata and indexes, and that no host project's brand has crept in.
