# Docs map

The repository is the system of record. Agents and humans read the same docs. Start from `AGENTS.md` at the repo root, then come here for anything deeper.

| Where                                    | Holds                                            | Written by                            |
| ---------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| [getting-started.md](getting-started.md) | Start here: the one command, and what follows    | humans                                |
| [frameworks.md](frameworks.md)           | What works per framework, styling and system     | humans                                |
| [roadmap.md](roadmap.md)                 | Where Truing is going, in order                  | humans                                |
| [design-language.md](design-language.md) | How Truing's own interface looks and behaves     | humans; every shell change follows it |
| [modules.md](modules.md)                 | How to write a Truing module                     | whoever changes the module API        |
| [architecture/](architecture/README.md)  | Golden principles, and the system map            | whoever changes a boundary            |
| [decisions/](decisions/README.md)        | Decision records, one per hard-to-reverse choice | agents propose; the owner accepts     |
| [specs/](specs/)                         | Specs for work that spans tasks or boundaries    | the `spec` skill                      |
| [plans/](plans/)                         | The plan and progress of a task in flight        | the `task` skill; deleted at merge    |
| [research/](research/)                   | Dated, cited research reports                    | agents and humans                     |
| [references/](references/README.md)      | Notes on reference repos                         | agents and humans                     |

Tasks and epics are GitHub issues; [`../WORKFLOW.md`](../WORKFLOW.md) says how they move. What sessions learned is in [`../.agents/memory/`](../.agents/memory/_index.md), kept by `/dream`.

`scripts/agent/check` keeps this knowledge base honest: it checks links, paths named in docs and indexes, and that no host project's brand has crept in.
