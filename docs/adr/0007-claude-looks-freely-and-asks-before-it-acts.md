---
status: accepted
date: 2026-11-07
decision-makers: [the owner]
consulted: []
related:
  [
    TRU-18.1,
    TRU-18.2,
    TRU-18.3,
    TRU-18.4,
    TRU-12.1,
    docs/changes/TRU-14-frames-claude-takes/plan.md,
  ]
---

# Claude looks freely in the app, and asks the person before it changes anything

## Context and problem statement

Claude can now set up frames, take pictures of them and move through the running app (TRU-18.2, TRU-18.3, TRU-18.4). The app is a real one: a click can send an email, submit a form or delete a row in a shared development database. What may Claude do on its own, and what must a person agree to first? And how long may one run go on?

## Decision drivers

- A person must never find that Claude changed data they didn't agree to.
- Looking must stay cheap, or Claude can't check its own work.
- The rule must hold in every Claude Code permission mode, including full access, since nothing in Claude Code knows which of Truing's tools changes the app.
- Everything Claude does should show on the canvas, so the person can follow and take over.

## Considered options

1. **Look freely, ask before acting.** Opening, moving, resizing and closing Claude's own frames, navigating, scrolling, hovering and pictures run without asking. A click or typed text asks the person, every time.
2. **Act within a budget.** Claude may also click and type unasked, up to a number of actions per run; only deleting or submitting asks.
3. **Frames only.** No acting in the app at all for now.

## Decision outcome

Chosen option: 1, "look freely, ask before acting". The owner chose it on 2026-11-07, when asked with all three options.

- A tool that changes something in the app declares `asks: true` in its module's `claude.tools`. The claude module's bridge asks the person before every call of such a tool, through the same prompt the chat already uses for permissions, whatever Claude Code's permission mode. A "no" reaches Claude as an error telling it to ask what the person wants instead.
- Claude closes only frames it opened; a person's frame is theirs.
- A turn may make at most 60 module tool calls (`TURN_BUDGET`); past that a tool answers that the budget is spent. Stop in the chat ends a turn at once and leaves the app as it is.
- An element Claude acts on shows an outline first, and the canvas brings its frame into view.

### Consequences

- Good, because nothing that can change data happens without a yes, in any mode.
- Good, because looking, including pictures at every size, needs no attention from the person.
- Bad, because a long walk through forms means many questions. If that proves tiresome, option 2 can supersede this for actions the person marks as safe.
- Bad, because a navigation can still reach a page whose own load changes data (a link that signs out, a page that creates a record when opened). Navigating is treated as looking; the person can stop a run.

### Confirmation

- `test/unit/claude-tools.test.ts`: a tool with `asks` asks first, in words; a "no" runs nothing; the turn budget stops the 61st call.
- `test/unit/frames-tools.test.ts`: the tool list snapshot shows which tools ask; `close_frame` refuses a person's frame.
- A new tool that changes the app is reviewed for `asks: true` (REVIEW.md).

## Pros and cons of the options

- **Option 2** is faster for long flows, but "what counts as deleting or submitting" can't be known from a button's role and name, so the line would be a guess.
- **Option 3** is safest but leaves Claude unable to check states behind a click, which TRU-18's reviews and TRU-18.9's comparisons need.

## More information

Not measured yet, from TRU-18.1's criteria: the actions of two real apps sorted by this rule with evidence, and the cost of a review run per route and size on a plan's limits. Both need real Claude runs (`pnpm check-claude`). Revisit this decision if those runs show the asking is too frequent to be useful, or if the budget is wrong.
