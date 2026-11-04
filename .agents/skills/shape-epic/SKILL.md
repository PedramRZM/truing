---
name: shape-epic
description: Turn an idea, request or problem into a well-scoped epic in the backlog by interviewing the human until the outcome, non-goals, constraints and 3–7 testable acceptance scenarios are clear, then creating it with the backlog CLI. Use when someone proposes a feature, capability or initiative ("I want…", "we need…", "let's build…"), or asks for a PRD, spec, requirements or an epic.
---

# Shape an epic

An epic is a one-page agreement about _why_ and _what_, not _how_. Most rework comes from ambiguity nobody asked about, so this skill is mostly questions.

## 1. Understand

- Read `README.md` and `docs/roadmap.md`, then look for overlap: `backlog search "<keywords>"` and `docs/specs/`.
- Interview the human one question at a time, offering options where possible. Keep going until you can state:
  - the problem and who has it;
  - the observable outcome;
  - non-goals;
  - constraints: zero config (how the feature gets what it needs from the project), the Claude auth rule, `docs/design-language.md`, performance on a large app;
  - risks and unknowns.
- Challenge vague words ("fast", "secure", "simple", "integrated") until they are testable.
- If an unknown blocks scoping, propose a time-boxed `research` or spike task instead of guessing.

## 2. Size it

- XS/S (fits one session): skip the epic; create one task with acceptance criteria.
- M: epic + tasks.
- L or unclear: epic + spec delta at `docs/changes/<EPIC-ID>-<slug>/spec.md` (from `docs/templates/spec-delta.md`) + research.

## 3. Write and create

- Draft the epic body from `docs/templates/epic.md` (one page at most) and show it to the human before creating anything.
- Create it:
  `backlog task create "Epic: <title>" --type epic -l epic -m "<milestone>" -d "<body>" --ac "WHEN … THEN …" --ac "…"`
  with one `--ac` per acceptance scenario.
- Hard-to-reverse choices the epic implies get an ADR with status `proposed` (`adr` skill).

## 4. Stop

Stop once the epic is agreed. Breaking it into tasks is the `decompose` skill's job, ideally in a fresh session.
