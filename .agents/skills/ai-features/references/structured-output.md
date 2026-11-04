# Structured outputs, checks and the re-ask

Sources: a research pass of 2026-09-29 on structured output, retries, confidence and review thresholds, with the providers' structured-output pages as read that day (marks as in `prompting.md`: M measured, V vendor, P practitioner, O opinion). Provider limits change: check the page for the model you use.

## What each route guarantees

Strict structured output guarantees the shape, not the truth. OpenAI reported 100% schema adherence in strict mode against under 40% before it (gpt-4o-2024-08-06 against gpt-4-0613; V) and still warns that structured outputs "can still contain mistakes". The best exact-value accuracy across 21 models was 83.0% (Structured Output Benchmark, arXiv 2604.25359; M), and constrained decoding fixes structure, not content (arXiv 2609.23742; M, preprint). So every value is checked, and accuracy is measured on values, not on validity.

What each route does, as read on 2026-09-29:

- **OpenAI** (`response_format` json_schema with `strict: true`; the Responses API uses `text.format`): the root is an object, every field is required (`null` unions emulate optional), `additionalProperties` is false; limits of 5,000 properties, 10 levels of nesting and 1,000 enum values in total. A refusal arrives in `message.refusal` with a normal finish reason. An SDK may drop that field (the Vercel AI SDK's OpenAI package dropped it when this was researched, on 2026-09-29), so check what your installed version surfaces and read the raw response if it does not.
- **Anthropic** (`output_config.format`; the older `output_format` is deprecated): at most 24 optional and 16 union-typed parameters per request (so `["string", "null"]` counts), no numeric or length constraints, `minItems` only 0 or 1, enums of primitive values only, required properties come out first, and the capitalisation of enum values is not guaranteed (compare them case-insensitively). Not combinable with citations or prefilling. A refusal is HTTP 200 with `stop_reason: "refusal"`, and it is billed.
- **Gemini** (`responseMimeType` with `responseJsonSchema`): key order follows the schema for 2.5 and later. Google's API reference (updated 2026-09-23) marks `responseJsonSchema` deprecated in favour of `responseFormat`: check which your SDK sends.
- **DeepSeek** has JSON mode only: the schema goes in the prompt with the word "json" and an example, and the API "may occasionally return empty content", which is an `empty` outcome.
- **Libraries** differ in what they do with invalid output, and none publishes a success rate (read from their code and docs; O). Instructor appends the failed reply and the validation error and retries one to three times by default. Pydantic AI's output retry budget "defaults to 1", and an issue report says every failed attempt stays in the conversation, so cost grows with each retry (P). LangChain v1's `ToolStrategy` re-asks on errors by default, and its legacy `RetryWithErrorOutputParser` resends the prompt, the completion and the error. The Vercel AI SDK 7's `generateText` with `Output.object` throws `AI_NoObjectGeneratedError` and does not re-ask; its `maxRetries` retries failed API calls, not invalid output.

## The portable schema profile

One schema per task is the single source: each route's schema is derived from it, and every answer is validated against the full schema again.

- The root is a strict object, every field required, no extra properties, no recursion.
- Absence is an enum value (`not_stated`, `unclear`), never a `null` union, which Claude's strict mode limits and which blurs "not stated" with "none". OpenAI warns that forcing a schema "can result in hallucinations if the input is completely unrelated to the schema" (O), so measure `not_stated` as a class of its own.
- Closed enums over free text. Values unique regardless of capitalisation.
- Descriptions are instructions: the model reads them, and renaming a field changed one test's accuracy from 4.5% to 95% (Instructor's test; V). Rewriting a schema's descriptions raised accuracy by up to 64.7% on one extraction benchmark (PARSE, EMNLP 2025 Industry, arXiv 2510.08623; M).
- Flatten where possible. A catalogue too large for an enum (OpenAI allows 1,000 values) becomes candidates retrieved by code and offered as a per-request list with a "none of these" value; choosing among candidates beat pairwise matching by 16.02% F1 on average, though position bias remains (Wang et al., COLING 2025, arXiv 2405.16884; M).
- The first call with a new schema pays a compile cost on some routes (typical schemas under 10 seconds at OpenAI, in 2024): warm schemas at deploy time. Anthropic caches compiled grammars for 24 hours from last use.

