# Reviewing an AI change

The checklist a fresh-context reviewer works through, and what an author checks before asking for it. Each item is judged pass, fix or cannot judge, and each fix cites file:line, the evidence, what it should be, and the rule it breaks (a reference here). Evidence is produced by the reviewer, never taken from the diff, the task notes or a report's own summary, and the reviewer never calls a model: spending is a person's decision. The project's own conventions win where they differ from these defaults.

## Evidence the reviewer produces

| Evidence                   | How                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the project's own checks   | lint, typecheck and the tests that cover the changed AI code, run offline: a command that would reach a model or the network is not run, and the report says so                                                                                                                                                                |
| what the model now reads   | the rendered-prompt snapshot diff, every changed word read one by one; a changed prompt whose snapshot did not change is a missing test or a missing render-version bump                                                                                                                                                       |
| the prompt version         | the version each changed task has now, from its snapshot or the project's version function, compared with the version the task's evaluation reports                                                                                                                                                                            |
| the evaluation, reproduced | stored runs scored again against today's labels with no model call, compared with the numbers the task claims; runs of another prompt version or model are not evidence                                                                                                                                                        |
| where outputs go           | call sites traced: grep for the project's wrapper and for direct SDK calls (`generateText(`, `generateObject(`, `streamText(`, `.invoke(`, `.stream(`, `withStructuredOutput(`, `chat.completions.create(`, `messages.create(`, `responses.create(`, `generateContent(`), then each result followed to what stores or shows it |
| what the lines hold        | a test that plants a marker in an input and finds it in no log line, span or trace, run if it exists; any new log line or trace attribute near a call read                                                                                                                                                                     |

## The rules that are never broken

1. **Validated output.** The only way to a model is the project's one wrapper; nothing parses model text elsewhere. The schema is a strict object with every field required, `not_stated` as an enum value and evidence before value, and the checks cover what the schema cannot state (grounding).
2. **Nothing unvalidated stored.** Only a validated result reaches a table, with the id of its stored answer if the project keeps one; every other outcome goes to review or a fallback with its problems; no value is rebuilt from `problems` or from raw text; a transport error propagates so whatever retries can retry it.
3. **Numbers from code or the database.** No number a user sees comes from model text: generated text uses placeholders code fills, and a check rejects digits and number words outside them (allowing words that are also articles or pronouns, such as "one"). Parsed fields come from the parser, never from the model.
4. **An evaluation before it ships.** A task newly called by a job or a page has a labelled evaluation at its current prompt version, with per-field accuracy and intervals, attacks and cost; a changed prompt, glossary, schema, checks, settings or model has a new one, compared with the old one item by item. A changed render or cleaning step must bump the render version, which changes the prompt version: check the diff for a render or cleaning change without that bump, and the snapshot for a prompt that changed under an unchanged version. A number from a different prompt version, or no report, is not verified.
5. **No personal data in prompts, logs or traces.** The prompt reads only the text the feature needs, with personal data removed; no line, span or trace carries personal data, and none carries a prompt, input, answer or validation message unless the project has decided that store may hold it.

## Prompt and context

- The instructions are the stable prefix: no date, time, id or input, and a test shows two calls share it byte for byte.
- One language, the input's own terms verbatim; the glossary as data with a rule and its reason per fact; no capitals, personas, tips or threats; each prohibition paired with what to do and why.
- Few rules; anything code can check lives in a check, not in the prompt.
- One item per call; a refinement sends state plus the newest words, never history.
- Reasoning set by the route's effort or thinking setting, measured; no "think step by step"; no reasoning requested in the answer on models that refuse it; no temperature tuning.
- Examples only if the labelled set showed a gain, never taken from the evaluation set.

## Schema and checks

- Each problem names the field, the value seen and what is admissible.
- A check that changed has a new checks version.
- Only what the model can fix by reading again is a check; a disagreement with a parsed field is held for a person, not re-asked.
- At most one re-ask, with a fixed context rather than the history.

## Task configuration and settings

- The model and fallback are the ones the step's measurements chose, or the change says why, with measurements; a model is pinned, not an alias that moves; a model the project had not used before ran once end to end.
- The output budget leaves room for reasoning; the timeout fits the path (a background job, or a request path with a deadline and a fallback that answers without the model); prompt caching is on only when the prefix passes the model's minimum.
- Control flow is code. An agent or model-chosen loop shows the criteria in the skill (steps cannot be listed, an end-state check, affordable cost and latency, capped damage) and caps on steps, tokens and time.

## Injection (for any text a third party wrote)

- The text is cleaned, escaped as data, in the user turn, with a reminder after it; the schema has an `instructions_to_ai` flag; evidence must appear outside sentences addressed to a model; an answer that contradicts the glossary phrases the input writes, a flagged input, or hidden tag characters wait for a person before they move anything downstream.
- The labelled set has witness-value injections at the start, middle and end, and benign imperatives; the report says k of n attacks succeeded.

## Evaluation practice

- The labels were set before any model saw the items, from a written guide; the test split tuned nothing; `not_stated` is scored as its own class; the misses were read.
- Rates carry Wilson intervals; a claimed gain or loss between versions comes from a comparison paired by item with its p-value, not from two percentages side by side, and not from item-fields counted as independent; small differences were run three times.
- The report names the prompt version, model and settings, the set and its cut, outcomes, cost per 1,000 and latency.

## Cost and logs

- Cost comes from provider-reported tokens split by price at a dated price book, and is reported beside accuracy.
- The answer cache is exact (no semantic match), and text is normalised before rendering.
- Batch only for backfills; a path a person waits on has a deadline and a fallback.

## Docs

- The project's AI documentation and decisions match what changed; the task or pull request records the prompt version, the evaluation and the cost; a surprise is a line in the project's learnings file.

## The report

Most severe first, under 400 words: broken rules, then evaluation gaps with the numbers the reviewer reproduced, then injection, then prompt, schema and settings, then cost and docs. One repair to make first. A last line: "ready" or "not ready: <the one thing>".
