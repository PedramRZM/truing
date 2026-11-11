---
name: kickoff
description: Take a new product or project idea to a small, running, agent-ready repository. Finds the unknowns, puts the hard-to-reverse choices (stack, data, hosting) in front of the user as options, records the decisions, and builds the thinnest slice that runs with one check command. Use once, at the start of a new project or a major new product area.
disable-model-invocation: true
argument-hint: '[the idea, in a sentence or two]'
---

# Kickoff

The aim is a repository where the next task can be given to an agent and checked, not a
finished plan. Agents are good at producing code; deciding what should exist is the user's
part, so most of this is about getting those decisions made early and written down.

## 1. Agree on the problem

Before proposing anything, establish who has the problem, what they are trying to do, and what
"done" looks like for the first usable version. Say it back in three or four sentences and get
a yes. Without this an agent builds a slightly different product, convincingly.

## 2. Find the unknowns

- Do a blindspot pass: what does the user not know to ask about this domain? What has been
  tried before? Where are the potholes? Search, then explain it to them briefly.
- Where the answer is "I will know it when I see it" (layout, flow, tone), make something to
  react to: a single HTML file with several clearly different directions and fake data. Do not
  wire anything up yet.
- Then interview the user, one question at a time, about what is still ambiguous. Prefer
  questions whose answer would change the architecture.

## 3. Put the hard-to-reverse choices in front of the user

A one-way door is hard to undo: the data model, public names and URLs, the language and
framework, hosting, authentication, anything involving money. A two-way door is cheap to change
later. Spend the user's attention on one-way doors only.

For each one-way door, present two or three real options with the effort of each, what it
trades off, and your recommendation with the reason. Then stop and let the user choose.

When weighing a technology:

- Prefer what the user already runs and what models know well: stable, popular, well
  documented. For anything newer than the model's knowledge, make its current docs reachable
  (installed docs, the official site, an llms.txt) and say so in `AGENTS.md`.
- One way to do each thing. A second library for the same job doubles what every future
  session has to keep straight, because the code already in the repository is what the agent
  imitates.
- Strong static checks: a type system and a linter that fail loudly are the cheapest tests there are.
- It must run and be checked on the user's machine with one command, and the agent must be able
  to start the app and see it respond.
- Few dependencies, pinned. Avoid a release that came out in the last few days.

Framework choice matters less than it used to; do not let a two-way door hold things up.

## 4. Write the decisions down

One short record per one-way door in `docs/decisions/`, in the format its README gives. Phrase
the decision so it also says what not to do, and fill in "Revisit if". These records are what
stop a later session from re-proposing what was already rejected.

## 5. Build the thinnest slice that runs

One path through the whole system that does something real, however small: a page that reads
from the database, a command that produces output. With it:

- `scripts/agent/check` holds the real commands (types, lint, tests) and passes.
- CI runs that same command and nothing else.
- `AGENTS.md` is filled in: what this is, the commands to check, test one file and run the app.
- At least one test that goes through the slice from the outside.
- If the design depends on a boundary between parts, enforce it now with a lint rule or a small
  structural test, while there is almost no code to fix.

## 6. Hand over to the normal loop

Use the `spec` skill to file the first epic and its first few tasks in the inbox. Finish with:
the decisions made, the decisions still open, what runs, and the steps only the user can do
(accounts, keys, domains, access).

## Gotchas

- A long specification written up front feels like progress and is where errors enter. Keep
  the spec about what must be true for users; leave the technical detail to each task.
- Do not scaffold features nobody asked for. Every generated file is a pattern the next
  session will copy.
- Feature flags, a rollback path and restore-tested backups matter once there are users. Note
  them as inbox tasks; do not build them on day one.
- State spread across ad-hoc conditions is where passing tests and real bugs coexist. Where the
  product has modes or steps, model them explicitly from the start.