## Evidence before value

Each fact is a pair: `<fact>_evidence`, the shortest phrase of the input that states it, copied exactly, then `<fact>`, the value. Required fields come out in schema order, so the model commits to a quote before it picks a label. That is the extraction form of what helped when reasoning came before the answer: a JSON mode that put the answer key before the reason key cut reasoning accuracy (Tam et al., EMNLP 2024 Industry, arXiv 2408.02442; M), and putting the reasoning field before the answer gave up to +4% (JSONSchemaBench, arXiv 2501.10868; M), while letting a model reason freely before a constrained answer gained up to 10 points (CRANE, ICML 2025, arXiv 2502.09061; M). That evidence is on English math, symbolic and classification tasks, so A/B evidence-first against value-only with a paired comparison.

Code aligns the quote with the text the model read: exactly, then fuzzily after normalising if the labelled set shows it helps (Google's LangExtract matches exactly, then fuzzily at a 0.75 threshold). A value whose quote cannot be found is fed back once and then goes to review. For generated text, the same idea: the model chooses and orders facts, and code renders every number.

## Checks in code

The checks (a version and a function) state what the schema cannot.

- **What belongs:** grounding (evidence present when the value is stated, absent when it is `not_stated`, found in the text the model read, and found outside any sentence addressed to a model; see `injection.md`); rules across fields; for generated text, no digit or number word outside a placeholder (allow the number words that are also articles or pronouns, such as "one").
- **What does not:** a disagreement with a field code parsed from the source (a price, a date, a count). A re-ask invites the model to change an honest reading until the check passes; LangChain's own example "fixes" a 10 out of 10 rating by answering 5 to satisfy `le=5`. So the answer is stored and held for a person, and the disagreement becomes a data-inconsistency flag.
- **How a problem is worded:** `{ path, message }`, the message naming the value seen and what is admissible: `is "double billed", which does not appear in the ticket: copy the words exactly as the ticket writes them, or set category_evidence to "" and category to "not_stated".` Feedback that names the failing field, the value observed and the admissible alternatives raised repair success by 42 and 44 points on two small models in a game-agent loop, most of it from the alternatives (arXiv 2607.14167; M, preprint). A library's own messages may not name the value seen (zod 4's enum message did not in the version tested), so build the message in code, as the sketch does.
- **Bump the checks' version whenever a check changes** (it is part of the prompt version, so of every cache key).

## The re-ask

Re-ask at most once. The research found libraries defaulting to one to three retries, and no published measurement of how often one re-ask fixes a schema-invalid output under today's strict modes.

- The second request is a fixed context, never the history: the input, the answer that failed, and "Your answer did not pass validation:" with one `- path: message` line per problem, then "Answer again with the complete JSON object." The history grows with every retry otherwise.
- The second answer passes the same schema and the same checks, so a changed value is grounded again. If you allow more than one re-ask, stop when the same invalid answer comes back twice.
- What still fails is `invalid`, with its problems, for review. Guarded reflection cut extraction errors by 92% within the first retry compared with a plain re-prompt (PARSE, arXiv 2510.08623; M), while a model asked to check itself with no outside signal got worse (arXiv 2310.01798; M).
- Deterministic repair comes before rejecting, and is logged: digit scripts to ASCII digits, the string "5" to the number 5, in code. A meaning is never "fixed" in code.

## Outcomes and errors

