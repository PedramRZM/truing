# Spotting the patterns

How to find each pattern in a diff, when it is not a violation, and where each one comes from. The ids are T (stiff, corporate or translated-sounding), M (machine-written or promotional) and V (register and voice slips). R1 to R10 are the ten rules in `SKILL.md`. R5, R6 and R8 also appear below as candidates: a retry sentence, a word written two ways, a limit that says "yet".

All examples are illustrative: written for this skill, not taken from a product or a source.

## Reading a hit

- **A hit is a reason to read the sentence, not a verdict.** The field guide on machine-written text on Wikipedia says its signs are descriptive and not prescriptive, and that human writers share some of them. A string with no hit can still be a finding, and most findings of the idea-table kind (repetition, an empty lead, a missing fact) are invisible to any word list.
- **Removing a tell does not fix a sentence that says nothing.** The same guide says: "Please do not merely treat these signs as the problems to be fixed; that could just make detection harder." Replacing "seamless" with "smooth" fixes nothing. Give a fact or cut (R2).
- **A fresh draft brings the tells.** Look for T and M hardest in new text, from a person or a model, and in text copied from a marketing page or a template.

## Running the scan

```
python3 .agents/skills/ux-copy/scripts/extract-strings.py --diff main...HEAD --hints src
```

`--hints` appends the ids below to each string it lists, and prints `# R6 candidate` lines for ideas written two ways. Use `--hits-only` for a long diff. `references/review.md` explains the options and the output. For copy the script does not read (Markdown, MDX, templates, another language), grep the added lines by hand:

```
git diff -U0 main...HEAD -- '*.mdx' | rg '^\+' | rg -i '\b(please|simply|successfully|unfortunately|oops)\b'
```

## T: stiff, corporate or translated-sounding

| Id  | Pattern                                                                        | Spot it                                                                                                  | Write instead                                                                                                               |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| T1  | "Enables you to": the sentence names the feature's power instead of the action | `allows you to`, `enables you to`, `empowers you to`, `gives you the ability to`, `makes it possible to` | the verb itself. "Filter results by year." for "This feature allows you to filter results by year."                         |
| T2  | A formal word where a short one works                                          | `utilize`, `purchase`, `commence`, `terminate`, `facilitate`, `ascertain`, `assist`                      | "use", "buy", "start", "end", "help". GOV.UK's own pair is "buy" for "purchase".                                            |
| T3  | The passive with a formal verb                                                 | `was performed`, `is utilized`, `will be conducted`                                                      | the plain verb, or what happened: "We searched {count} sources."                                                            |
| T4  | A modal and a pronoun in front of the real verb                                | a sentence that starts `You can` or `You may`                                                            | the verb. "View your filters." Microsoft: "Edit out _you can_ when it isn't necessary."                                     |
| T5  | Filler openers                                                                 | `please note`, `note that`, `it is important to note`, `be advised`                                      | delete and start with the fact. Google lists "please note" and "at this time" among placeholder phrases.                    |
| T6  | Stiff prepositions                                                             | `in order to`, `with regard to`, `prior to`, `pursuant to`, `as per`                                     | "to", "about", "before"                                                                                                     |
| T7  | Clerk or legal register                                                        | `herein`, `hereby`, `kindly`, `revert back`, `do the needful`                                            | plain words                                                                                                                 |
| T8  | A hidden verb: a verb turned into a noun                                       | `perform a search`, `carry out the deletion`, `make a selection`, `take action`, `provide an update`     | "search", "delete", "choose", "act", "update". digital.gov: hidden verbs "make our writing weak and longer than necessary". |
| T9  | Wordy clause openers                                                           | `due to the fact that`, `in the event that`, `for the purpose of`, `in the absence of`                   | "because", "if", "to", "without"                                                                                            |
| T10 | Empty fillers and politeness                                                   | `please`, `simply`, `successfully`, `at this time`, `click here`, `it's easy`                            | delete. GOV.UK: "please" implies a choice. Google lists "simply" and "It's easy".                                           |
| T11 | A noun stack                                                                   | four or more nouns in a row: "search result relevance score threshold settings"                          | split it: "Settings for ranking results". No detector: spot it by reading.                                                  |
| T12 | The agentless impossibility                                                    | `it is not possible to`, `unable to`, `cannot be completed`                                              | what happened: "Couldn't save your changes." for "Unable to process your request."                                          |

