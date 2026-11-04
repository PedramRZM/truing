---
name: ai-features
description: Build, change and review features that call language models, from prompts, structured outputs and re-asks to evaluations, prompt-injection defences, cost and caching, and whether an agent is worth building. Use when writing or changing code, prompts, schemas or evals that call an LLM, choosing a model or setting, or reviewing any of these.
---

# ai-features: building features that call language models

The project's own conventions come first: its AGENTS.md or CLAUDE.md, the wrapper it already has around the provider SDK, and the way its existing AI code is laid out. This skill is a set of defaults for calling models safely and measurably in any stack (the Vercel AI SDK, LangChain or LangGraph, a provider's own SDK). Where it disagrees with a vendor's guide, a blog post, a library's defaults or a habit, follow it unless the project's own evaluation says otherwise; where a reference marks a rule as opinion, the labelled set decides.

The practice comes from a research pass on prompting, context engineering and agents (2026-09-29): the makers' prompting guides, measured papers (cited by arXiv id in the references) and open-source agent harnesses read from source. Each claim carries a mark: M measured with a published method, V measured by a vendor about its own product, P a practitioner's report, O opinion.

## The rules that are never broken

1. **Output is validated against a schema.** Every answer is checked against a schema and then by checks in code, in one wrapper; nothing parses model text anywhere else. A strict structured-output mode guarantees the shape, not the truth: across 21 models the best exact-value accuracy was 83% (Structured Output Benchmark, arXiv 2604.25359, M).
2. **Nothing unvalidated is stored.** Only a validated result carries a value. An invalid, refused, truncated or empty answer goes to review or a fallback with its problems, never with a value, and an answer cache keeps validated answers only (sketch 2).
3. **Numbers a user sees come from code or the database, never from model text.** Prices, counts, dates, scores and metrics are parsed or computed by code and shown through the app's own formatters. Model text that reaches a page carries placeholders code fills, and a check rejects any digit or number word outside them.
4. **An evaluation comes before a step ships, and again after any change.** No task is called by a job or a page until a labelled set has measured it at its current prompt version: per-field accuracy with intervals, attacks tried and succeeded, and cost. A change to the instructions, glossary, schema, checks, settings or model is measured again, and so is a change to the code that renders the prompt or cleans the input (sketch 3).
5. **No personal data in prompts, logs or traces.** A model reads only the text the feature needs, with personal data removed first, and never an account's or a visitor's data. Logs and traces hold ids, versions, counts and field paths. A prompt, an input, an answer or a validation message (which quotes the input) goes into one only where the project has decided that store may hold it, and then without personal data.

Two more shape every step. **Code owns every number and decision; the model reads free text and picks labels:** parse what the source already structures, and let the model read only what the free text alone says. And **control flow is code by default:** a fixed chain of calls with checks between them, not a model choosing its next step. An agent has to earn its place (below).

## Adding or changing an AI step

1. **Look at the data first.** Read at least 30 real items and write down what goes wrong in each (open coding), then group the notes into failure types (axial coding). Decide what the source already structures, which code parses, and what only the free text says, which is all the model reads.
2. **Label before prompting.** One person labels from a written guide before any model sees an item: stated, not-stated and misleading cases for every field, negated phrasing oversampled, injected-instruction cases included, a development split to tune on and a test split that never tunes anything.
3. **Write the task.** Instructions that carry the glossary as data. A strict schema with every field required, an explicit "not stated" value and evidence before the value it supports. A render step that puts the variable input last, cleaned and escaped as data, with a reminder after it. Checks in code for what the schema cannot state. Sketches 1 and 2; `references/prompting.md` and `references/structured-output.md`.
4. **Configure it.** The model and a fallback, an output budget with room for reasoning, a timeout and at most one re-ask. Prompt caching only when the prefix passes the provider's minimum (512 to 4,096 tokens by model on 2026-09-29), and batch only for backfills, never where a person waits (`references/cost.md`). Reasoning is the model's effort or thinking setting, measured, never "think step by step". A model the project has not used before runs once end to end first: a route can reject settings the others accept.
5. **Test it offline.** Snapshot the rendered prompt and read the diff of every refresh: a changed word shows there. Test the checks and the re-ask against a stub model; no test reaches the network.
6. **Evaluate it.** Per-field precision and recall with Wilson intervals, items fully right, injection attacks tried and succeeded, cost per 1,000 items and latency (sketches 3 to 5; `references/evaluation.md`). Compare a change with the run before it item by item, with an exact McNemar test, never field by field as if the fields of one item were independent.
7. **Wire the call site** to handle every outcome. Store a validated value; send anything else to review; hold for a person an answer from an input that addressed the model or hides tag characters, or that contradicts the glossary words the input writes or a field code parsed; let transport errors propagate to whatever retries. Where a person waits, make one attempt within a deadline, then answer without the model.
8. **Review.** Ask the `reviewer` subagent, given `references/review.md`, and fix one finding at a time. Record the prompt version, the evaluation and the cost where the project records such things (the task, the pull request), and what surprised you in its learnings file.

