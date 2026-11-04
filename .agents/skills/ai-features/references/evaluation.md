# Evaluations and the harness

Sources: a research pass of 2026-09-29 on evaluations, error analysis and statistics: practitioner guidance (Husain and Shankar; Anthropic's "Demystifying evals for AI agents", 2026-01-09), measured papers cited by arXiv id, and the statistics computed in the pass (checked again for this skill; marks as in `prompting.md`). The evaluation is the product: an AI step is as good as its measured accuracy on a hand-checked set of the product's own inputs, and a change is an improvement only if that set can tell it from noise.

## Error analysis comes first

- Read at least 30 real outputs yourself and write what went wrong in each (open coding). Group the notes into failure types (axial coding, "the most important step") and fix the most frequent first. Three issues caused over 60% of the problems in one practitioner's case (P), and practitioners who report evaluations spend 60 to 80% of their time here (Husain and Shankar; P).
- The criteria come after reading outputs: graders refine their criteria by grading ("criteria drift", Shankar et al., UIST 2024, arXiv 2404.12272; M). Write the labelling guide from the error analysis, then label.
- Look at inputs and outputs every day while a step is being built: "Look at samples of LLM inputs and outputs every day" (Yan et al., "What We've Learned From A Year of Building with LLMs", 2024; P), and "become one with the data" (Karpathy, 2019; O).

## The labelled set

- **Real items from the product's own population**, with personal data removed and a reference to the source kept. Your own evaluation on real inputs beats any leaderboard: Sutskever has described "this disconnect between eval performance and actual real-world performance" (interview, 2025-11-25; O). Synthetic items only where real ones cannot exist yet, and marked so.
- **Stratified so every field has stated, not-stated and misleading cases.** Oversample negated phrasing and the readings models get wrong, and sample the long tail: what the product will meet, not what is easy to find.
- **Three states per fact:** stated, not stated, inferred. `not_stated` is scored as a class of its own, because forcing a value where the text says nothing is the error a strict schema invites.
- **Injection cases from the start** (`injection.md`): witness values at the start, middle and end of the text, and benign imperatives that must not be flagged.
- **One expert labels from a written guide**, before any model sees the item; a subset is labelled twice. Every label changed after a run is listed with its reason. Where a careful reader can read the text two ways, the label accepts both.
- **A development split and a test split.** Tune prompts, examples and thresholds on the development split only. The test split never tunes anything, or it stops measuring anything.

## What a report carries

| Measure                                                                                                                 | Why                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prompt version, model with its settings, labelled set and its cut                                                       | a number without them cannot be compared or reproduced                                                                                                                                                |
| outcomes: ok, invalid, refusal, truncated, empty, error                                                                 | a call without a valid answer counts as wrong on every field, since the product stores nothing for it                                                                                                 |
| per field: accuracy with its 95% Wilson interval, and precision and recall per value with `not_stated` as its own class | accuracy alone is too coarse for extraction ("accuracy is too coarse a metric to be useful", Eugene Yan; O); recall was the weak side in one study of extraction from advertisements (GPT-4o 54.7; M) |
| items with every field right                                                                                            | ten fields at 95% each, independent, leave about 60% of items fully right                                                                                                                             |
| coverage above each field's review threshold                                                                            | what share goes out without a person                                                                                                                                                                  |
| attacks: k of n witness values reported                                                                                 | never "robust" (`injection.md`)                                                                                                                                                                       |
| cost per 1,000 items, tokens, latency at the median and the 95th percentile                                             | cost beside accuracy, always (`cost.md`)                                                                                                                                                              |
| the misses, item by item, for a person to read                                                                          | the next round of error analysis                                                                                                                                                                      |

## What a set of this size can show

Computed in the research pass and recomputed when this skill was written; the sketch's `wilson` reproduces the intervals.

| Situation                                                                    | Result                                                                                                                                    |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 190 of 200 right on a field                                                  | 95.0%, 95% interval 91.0 to 97.3% (Wilson); a normal-approximation interval is too narrow below a few hundred items (arXiv 2503.01747; M) |
| claiming "at least 95%" with one-sided 95% confidence                        | needs 196 of 200 ("at least 90%": 188)                                                                                                    |
| ten fields at 95% each, independent                                          | about 60% of items fully right (0.95 to the tenth power)                                                                                  |
| detecting a true 3-point gain between two prompt versions, paired, 80% power | about 430 to 1,130 items, depending on how many items flip                                                                                |
| 50 items, 45 right; 40 right                                                 | 78.6 to 95.7%; 67.0 to 88.8%                                                                                                              |
| 19 of 20 found for a rare class                                              | 76 to 99%                                                                                                                                 |
| certifying at most 5% error among accepted items                             | 59 accepted with none wrong, or 93 with one                                                                                               |
| 0 of 60, or 0 of 150, accepted items wrong                                   | upper bound 4.9%, or 2.0%                                                                                                                 |

Errors cluster by item, which widens field-level intervals: two fields of one item are not independent, and grouped errors can be "over three times" the naive standard errors (Miller, "Adding Error Bars to Evals", arXiv 2411.00640; M). So 200 items can show "about 95%", not "at least 95%". Decide before the first report what "95% field accuracy" means (the point estimate or the lower bound, per field or per item) and write it down.

## Comparing two versions

- Compare item by item on the same set. Count the items only the new version gets right and those only the old one gets right, and test the split with the exact McNemar test (`mcnemarExact`, `compare` in sketch 3): 8 against 2 is p = 0.109, not a gain; 6 against 0 is p = 0.031. The item is the unit because the fields of one item are not independent: three fields lost on two items are two items (p = 0.5), not six (p = 0.031). `compare` tests each field on its own and, when there are several, every field together, and splits the 5% level across those tests (Bonferroni), so ten fields are not ten chances of a false alarm. Frontier models tend to get the same items right and wrong, so pairing costs nothing and sees more.
- Models are not deterministic: repeat a run three times before believing a small difference, and report pass^k (all k attempts right) where a step must be consistent.
- **The gate, in three layers:**
  1. deterministic checks on every commit: schemas, grounding, snapshots, the number checks;
  2. golden items that must all pass: regression suites should pass "nearly 100%", and "20-50 simple tasks drawn from real failures is a great start" (Anthropic, 2026-01-09; P);
  3. on a prompt, glossary, schema, checks or model change, a FAIL on a statistically significant paired loss, and a person's acceptance of any smaller drop. A rule that "fails when accuracy drops below the last accepted report" would fail on noise.

  Gemini CLI tiers its evaluations the same way: always-pass evaluations block pull requests, nightly ones run three times, and a promotion needs seven clean nights (read from source; process, not measurement).

## Model judges

Use one only where code cannot check. A judge is itself evaluated: its agreement with held-out human labels (true and false positive rates), a different model family from the one judged (models favour their own text; Panickssery et al., NeurIPS 2024, arXiv 2404.13076; M), and both orders for pairwise judgements: with the answers swapped, GPT-4 stayed consistent 65.0% of the time and Claude-v1 23.8%, and padding an answer with repeated content fooled GPT-3.5 and Claude-v1 91.3% of the time (Zheng et al., NeurIPS 2023, arXiv 2306.05685; M). A judge in a language other than English needs its own labels: in one non-English study GPT-4o agreed with ground truth at only kappa = 0.54 (Hosseinbeigi et al., Findings of NAACL 2025; M).

## The harness

- One command runs the real pipeline on the labelled set and prints the report above, with each report stored under its prompt version. Re-runs of unchanged inputs cost no model call because answers are cached by input hash (sketch 1's key).
- Score saved runs again against today's labels with no model call, so a changed label does not need a paid re-run.
- The command an agent runs prints briefly: a few lines, FAIL first and on the same line as the reason, so a person or grep finds it (Carlini's C compiler project, 2026-02-05; V and P). Verification is only as good as the verifier ("nearly perfect, otherwise Claude will solve the wrong problem").
- Keep the evaluation tooling in the repository.

## Sketch 3: an evaluation run with intervals and a paired comparison

A sketch, not a library. `answer` runs the real pipeline for one input, the same wrapper the product uses, and returns its outcome with the validated value if there was one.

```ts
// SKETCH, not a library. `answer` runs the real pipeline for one input (the same wrapper the product uses)
// and returns its outcome with the validated value, if there was one.
export type Label = string | boolean;
export type Item<I> = {
  id: string;
  input: I;
  labels: Record<string, Label>; // set by a person from the written guide, before any model saw the item
  witness?: Record<string, Label>; // for an injected item: the wrong value its note asks for
};
export type Answer = { outcome: string; value?: Record<string, unknown> };
export type Rate = { right: number; total: number; low: number; high: number };
export type Right = Record<string, Record<string, boolean>>; // item id -> field -> was the answer right?

const Z95 = 1.959963984540054;

// 95% Wilson interval: stays honest at the sizes a hand-labelled set has (190 of 200 is 91.0% to 97.3%).
export function wilson(right: number, total: number): Rate {
  if (total === 0) return { right, total, low: 0, high: 1 };
  const p = right / total;
  const z2 = Z95 * Z95;
  const centre = p + z2 / (2 * total);
  const margin =
    Z95 * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  const scale = 1 + z2 / total;
  return {
    right,
    total,
    low: (centre - margin) / scale,
    high: (centre + margin) / scale,
  };
}

// Exact two-sided McNemar test on the items only one run got right (8 against 2: p = 0.109; 6 against 0: p = 0.031).
export function mcnemarExact(onlyNew: number, onlyOld: number): number {
  const n = onlyNew + onlyOld;
  if (n === 0) return 1;
  let logTerm = -n * Math.LN2; // P(X <= k) for X ~ Binomial(n, 1/2), built in log space
  let tail = 0;
  for (let i = 0; i <= Math.min(onlyNew, onlyOld); i += 1) {
    tail += Math.exp(logTerm);
    logTerm += Math.log(n - i) - Math.log(i + 1);
  }
  return Math.min(1, 2 * tail);
}

// Per value of one field: precision and recall, with not_stated a class of its own.
function classScores(
  field: string,
  items: readonly Item<unknown>[],
  answers: readonly (Record<string, unknown> | undefined)[],
) {
  const values = new Set<unknown>(
    [
      ...items.map((it) => it.labels[field]),
      ...answers.map((a) => a?.[field]),
    ].filter((v) => v !== undefined),
  );
  return [...values].map((value) => {
    const labelled = items.filter((it) => it.labels[field] === value).length;
    const answered = answers.filter((a) => a?.[field] === value).length;
    const both = items.filter(
      (it, i) => it.labels[field] === value && answers[i]?.[field] === value,
    ).length;
    return {
      value,
      labelled,
      answered,
      precision: answered ? both / answered : null,
      recall: labelled ? both / labelled : null,
    };
  });
}

export async function runEvaluation<I>(
  items: readonly Item<I>[],
  answer: (input: I) => Promise<Answer>,
) {
  const fields = Object.keys(items[0]?.labels ?? {});
  const right: Right = {};
  const outcomes: Record<string, number> = {};
  const answers: (Record<string, unknown> | undefined)[] = [];
  let succeeded = 0;
  let tried = 0;
  for (const item of items) {
    const result = await answer(item.input);
    outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
    answers.push(result.value); // no valid answer means wrong on every field: the product would store nothing
    right[item.id] = Object.fromEntries(
      fields.map((f) => [f, result.value?.[f] === item.labels[f]]),
    );
    for (const [f, witness] of Object.entries(item.witness ?? {})) {
      tried += 1;
      if (result.value?.[f] === witness) succeeded += 1;
    }
  }
  const count = (ok: (r: Record<string, boolean>) => boolean) =>
    Object.values(right).filter(ok).length;
  return {
    outcomes,
    fields: fields.map((field) => ({
      field,
      ...wilson(
        count((r) => r[field] === true),
        items.length,
      ),
      classes: classScores(field, items, answers),
    })),
    allRight: wilson(
      count((r) => Object.values(r).every(Boolean)),
      items.length,
    ),
    attacks: { succeeded, tried }, // "k of n attacks succeeded", never "robust"
    right,
  };
}

type Paired = { onlyNew: number; onlyOld: number; p: number };

// Two runs of one set, paired by item: the item is the unit, because the fields of one item are not independent.
export function compare(previous: Right, current: Right) {
  const ids = Object.keys(current);
  if (
    ids.length !== Object.keys(previous).length ||
    ids.some((id) => !(id in previous))
  ) {
    throw new Error('compare two runs of the same items');
  }
  const fields = [
    ...new Set(Object.values(current).flatMap((r) => Object.keys(r))),
  ];
  const paired = (rightIn: (r: Record<string, boolean>) => boolean): Paired => {
    let onlyNew = 0;
    let onlyOld = 0;
    for (const id of ids) {
      const now = rightIn(current[id] ?? {});
      const before = rightIn(previous[id] ?? {});
      if (now && !before) onlyNew += 1;
      if (before && !now) onlyOld += 1;
    }
    return { onlyNew, onlyOld, p: mcnemarExact(onlyNew, onlyOld) };
  };
  const tests: Record<string, Paired> = {
    ...(fields.length > 1
      ? { 'all fields': paired((r) => Object.values(r).every(Boolean)) }
      : {}),
    ...Object.fromEntries(fields.map((f) => [f, paired((r) => r[f] === true)])),
  };
  const alpha = 0.05 / Object.keys(tests).length; // 5% split across the tests: ten fields are not ten chances of a false alarm
  const shows = (t: Paired, loss: boolean) =>
    t.p < alpha && (loss ? t.onlyOld > t.onlyNew : t.onlyNew > t.onlyOld);
  const all = Object.values(tests);
  const verdict = all.some((t) => shows(t, true))
    ? 'worse'
    : all.some((t) => shows(t, false))
      ? 'better'
      : 'no significant difference';
  return { tests, alpha, verdict };
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
export const rate = (r: Rate) =>
  `${r.right}/${r.total} ${pct(r.right / r.total)} (${pct(r.low)} to ${pct(r.high)})`;

// One line, FAIL first, so a person or grep finds it.
export function formatComparison(c: ReturnType<typeof compare>): string {
  const head = c.verdict === 'worse' ? 'FAIL: worse' : c.verdict;
  const tests = Object.entries(c.tests).map(
    ([name, t]) =>
      `${name} ${t.onlyNew} to ${t.onlyOld}, p = ${t.p.toFixed(3)}`,
  );
  return `${head} (items only the new run got right to only the old, each test at p < ${c.alpha.toFixed(4)}): ${tests.join('; ')}`;
}
```

Test it against hand-made runs: `wilson(190, 200)` gives 91.0% to 97.3%; `mcnemarExact(8, 2)` gives 0.109 and `(6, 0)` gives 0.031; six items right before and wrong after on one field is `FAIL: worse` at p = 0.031; three fields lost on two items is "no significant difference" with p = 0.5; an item with no valid answer is wrong on every field; an item labelled `not_stated` that the model never says shows recall 0. The run costs a model call per item, so it runs only with the person's agreement; the comparison and the intervals run on stored results for free.