A translated string rarely shows in a word list. It shows as an odd word order, a missing or doubled article, a formal verb where a plain one is natural, or a sentence that mirrors another language's shape. The check is a rule of the process: write each language from the idea, never from another language's string.

Basis. Quoted from the sources, as recorded: the pair "buy" and "purchase" (T2), "you can" (T4), "please note" and "at this time" (T5), "simply" and "It's easy" (T10), hidden verbs (T8). The rest of the table is this skill's reading of the same sources, which give principles and a few examples, not a catalogue: short words over formal ones, verbs over nouns that hide them, the point first.

## M: machine-written or promotional

| Id  | Pattern                                         | Spot it                                                                                                                         | Write instead                                                                                                                                                                |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Filler openers and transitions                  | a string that opens with `In today's world`, `As you know`, `Additionally,` or `Moreover,`; `ever-evolving`, `fast-paced world` | delete and start with the fact                                                                                                                                               |
| M2  | Empty praise and the vocabulary of machine text | the two lists below                                                                                                             | a fact or nothing (R2). "Seamless research workflow" becomes what it does: "Import references from a file."                                                                  |
| M3  | Doubled synonyms                                | `fast and easy`, `clear and concise`, `safe and secure`, `review and evaluate`                                                  | one word                                                                                                                                                                     |
| M4  | A triad                                         | three adjectives in a row: "Fast, accurate, and reliable."                                                                      | the one that is true and checkable                                                                                                                                           |
| M5  | Negative parallelism                            | `not only ... but also`, `it's not just X, it's Y`, `more than just`                                                            | say the one thing                                                                                                                                                            |
| M6  | Avoiding "is"                                   | `serves as`, `acts as`, `plays a crucial role`, `is considered`, `represents a`                                                 | "is"                                                                                                                                                                         |
| M7  | A summary closer or a moral                     | `In summary`, `In conclusion`, `Overall,`, `Ultimately,`, a last line that restates the section                                 | delete                                                                                                                                                                       |
| M8  | Cute interjections and fake enthusiasm          | exclamation marks, `Oops`, `Yay`, `Awesome`, `Let's get started`, emoji                                                         | none (R1). Apple: interjections like "oops!" or "uh-oh" "are typically unnecessary and can sound insincere." Material: exclamation points "tend to come across as shouting." |
| M9  | The chatbot "I"                                 | `I found`, `I couldn't`, `I've added`, `I'm` in the product's own sentences                                                     | "we", or no subject (R9)                                                                                                                                                     |
| M10 | Stacked or defensive hedges                     | two or more of `may`, `might`, `could`, `possibly`, `probably`, `typically` in one string                                       | one hedge, or none                                                                                                                                                           |
| M11 | Vague authority                                 | `Studies show`, `Experts agree`, `Industry reports`, `Many users say`                                                           | the named source, or delete                                                                                                                                                  |
| M12 | Explaining the machinery                        | `database`, `server`, `queue`, `cache`, `threshold`, `pipeline`, `endpoint`, `exception`, `null`, a status code                 | what the user lost and the step (R7): "Results didn't load." with a Try again button                                                                                         |

**M2, list (a): the words the field guide gives, as recorded.** From 2023 to mid-2024: additionally, boasts, bolstered, crucial, delve, emphasizing, enduring, garner, intricate, interplay, key, landscape, meticulous, pivotal, underscore, tapestry, testament, valuable, vibrant. From mid-2024 to mid-2025: align with, enhance, fostering, highlighting, showcasing. Later: emphasizing, enhance, highlighting, showcasing. In an analysis of more than 15 million PubMed abstracts (Kobak et al.), "delves" appeared at 28 times its expected frequency, "showcasing" at 10 times and "underscores" at 11 times, and 66 % of the excess style words were verbs and 16 % adjectives (figures from version 2 of the paper). In Russell et al., human detectors who use language models daily misclassified 1 of 300 articles. They spot machine text by its "AI vocabulary" plus its formality, originality and clarity.

**M2, list (b): promotional words (illustrative, not from the sources).** `seamless`, `robust`, `powerful`, `cutting-edge`, `world-class`, `comprehensive`, `frictionless`, `unlock`, `elevate`, `empower`, `leverage`, `streamline`, `unparalleled`.

**Other signs the field guide names, with no id here.** Boldface and a run of em dashes. The script reports `dash` for an em dash or a spaced dash that joins two clauses. Check boldface in the markup by eye.

