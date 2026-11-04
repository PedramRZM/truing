---
name: ux-copy
description: Use when writing, changing or reviewing the text a person reads in a product UI (titles, buttons, labels, hints, errors, empty states, limits, notifications, page titles and descriptions), or when copy sounds machine-written, wordy, repetitive or apologetic. A calm, plain, second-person voice.
---

# ux-copy: the words a person reads in the UI

Rules for writing and reviewing interface text, and a process for what rules alone miss: repetition across a screen, internals shown to users, claims that say nothing, sentences that sound machine-written. The voice is a calm, direct expert friend who writes in plain words. It covers strings a person reads in the UI. It does not cover code, logs, tests, documentation or model prompts.

**The project's own voice guide and glossary win.** Look for them first: files under `docs/` about voice, tone, content or a glossary, `.claude/rules/`, the copy sections of CLAUDE.md or AGENTS.md, a copy lint, the message catalogues. Where the project differs from a rule below, follow the project and say so in your report. This skill fills the gaps. A fresh-context reviewer checks the result against this skill. `references/` holds the patterns, the review process and worked examples.

**Other languages.** The rules are language-neutral. The patterns in `references/patterns.md` and the script's hints are English. For another language, use the rules, the idea table and the read-aloud test, and take the patterns from the project's own guide for that language.

## The ten rules

1. **R1 Calm.** No exclamation marks, hype, alarm, jokes or emoji in product UI. Say it at the volume of the fact.
2. **R2 A fact or nothing.** A sentence that could sit on any product's page ("Powerful search for everyone") is cut or becomes a fact.
3. **R3 Answer first.** The verdict, then the reason, then the step.
4. **R4 One idea per sentence.** About 15 words, never over 25. A full stop where a semicolon, a dash or a parenthesis was.
5. **R5 Once per screen.** Title, lead, hint, button and notice are one set. An idea sits in one of them.
6. **R6 One word per idea.** Take the word from the glossary and use it everywhere. Remove or Delete, Sign in or Log in: decide once.
7. **R7 Nothing a user cannot check or act on.** No database, queue, model, threshold, window or version. A number stays only if it compares, limits or supports a verdict on the page.
8. **R8 The patterns.** A button is a verb that names the result, a label a noun, a title short. An error says what happened and what to do. A limit is a fact with a way forward. No apology, no "please", no "successfully".
9. **R9 Address.** "You", usually unsaid, with plain verbs. "We" for what the product did, never "I". Not "the user", not "the system".
10. **R10 Written down.** Numbers, dates and plurals come from formatters, never typed into a string. Sentence case, or the project's one case used everywhere. One kind of quote mark.

When a string passes all ten and still sounds wrong, read it aloud. If a calm expert friend would not say it across a table, rewrite it. Taste is the owner's call.

## The elements

Examples are illustrative. A project's glossary may fix other words.

| Element              | Form                                                                          | Example                       | Never                                                                        |
| -------------------- | ----------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| Page title           | a noun phrase, up to 5 words, no full stop                                    | Account settings              | a sentence, a slogan, a question                                             |
| Section title        | a noun phrase, up to 4 words                                                  | Billing history               | a verb phrase that repeats the lead                                          |
| Lead (under a title) | one sentence, up to 20 words, that adds what the title lacks, or nothing      | See how fresh each source is. | the title again, two sentences                                               |
| Button               | a verb of 1 to 3 words that names the result                                  | Save changes                  | a mood ("Got it!"), the mechanism ("Submit"), two actions in one label       |
| Link                 | where it goes                                                                 | View pricing                  | "here", "click here", "learn more"                                           |
| Field label          | a noun, above the field                                                       | Full name                     | a sentence, a colon                                                          |
| Hint                 | an example, or the one rule that prevents an error                            | At least 8 characters         | what the label already says                                                  |
| Chip, badge          | the value, up to 3 words                                                      | Draft                         | a sentence                                                                   |
| Confirmation         | the past-tense fact, up to 4 words, with an undo when it can be undone        | Changes saved                 | "successfully", "!"                                                          |
| Loading              | the work in progress, with an ellipsis                                        | Loading results…              | "Please wait"                                                                |
| Notification         | a title that names the event, a detail that says what changed in one sentence | Export finished               | a title that needs its detail to be understood                               |
| Accessible name      | the action and its object                                                     | Remove source {name}          | the control's role ("button"), a repeat of a visible label that adds nothing |

**Error: what happened, then what to do.** In the user's terms, as a fact. If a retry button sits beside it, the sentence does not say "try again". Name what is kept ("Your draft is still here."). Name a cause only when it is known and the user can act on it ("The connection dropped."). No "Something went wrong" when more is known, no "invalid", no blame, no apology.

