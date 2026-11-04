# Cost, caching and latency

Sources: a research pass of 2026-09-29 on caching, cost and latency, with the providers' caching, batch and pricing pages as read that day (marks as in `prompting.md`). Prices, minimums and defaults change often: the figures below are dated, and the provider's page decides.

## What a call costs

- **Price it at the provider's current list**, from its price page or the gateway's live price endpoint, and date the price book. A model with no price logs a null cost, never a guess. Reconcile the cost report against the provider's invoice each month: in the pass, a gateway's catalogue priced one model at less than half its live price.
- **The model family moves cost more than the price list shows.** The same text costs a different number of tokens on different tokenizers (`prompting.md`), so compare models by cost per item on your own inputs, not by price per million tokens.
- **Output and reasoning tokens drive both cost and time.** They were 30 to 92% of each measured call's cost, and output costs 3 to 8.3 times input at the makers' prices. Reasoning tokens are billed as output at OpenAI, Anthropic and Google. Cutting half the output tokens may cut about half the latency, while cutting half the prompt gives a 1 to 5% improvement (OpenAI's latency guide; O). Defaults differ by model (some reason by default, one family rejects disabling thinking): set the reasoning setting explicitly per step, choose it on the labelled set, and leave room for it in the output budget.

## Caching

Two different caches, both keyed exactly.

- **The answer cache:** the SHA-256 of the task, the prompt version, the model with its options and the rendered input (`cacheKey` in sketch 1). A hit makes no request and costs nothing; only validated answers are stored. No semantic cache: its precision was 0.52 in its recommended setup (MeanCache, arXiv 2403.02694; M), and static similarity thresholds give no correctness guarantee (vCache, arXiv 2502.03771; M), so "papers after 2019" and "papers after 2021" must not share an answer. Normalise text before rendering, so text that differs only in invisible marks is one question.
- **The providers' prompt caches**, for the stable prefix. They need a byte-identical prefix above a minimum, and the schema, the effort setting and the tools are part of the prefix. As read on 2026-09-29:

  |                | Anthropic                                                                                                                                           | OpenAI                                                                    | Gemini                                                                            | DeepSeek                                 |
  | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
  | Switched on    | opt-in `cache_control` (up to 4 breakpoints, or automatic placement)                                                                                | automatic; `prompt_cache_key` helps routing                               | implicit on 2.5 and later ("no cost saving guarantee"); explicit `cachedContents` | automatic disk cache                     |
  | Minimum prefix | 512 tokens: Opus 5.5, Opus 5, Sonnet 5.5, Fable 5 and 5.1; 1,024: Sonnet 5; 4,096: Haiku 4.5                                                        | 1,024 for GPT-5.6 and later; earlier models: "varies by request settings" | 4,096 for 3.5 to 3.8 Flash; 2,048 for 2.5 Flash and Pro; Flash-Lite not listed    | none documented                          |
  | Lifetime       | 5 minutes, refreshed on use; a 1-hour option                                                                                                        | 30 minutes for GPT-5.6 and later                                          | implicit not stated; explicit 1 hour by default                                   | "a few hours to a few days", best effort |
  | Write price    | 1.25 times input (5 minutes), 2 times (1 hour)                                                                                                      | 1.25 times for GPT-5.6 and later; earlier free                            | implicit none; explicit storage at $1.00 per million tokens per hour              | none                                     |
  | Read price     | 0.1 times input (Opus 5.5: 0.05)                                                                                                                    | 0.1 times for GPT-5.x                                                     | about 10% of input (a Flash-Lite price table)                                     | about 2% of the miss price (Flash)       |
  | What breaks it | order is tools, system, messages; also `tool_choice`, images, thinking or effort changes, and the structured-output schema (`output_config.format`) | model, tools, the schema (`text.format`), `reasoning.effort`, verbosity   | any change to the prefix                                                          | the prefix must match exactly            |

  Shorter prompts than the minimum "cannot be cached, even if marked with `cache_control`" (Anthropic). A cache entry only becomes available after the first response begins, so send one request, then fan out. Above about 15 requests a minute per prefix, OpenAI may route overflow elsewhere: partition `prompt_cache_key`. Set the prompt-cache option on a task only when its prefix passes the model's minimum.

- **A longer, useful, cached prefix can cost less than a short one.** At a model priced at $0.22 input, $0.022 cached input and $1.32 output per million tokens, per 1,000 calls with 93 output tokens: a 700-token uncached prompt costs $0.28, a 1,450-token one $0.44, and the same 1,450 tokens with a cached 1,200-token prefix $0.20 (one write of that prefix costs $0.00033; sketch 5 reproduces all four). So grow the prefix past the minimum only with content the evaluation shows is useful, such as the glossary and examples.
- **Cache privacy.** Prompt caching was detected in 8 of 17 API providers and global cache sharing in 7 (Gu et al., ICML 2025, arXiv 2502.07776; M). Keep nothing secret in the prefix; the system prompt is not a secret anyway (OWASP LLM07).
- **Cache hit rate is the production metric** for anything that loops over a long prefix ("the KV-cache hit rate is the single most important metric for a production-stage AI agent", Manus, 2025-07-18; P). At prompts of about 1,000 tokens caching lowers cost more than latency: Anthropic's own figure for a 10,000-token prompt is 1.6 s to 1.1 s (V).

## Batch, routing, and a person waiting

- **Batch halves the cost** at OpenAI, Anthropic and Gemini (Anthropic's discount stacks with caching; OpenAI's batches complete within 24 hours; OpenAI Flex gives batch prices on the synchronous API, in beta), and DeepSeek halves its price off-peak. Use it for backfills: the first extraction over a corpus, re-extraction after a prompt or model change. Never use it where a person waits. Choose the model and the reasoning setting first: they move cost by multiples, batch by half.
- **Cascades and routers need in-domain labels.** Routers trained on chat-arena data did no better than random on MMLU and GSM8K without in-domain labels (RouteLLM, ICLR 2025, arXiv 2406.18665; M), and a learned cascade (FrugalGPT, arXiv 2305.05176; M) needs labelled in-distribution examples. Report accuracy against cost, not either alone: for similar accuracy the cost can differ by almost two orders of magnitude (Kapoor et al., arXiv 2407.01502; M).
- **A person waiting:** a small model with no or minimal reasoning and a capped output; independent work in parallel (fetch, parse, then the database lookup beside the model call); streaming, which is the most effective way to make users wait less (OpenAI; O); a second, hedged request to another provider after the measured 95th percentile, which adds about 5% load and cut one system's 99.9th percentile latency from 1,800 ms to 74 ms with 2% more requests (Dean and Barroso, "The Tail at Scale", CACM 2013; M); and a deadline after which the step answers without the model. Time to first token varies by orders of magnitude with the reasoning setting: for one model about 10,000 input tokens took 0.715 s without reasoning, 2.3 s at medium and 107 s at maximum (Artificial Analysis, 2026-09; M, independent).

## The per-call line and the run report

Each call writes one structured log line (`info`, or `warn` for anything but ok): `task`, `promptVersion`, the requested model and the model that answered, a request id, `outcome`, `cached`, `attempts`, `latencyMs`, the input tokens split into uncached, cache read and cache write, and the output tokens with reasoning inside them, plus `problemPaths` or an error reason. The report computes cost from those tokens and a dated price book (sketch 5), so a corrected price can re-cost old lines. The line carries no prompt, no input, no answer and no validation message, which would quote the input. Take token counts from what the provider reports (the AI SDK's `usage`, LangChain's `usage_metadata`, the provider's `usage` object), not from an estimate: a bytes-per-token guess is wrong for non-English text.

A run's report sums the lines per task, prompt version and model: calls, calls answered from the answer cache, requests (first answers and re-asks), outcomes, tokens by price, the share of input read from the provider's cache, cost, cost per 1,000 calls, latency at the median and the 95th percentile. Put it next to accuracy and attack success, always: a cost without its accuracy, or an accuracy without its cost, is half an answer (Kapoor et al.).

## Sketch 5: a cost report

A sketch, not a library: per-call JSON lines in, one row per task, prompt version and model out. Prices are the project's, dated, per million tokens.

```ts
// SKETCH, not a library. The wrapper writes one JSON line per call (ids, versions, counts and tokens, never the
// prompt, input, answer or a problem's message); this sums them per task, prompt version and model.
import { z } from 'zod';

export type Price = {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}; // per million tokens; output includes reasoning
export type Prices = Record<string, Price>; // "provider/model" -> price, from the provider's price page, dated

const count = z.number().int().nonnegative();
const Line = z.object({
  msg: z.literal('model call completed'),
  task: z.string(),
  promptVersion: z.string(),
  model: z.string(),
  outcome: z.string(),
  cached: z.boolean(), // answered from the answer cache: no request, no cost
  attempts: count, // requests sent, the re-ask included; 0 for a cache hit
  latencyMs: z.number().nonnegative(),
  inputTokens: count, // uncached input
  cacheReadTokens: count,
  cacheWriteTokens: count,
  outputTokens: count, // reasoning included
});
export type Line = z.infer<typeof Line>;

export function costUsd(
  price: Price | undefined,
  u: Line,
  batch = false,
): number | null {
  if (!price) return null; // an unpriced model costs "unknown", never a guess
  const usd =
    (u.inputTokens * price.input +
      u.cacheReadTokens * price.cacheRead +
      u.cacheWriteTokens * price.cacheWrite +
      u.outputTokens * price.output) /
    1e6;
  return batch ? usd / 2 : usd;
}

const percentile = (xs: number[], q: number) =>
  [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(q * xs.length) - 1)];

export function costReport(lines: Iterable<string>, prices: Prices) {
  const groups = new Map<string, Line[]>();
  for (const text of lines) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue; // a plain-text startup line
    }
    const line = Line.safeParse(json);
    if (!line.success) continue;
    const key = JSON.stringify([
      line.data.task,
      line.data.promptVersion,
      line.data.model,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), line.data]);
  }
  return [...groups.values()].flatMap((calls) => {
    const [first] = calls;
    if (!first) return [];
    const sum = (pick: (c: Line) => number) =>
      calls.reduce((total, c) => total + pick(c), 0);
    const costs = calls.map((c) => costUsd(prices[c.model], c));
    const cost = costs.some((c) => c === null)
      ? null
      : costs.reduce<number>((total, c) => total + (c ?? 0), 0);
    const tokensIn = sum(
      (c) => c.inputTokens + c.cacheReadTokens + c.cacheWriteTokens,
    );
    const asked = calls.filter((c) => !c.cached).map((c) => c.latencyMs); // a cache hit's latency says nothing about the model
    return [
      {
        task: first.task,
        promptVersion: first.promptVersion,
        model: first.model,
        calls: calls.length,
        cachedCalls: calls.filter((c) => c.cached).length,
        requests: sum((c) => c.attempts),
        tokensIn,
        providerCacheShare:
          tokensIn === 0 ? 0 : sum((c) => c.cacheReadTokens) / tokensIn,
        tokensOut: sum((c) => c.outputTokens),
        costUsd: cost,
        costPer1000Calls: cost === null ? null : (cost / calls.length) * 1000,
        p50Ms: percentile(asked, 0.5),
        p95Ms: percentile(asked, 0.95),
      },
    ];
  });
}
```

Test it with the worked example above: 1,000 calls of 700 input and 93 output tokens give $0.277 per 1,000; with 1,450 input tokens, $0.442; with 250 uncached and 1,200 cache-read tokens, $0.204. Also check that a plain-text line is skipped, that a cache hit counts as a call with no requests and no latency in the percentiles, and that an unpriced model gives a null cost.