Basis. Named in the field guide, as recorded: the vocabulary (M2), undue emphasis on significance such as "marking a pivotal moment" and promotional language such as "vibrant town with a rich cultural heritage" (M2), "serves as a" for "is" (M6), "not only ... but also" (M5), vague attribution such as "Industry reports" and "Observers have cited" (M11), outline-like conclusions (M7), the rule of three (M4). This skill's reading, not a source: M1, M3, M8 as a family, M9, M10, M12, and the English words in list (b).

## V: register and voice

| Id  | Pattern                                        | Spot it                                                                                              | Write instead                                                                                                                |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| V1  | Two registers on one screen                    | "Hey there!" beside "Kindly be advised". Read the idea table for formal and casual words in one set. | one register (R9)                                                                                                            |
| V2  | Slang, cuteness, forced humor                  | `gonna`, `oopsie`, `hang tight`, `buckle up`, `no worries`                                           | plain words. Mailchimp: "forced humor can be worse than none at all".                                                        |
| V3  | The third person for the reader                | `the user`, `users`, `end users`                                                                     | "you"                                                                                                                        |
| V4  | A mood, an answer or the mechanism on a button | `Got it!`, `Let's go`, `Yes` and `No`, `OK`, `Submit`                                                | the verb that names the result: "Save changes", "Delete". Apple: "just saying 'Send' often works better than 'Let's do it!'" |
| V5  | A feeling instead of a fact                    | `Unfortunately`, `Sorry`, `Oops`, `Something went wrong`                                             | the fact. GOV.UK: "sorry" "does not help fix the problem".                                                                   |
| V6  | A word for the product that is not its name    | `the app`, `the system`, `the platform`, `our solution`                                              | "we", or the product's name                                                                                                  |

Basis. This family is the source project's own register slips, generalised. The principles are in the sources, as recorded: a constant voice with a tone that follows the moment (Mailchimp), a knowledgeable friend and not an entertainer (Google), clarity over charm (Mailchimp), and trust over everything (in the NN/g study, trustworthiness explained 52 % of how desirable a tone felt). That a mixed register reads as machine-written is the source project's reading, not a finding.

## Candidates for the rules about repetition, words and limits

| Id  | What it lists                                                                    | Spot it                                                                                                                                                                               | What to do                                                                                                 |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| R5  | A retry sentence beside a retry button, or the same recovery line on every error | `try again`, `check your connection`, `refresh the page`, `if the problem persists`, `contact support`                                                                                | read the screen. A retry button makes the sentence unnecessary.                                            |
| R6  | One idea written two ways                                                        | the script's `# R6 candidate` lines: `sign in` and `log in`, `sign up` and `register`, `sign out` and `log out`, `email` and `e-mail`, `try again` and `retry`, `delete` and `remove` | one word, from the glossary                                                                                |
| R8  | A limit that says "yet", an error that blames, link text that says nothing       | `yet`, `for now`, `currently`, `coming soon`, `not supported`, `invalid`, `incorrect`; `here`, `click here`, `learn more`                                                             | the limit as a fact and a way forward. What happened and what to do. Link text that names the destination. |

## Mechanical findings

The script reports these without a pattern id. Each is a prompt to look, not a finding.