**Empty state: what is empty, then one way forward.** Three kinds, three wordings: first use (`No saved searches yet. Save one from the results page.`), no results (`No results for "{query}"`), all clear (`Nothing new.`, no button).

**Limit: the limit as a fact, then the way forward.** "Yet", "for now" and "unfortunately" about what the product does not do say "broken" or "unfinished". A boundary reads as scope: "Import works with PDF files. Choose a PDF." "Yet" stays for the user's own state ("You haven't saved a search yet.") and for data that will exist once the next step is taken.

## Writing or changing copy

1. **Open the screen's whole set.** Every string a person reads on it: copy files, literals in components, definitions in shared packages, notification kinds, error maps, page metadata. List each with its element (title, lead, hint, button, notice) and the one idea it carries. A new string is judged beside the others, never alone.
2. **One string per idea.** Keep an idea in the highest element (title, then button, then lead, then hint, then notice) and delete or fold the rest. A promise ("We'll email you when it's ready") appears once on a screen, and again only where the user decides again.
3. **Cut what the user cannot use.** Could they decide differently, or check it on the page? Thresholds, windows, versions, the queue, the database, the model: out. A figure stays only if it compares, limits or supports a verdict on the page.
4. **Write from the idea, in the user's words**, from the glossary. With no glossary, choose one word per idea for the screen and note the choice in the idea table. Never write a draft in one language and translate it: the translation keeps the first language's sentence shape. Write each language from the idea.
5. **Use the element's pattern** from the tables above. A button names the result. A limit is a fact and a way forward. An error is what happened and what to do. An empty state is what is empty and one way forward.
6. **Check the sentence.** One idea, answer first, a verb for every action, one hedge at most, no semicolon, no stacked "you can". After every cut, read each remaining sentence alone: "it", "this", "the rest" and "the same" must still point at something in the same string.
7. **Check the patterns** in `references/patterns.md` (T stiff or translated-sounding, M machine-written, V register). Swapping a tell for a synonym fixes nothing: give a fact or cut.
8. **Check the written-down conventions.** Numbers, dates and plurals from the project's formatters, case and quotes as in the project's other strings, the project's copy lint if it has one.
9. **Read it aloud.** Would a calm expert friend say it to the user across a table? If not, rewrite.
10. **Ask the `reviewer` subagent, or a new session,** with the screen's files and `references/review.md`. Fix what it quotes. Stop after two rounds and record the rest under "left for you to check". Taste, brand feel and whether a line lands are the owner's call and are never self-approved.

## Reviewing copy yourself

Work through `references/review.md`. Extract the strings with line numbers using the script (`python3 "${CLAUDE_SKILL_DIR}/scripts/extract-strings.py" --diff <range> --hints <paths>`, or point it at a directory to read a whole screen). Build the screen's idea table, then judge each string against the rules and patterns, with file, line and a rewrite. Check each rewrite with `--check "<text>"`. Report only what breaks a rule. A review that finds nothing says so.

## Traps for an agent

- **Numbers never live in a string.** A figure comes from data through the project's formatter, never typed and never written by a model. A hand-typed "12 results" or "98%" goes stale or was invented. Examples in these references show numbers only as placeholders such as `{count}`.
- **Do not invent claims.** "Trusted by 10,000 researchers", "verified", "secure", "real-time", "guaranteed": each is a fact the product must back, or it is not written. A plain word can promise more than the product does, so check what a user would take it to mean.
- **A rule is not a word swap.** R7 removes how the system works, not what the user sees: that a result is missing and why, that a job is paused, that a limit was hit. A hint exists to show an example, so keep the casual one a user would type. "You can" stays when it states a real ability. Check every plain replacement for an internal detail against the code or the spec: "a few minutes", "every file" and "the same type" can be narrower or wider than what the system does.
- **Check a rewrite for the fact it dropped.** A cut can leave a pronoun pointing at nothing, or remove the one thing the user needed along with the internals.
- **Copy the pattern, not the sentence.** The worked examples teach a process. A screen's own facts decide its words.
- **Prompts are not copy.** This skill governs the words around model output, not the prompts that produce it.
- **Do not widen the task.** A copy task changes strings and the tests that assert on them. A glossary change, a layout change or a new control is a follow-up.

## References

| File                            | Read when                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `references/patterns.md`        | judging a string against T, M and V: how to spot each pattern in a diff, what is not a violation, short examples, and the sources          |
| `references/review.md`          | reviewing: the extraction script, the screen's idea table, the checklist, the report and the verdict (a fresh-context reviewer follows it) |
| `references/worked-examples.md` | learning the process: four screens worked from the whole set to the final strings                                                          |