| Result                    | Means                                                                               | The caller                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ok` with a value         | valid and checked                                                                   | stores the value, with the id of the stored answer if the project keeps one                                                                                 |
| `invalid` with `problems` | failed the schema or the checks after the re-ask                                    | review, never the value                                                                                                                                     |
| `refusal`                 | the provider refused (Claude's `stop_reason`, OpenAI's `refusal`, a content filter) | review; refusals are billed                                                                                                                                 |
| `truncated`               | the output budget ran out (finish reason `length`)                                  | review, and raise the output budget if it recurs: reasoning models spend the budget before the answer                                                       |
| `empty`                   | no text (DeepSeek's empty content, a reasoning model with no room left)             | review                                                                                                                                                      |
| throws                    | no answer at all                                                                    | retryable (timeout, aborted, rate limited, unavailable): let it propagate so the queue or orchestrator retries; unauthorized, no credit, rejected: a person |

Read the finish reason and the refusal field before the output: with no text, some SDKs' output getters throw. Let exactly one layer retry (the SDK's `maxRetries`, the queue, or your wrapper), not several stacked; where a person waits, make one attempt within a deadline.

## Confidence and review thresholds

- A model's stated confidence does not tell right from wrong. Stated values cluster at 80 to 100 and are overstated (Xiong et al., ICLR 2024, arXiv 2306.13063; M). In field extraction with GPT-4o on 55-field invoices, token probabilities (AUC 0.705), stated confidence (0.692) and agreement across five samples (0.744, at five times the cost) all separated right from wrong poorly (arXiv 2606.24420; M, workshop paper). Agreement cannot catch an error the model makes every time (Farquhar et al., Nature 2024; M).
- What worked: two structurally different calls plus signals outside the model reached AUC 0.928 in the same study. The signals are grounding, agreement with parsed fields, whether a re-ask was needed, and a second call on critical fields if the budget allows it. Token probabilities are not portable (Anthropic exposes none), so design nothing around them.
- Thresholds are set per field on the development split: accept items only while an upper confidence bound on the error among them stays at or below the target, report the coverage, and confirm on the test split (Angelopoulos and Bates, arXiv 2107.07511; O, a method with proofs). Certifying at most 5% error needs 59 accepted items with none wrong (computed). Keep numeric and free-text fields on separate thresholds. Audit a random sample of accepted items in production: the review queue is a biased sample of hard cases.

## Sketch 2: a structured answer validated and re-asked once

A sketch, not a library. `ask` is the project's one wrapper around the provider SDK (AI SDK, LangChain or a provider client), returning the text and why the model stopped; it builds on sketch 1. Not shown: the answer cache (store validated answers only, under the key in sketch 1), the per-call log line (ids, versions, counts and paths only), and the evidence alignment above.

```ts
// SKETCH, not a library. Builds on sketch 1. `ask` stands for the project's one wrapper around the
// provider SDK (AI SDK, LangChain or a provider client): it returns the text and why the model stopped.
import { z } from 'zod';
import type { TicketFacts } from './prompt';

export type Problem = { path: string; message: string };
export type Message = { role: 'user' | 'model'; text: string };
export type Raw = { text: string; finish: 'stop' | 'length' | 'refusal' };
export type Result<T> =
  | { outcome: 'ok'; value: T }
  | { outcome: 'invalid'; problems: Problem[] }
  | { outcome: 'refusal' | 'truncated' | 'empty' };

type Checked<T> = { value: T } | { problems: Problem[] };

function validate<T>(
  text: string,
  schema: z.ZodType<T>,
  checks: (value: T) => Problem[],
): Checked<T> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      problems: [
        {
          path: '(root)',
          message: 'is not valid JSON: answer with the JSON object only.',
        },
      ],
    };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // zod's messages name what is admissible but not always the value seen (zod 4 does not), so add it.
    const seen = (path: PropertyKey[]) =>
      path.reduce<unknown>(
        (v, key) =>
          (v as Record<PropertyKey, unknown> | null | undefined)?.[key],
        json,
      );
    return {
      problems: parsed.error.issues.map((i) => {
        const got = seen(i.path);
        return {
          path: i.path.join('.') || '(root)',
          message: `${i.message}; received ${got === undefined ? 'nothing' : JSON.stringify(got)}`,
        };
      }),
    };
  }
  const problems = checks(parsed.data);
  return problems.length === 0 ? { value: parsed.data } : { problems };
}

