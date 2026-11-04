# In-flight changes

Each epic or large task that needs more than an in-task plan gets one folder: `docs/changes/<TASK-ID>-<slug>/`.

| File          | When                                                            | Template                            |
| ------------- | --------------------------------------------------------------- | ----------------------------------- |
| `spec.md`     | The change alters durable behaviour or contracts (L-sized work) | `docs/templates/spec-delta.md`      |
| `plan.md`     | Multi-session, cross-cutting or risky work                      | `docs/templates/plan.md`            |
| `research.md` | Research that only matters for this change                      | `docs/templates/research-report.md` |

The backlog holds status and scope; this folder holds the _how_. They are linked by task ID only. When the epic closes, the `capture` skill merges `spec.md` into `docs/specs/` and moves the folder to `docs/changes/archive/`.