## The sketches

Five short TypeScript and zod sketches sit in the references. They are sketches, not a library: nothing to install, and every name, path and the schema converter is the project's to adapt. They use support-ticket extraction as the neutral example. When this skill was written they were typechecked and run offline against stub models under both zod 3 and zod 4; those tests are described in the references, not shipped.

| #   | Sketch                                                   | Where                  | What it shows                                                                                                                                                      |
| --- | -------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A versioned prompt that carries the glossary             | `prompting.md`         | the glossary as data rendered in a fixed order, the prompt version as a content hash, a new phrase as a new version, the answer-cache key, the variable input last |
| 2   | A structured answer validated and re-asked once          | `structured-output.md` | schema failure and check failure fed back once, naming field, value seen and what is admissible; one outcome per call; nothing stored unless validated             |
| 3   | An evaluation run with intervals and a paired comparison | `evaluation.md`        | per-field Wilson intervals, per-class precision and recall, items fully right, attacks tried, exact McNemar with the 5% level split across tests, the FAIL line    |
| 4   | A defence against instructions inside the input          | `injection.md`         | cleaned copy, escaping as data, the reminder, evidence refused when it appears only in a note to the model, answers held for a person, witness-value injections    |
| 5   | A cost report                                            | `cost.md`              | per-call log lines summed per task, prompt version and model: calls, cache hits, requests, tokens by price, cost per 1,000, latency                                |

## When an agent is worth building

Start with one well-built call. If the steps are known, use a fixed workflow: code owns the control flow and the model fills slots (validation, one re-ask, optional voting, a review queue). Build an agent only when all of these hold: the steps cannot be listed in advance and a fixed workflow fails the evaluation on real requests; there is a check on the end state; the extra tokens and latency are affordable; and a wrong action's damage is capped, with read-only tools, writes gated by a person, and a cap on steps, tokens and time. Judge it by pass^k (every one of k attempts succeeds) and by cost against accuracy, never by one run. The same list judges an agent that already exists.

Each step up costs something measured:

- A fixed three-phase pipeline matched the open-source agents of its time on SWE-bench Lite at $0.70 an issue (Agentless, arXiv 2407.01489, M, preprint). Simple baselines matched complex agents, with costs almost two orders of magnitude apart for similar accuracy (Kapoor et al., "AI Agents That Matter", arXiv 2407.01502, M).
- An agent used about four times the tokens of a chat and several agents about fifteen times, for +90.2% on Anthropic's own research evaluation (Anthropic, 2025-06-13, V). Retail agents passed 8 of 8 attempts under 25% of the time (tau-bench, arXiv 2406.12045, M).
- In a 2026 study several agents lost 39% to 70% on sequential planning and gained up to 81% on decomposable financial reasoning (arXiv 2512.08296, M, preprint); 14 failure modes of multi-agent systems are catalogued in arXiv 2503.13657 (M).

Patterns that fit without an agent: prompt chaining with gates in code; routing on deterministic triggers (a failed schema, contradictory fields), not on the cheap model's own judgement; parallel sections for latency; voting only in a borderline band, and only if measured; an evaluator-optimizer whose evaluator is code. Keep tools few and distinct, keep writes single-threaded, put a person in the loop at failure thresholds and before anything hard to undo, and re-test every piece of scaffolding when the model changes.

## Evidence to produce

Use the project's own commands (its scripts, Makefile, AGENTS.md or CLAUDE.md name them).

| Evidence                                                                                                       | Network, cost                                      |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| lint, typecheck and the tests that cover the AI code, with stub models and a guard that fails any real request | none                                               |
| refresh the rendered-prompt snapshots, then read the diff                                                      | none                                               |
| score stored evaluation runs again against today's labels                                                      | none                                               |
| the cost report from the per-call log lines                                                                    | none                                               |
| run the evaluation on the labelled set at the new version                                                      | paid model calls: only with the person's agreement |

Anything that calls a paid model, from a one-item smoke test to a full evaluation, runs only when the person has agreed to the spend and to the data it sends. Write run outputs to a git-ignored folder, and copy a run that a note quotes into that note's evidence.

## Read the reference you need

| Reference                         | Read when                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `references/prompting.md`         | writing or changing instructions, the glossary, examples or settings; context engineering; the 20 popular claims checked |
| `references/structured-output.md` | designing a schema, writing checks, the re-ask, outcomes and errors, confidence and review thresholds                    |
| `references/evaluation.md`        | a labelled set, an evaluation run, comparing two versions, the gate, model judges                                        |
| `references/injection.md`         | anything that reads text a third party wrote: users, uploads, retrieved pages, papers                                    |
| `references/cost.md`              | choosing a model or settings, prompt caching, batch, latency where a person waits, a cost report                         |
| `references/review.md`            | reviewing an AI change, yours or someone else's; what evidence it must carry                                             |

Library facts change. Before relying on memory, check the installed SDK's version and its docs (Context7 or the official pages) for structured-output, refusal, caching and usage-reporting behaviour.