export async function askValidated<T>(o: {
  ask: (messages: Message[]) => Promise<Raw>;
  input: string; // the rendered user turn
  schema: z.ZodType<T>;
  checks: (value: T) => Problem[]; // what the schema cannot state
  maxReasks: 0 | 1;
}): Promise<Result<T>> {
  let messages: Message[] = [{ role: 'user', text: o.input }];
  let problems: Problem[] = [];
  for (let attempt = 0; attempt <= o.maxReasks; attempt += 1) {
    const raw = await o.ask(messages); // a transport error throws here: let it reach whatever retries
    if (raw.finish === 'refusal') return { outcome: 'refusal' };
    if (raw.finish === 'length') return { outcome: 'truncated' };
    if (raw.text.trim() === '') return { outcome: 'empty' };
    const checked = validate(raw.text, o.schema, o.checks);
    if ('value' in checked) return { outcome: 'ok', value: checked.value };
    problems = checked.problems;
    // The re-ask is a fixed context, never the accumulated history: the input, the failed answer, what was wrong.
    messages = [
      { role: 'user', text: o.input },
      { role: 'model', text: raw.text },
      {
        role: 'user',
        text: `Your answer did not pass validation:\n${problems.map((p) => `- ${p.path}: ${p.message}`).join('\n')}\nAnswer again with the complete JSON object.`,
      },
    ];
  }
  return { outcome: 'invalid', problems };
}

// Each problem names the field, the value seen and what is admissible: the feedback that repairs best.
export function checkPairs(v: TicketFacts, textRead: string): Problem[] {
  const pairs = [
    ['category_evidence', 'category'],
    ['urgency_evidence', 'urgency'],
  ] as const;
  return pairs.flatMap(([e, f]): Problem[] => {
    const found = v[e];
    const value = v[f];
    if (found === '' && value !== 'not_stated') {
      return [
        {
          path: e,
          message: `is "", but ${f} is "${value}": copy the words of the ticket that state it, or set ${f} to "not_stated".`,
        },
      ];
    }
    if (found !== '' && value === 'not_stated') {
      return [
        {
          path: e,
          message: `is ${JSON.stringify(found)}, but ${f} is "not_stated": choose the value this evidence states, or set ${e} to "".`,
        },
      ];
    }
    if (found !== '' && !textRead.includes(found)) {
      return [
        {
          path: e,
          message: `is ${JSON.stringify(found)}, which does not appear in the ticket: copy the words exactly as the ticket writes them, or set ${e} to "" and ${f} to "not_stated".`,
        },
      ];
    }
    return [];
  });
}
```

The call site stores a value from an `ok` result and nothing else:

```ts
const result = await askValidated({
  ask,
  input: renderTicket(ticket),
  schema: TicketFacts,
  checks: (facts) => checkPairs(facts, textRead(ticket)), // the text the model read, not the raw text
  maxReasks: 1,
});
if (result.outcome === 'ok') await saveFacts(ticket.id, result.value);
else await queueForReview(ticket.id, result); // invalid, refusal, truncated or empty: no value
```

Test it against a scripted stub `ask`:

1. A value outside the enum: the second request carries the input, the failed answer and a line naming the field, the value received and the admissible values; the second answer is returned.
2. Evidence not found in the text: the problem names the field and the words sent.
3. Still invalid after the re-ask: exactly two requests, outcome `invalid`, no value, and nothing cached.
4. `maxReasks: 0` asks once; finish reasons `refusal` and `length`, and empty text, are their own outcomes; text that is not JSON is a problem at the root; a transport error propagates.