- `emoji` (R1). An exclamation mark is reported as `M8`.
- `;` and `long:N`, a sentence of N words over 25 (R4).
- `digit`, a number typed into a string (R7, R10). Ask where the number comes from. "Step 1 of 3" with both numbers from code is fine.
- `ellipsis`, three dots or the ellipsis character in the middle of a sentence (R10). It is for work in progress: "Loading…".
- `title-case` and `caps`, a string in title case or with an all-capitals word, in a project that uses sentence case (R10).
- `dash`, an em dash or a spaced dash that joins two clauses (see the field guide's signs above).

## What is not a violation

| Id         | Not a violation when                                                                                                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1, T4     | the sentence states a real permission or limit the control does not show: "Admins can remove members." "Your plan allows five projects." A control that already does the thing makes the sentence unnecessary.                                                                                                 |
| T2, T6, T7 | the word is quoted text (a contract, a licence, the user's own words) or a defined term in the project's glossary.                                                                                                                                                                                             |
| T5         | a help article where "Note that" introduces a real exception, once.                                                                                                                                                                                                                                            |
| T8         | the noun is the thing's name in the product, such as a tab called "Take action".                                                                                                                                                                                                                               |
| T10        | "please" or "successfully" sits inside text the user wrote or a developer-facing log.                                                                                                                                                                                                                          |
| T12        | the failure is stated with what happened and what to do: "The file wasn't saved. Try again." The passive is right when the person did not do it. Many in a row on one screen is the problem, not one.                                                                                                          |
| M2         | the word names a real feature or option: "Highlight" in an editor, "Landscape" as an orientation, "Enhance" as an image command.                                                                                                                                                                               |
| M3, M4     | the pair or the three are the real, checkable options: "Papers, authors and topics".                                                                                                                                                                                                                           |
| M5         | the contrast prevents a mistake: "This removes the source from the space, not from your library."                                                                                                                                                                                                              |
| M6         | a technical description of a real role: "Acts as the billing contact."                                                                                                                                                                                                                                         |
| M8         | an exclamation mark sits in quoted user content or a brand name. A project's voice guide may allow one flourish on a rare success. Atlassian, as recorded, limits its delight to success messages and wants "little flourishes, not humor or being cheeky". This skill does not allow it; the project decides. |
| M9         | the first person is the user's own voice: "I agree to the terms", "My projects", "I forgot my password".                                                                                                                                                                                                       |
| M10        | one hedge on a real estimate: "About 2 minutes", shown as an estimate.                                                                                                                                                                                                                                         |
| M11        | the sentence names its source and links it.                                                                                                                                                                                                                                                                    |
| M12        | the reader acts on the machinery: an API settings page, a log view, an admin console. A status page's freshness in the user's units ("Updated 3 hours ago") is a fact, not machinery.                                                                                                                          |
| V1, V2     | a query example the user would type in the user's casual words, kept as typed. A deliberately casual brand that holds one register on every screen: the project's guide decides.                                                                                                                               |
| V3         | an admin screen where one person manages others and the glossary names the role "user". Developer docs.                                                                                                                                                                                                        |
| V4         | the project's glossary fixes the control verbs, "OK" and "Cancel" among them. Judge against it.                                                                                                                                                                                                                |
| V5         | nothing more is known and a way forward follows: "Something went wrong. Try again."                                                                                                                                                                                                                            |
| V6         | the word names a real thing the user manages: "System settings", "operating system".                                                                                                                                                                                                                           |
| R5         | a field error and its summary link, which use the same words so they match. An accessible name that adds the object. A page title and its `h1`. A promise on a second screen where the user decides again.                                                                                                     |
| R6         | the two words name two real ideas the glossary keeps apart: "Remove" takes an item out of a list, "Delete" erases it for good.                                                                                                                                                                                 |
| R8         | "yet" for the user's own state ("You haven't saved a search yet.") or data that will exist when the next step is taken. "currently" in "Currently selected". "Unsupported file type. Use PDF or DOCX." is a limit with a way forward.                                                                          |

## Sources

Quotes below are as recorded in a research note written for a source project on 2026-10-04. They were fetched through a tool and not re-checked against the live pages. The Wikipedia word lists change, and these are as read on that date. Treat each as a pointer to the page, not a citation to copy.

**Voice and tone**

- Mailchimp, Content Style Guide (https://styleguide.mailchimp.com/voice-and-tone/): "You have the same voice all the time, but your tone changes". "It's always more important to be clear than entertaining". "forced humor can be worse than none at all".
- Apple, Human Interface Guidelines, Writing (https://developer.apple.com/design/human-interface-guidelines/writing): "Match your tone to the context". "When in doubt, read your writing out loud."
- Google developer documentation style guide, tone (https://developers.google.com/style/tone): "sound like a knowledgeable friend who understands what the developer wants to do". "Don't try to be super-entertaining, but also don't aim for super-dry".
- GOV.UK writing guidance and Design System (https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/ and its sibling pages `right-tone/` and `style-guides/a-to-z-style-guide/`, and https://design-system.service.gov.uk/components/error-message/): "brisk, but not terse". "serious but not pompous".
- Atlassian Design System, voice and tone (https://atlassian.design/foundations/content/voice-tone): tone changes with the situation. Delight is limited to success messages, "little flourishes, not humor or being cheeky", and only after trust is built.
- NN/g, Kate Moran, "The Four Dimensions of Tone of Voice", 2016 (https://www.nngroup.com/articles/tone-voice-users/): casual, conversational and moderately enthusiastic tones performed best. "52% of the variability in the desirability scores is explained by trustworthiness".
- Microsoft Writing Style Guide, top 10 tips (https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice): "Write like you speak. Read your text aloud."

**Short, plain, one idea**

- NN/g, Morkes and Nielsen, 1997 (https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/): users "detest anything that seems like marketing fluff or overly hyped language ('marketese') and prefer factual information". In the study, concise text scored 58 % better on usability, scannable text 47 %, objective text 27 %, and all three together 124 %.
- Apple: "Check each word to be sure it needs to be there. If you can use fewer words, do so." Microsoft: "Give customers just enough information to make decisions confidently. Prune every excess word." and "Lead with what's most important. Front-load keywords for scanning."
- Google: "Placeholder phrases like please note and at this time", "simply", "It's easy" are listed as fillers.
- Atlassian: "Tell people only what they need to know in the moment and nothing more."
- GOV.UK: "Try to split up sentences that are over 25 words long". "Do not use formal or long words when easy or short ones will do. Use 'buy' instead of 'purchase'".
- Material Design, Writing (https://m1.material.io/style/writing.html): "Write in small, scannable segments". "Avoid exclamation points as they tend to come across as shouting." Use "you" and "your".
- digital.gov plain language guide (https://digital.gov/guides/plain-language/writing): "A hidden verb (or nominalization) is a verb converted into a noun. ... They make our writing weak and longer than necessary".
- Shopify, app content guidelines (https://shopify.dev/docs/apps/design/content): "Use a single noun, verb, or phrase to describe a specific thing, action, or concept." Apple: "Consistency builds familiarity".
- NN/g, progressive disclosure (https://www.nngroup.com/articles/progressive-disclosure/): "Initially, show users only a few of the most important options. Offer a larger set of specialized options upon request."
- NN/g, tooltip guidelines (https://www.nngroup.com/articles/tooltip-guidelines/): "lengthy content is no longer a 'tip', so keep it brief". "tooltips shouldn't be essential for the tasks users need to accomplish".
- A localization style guide from Microsoft, as recorded: third-person references "such as 'user' should be avoided as they sound formal and impersonal", and "Avoid the corporate 'we'". The same guide notes that "we" in reassurance gives "a more personal feel". Material says to use "you" and "your" and to avoid "we". This skill takes the middle path: "we" only for what the product did.

**Errors, empty states, buttons**

- GOV.UK: "Describe what has happened and tell them how to fix it." "Do not use: 'please' because it implies a choice". "Do not use: 'sorry' because it does not help fix the problem". "Do not use: 'valid' and 'invalid'". The same error message sits next to the field and in the summary so they "look, sound and mean the same".
- NN/g, error message guidelines, 2023 (https://www.nngroup.com/articles/error-message-guidelines/): "Merely stating the problem is also not enough; offer some potential remedies". Do not blame with words such as "invalid, illegal, or incorrect".
- Apple: "That password is too short" is worse than "Choose a password with at least 8 characters". "Interjections like 'oops!' or 'uh-oh' are typically unnecessary and can sound insincere." "When labeling buttons and links, it's almost always best to use a verb". "just saying 'Send' often works better than 'Let's do it!'"
- Microsoft: replace "Invalid ID" with "You need an ID that looks like this: someone@example.com".
- Google: "using please in a set of instructions is overdoing the politeness".
- Shopify: "For calls to action (CTAs), start with a strong verb that describes the action."
- NN/g, empty states, 2021 (https://www.nngroup.com/articles/empty-state-interface-design/): "Communicate system status", learning cues, "direct pathways for getting started with key tasks".

**The tells of machine-written text**

- Wikipedia, "Signs of AI writing" (https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), by WikiProject AI Cleanup: the vocabulary lists in M2, undue emphasis on significance, promotional language, "serves as a" for "is", negative parallelism, vague attribution, outline-like conclusions, the rule of three, em dashes and boldface. The signs are "descriptive, not prescriptive".
- Kobak, González-Márquez, Horvát and Lause, a count over more than 15 million PubMed abstracts (https://arxiv.org/abs/2406.07016, version 4 of 2025-07-03, word figures from version 2).
- Russell, Karpinska and Iyyer, ACL 2025 (https://arxiv.org/abs/2501.15654): expert readers who use language models daily.
- Simon Willison, 2024-05-08 (https://simonwillison.net/2024/May/8/slop/), paraphrased only: "slop" is unrequested, unreviewed generated content handed to people. The source project's answer is that a person reads every string against a checklist before it ships. A fresh-context review is part of that.
