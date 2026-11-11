---
name: second-opinion
description: Get an independent review of the current change from a fresh-context reviewer whose job is to show it is wrong. Use before opening a pull request for any task that needed a plan, when asked for a second opinion, fresh eyes or an adversarial review, or when you are not sure a change is correct.
---

# Second opinion

The session that wrote a change is the worst judge of it: it shares the assumptions that
produced any mistake. Hand the judgement to a reviewer that starts from nothing.

## Brief the reviewer

Start the `reviewer` subagent (in a harness without subagents, a new session) and give it:

- the task text with its acceptance criteria, word for word;
- the base branch to compare against, and the task branch name;
- how to run the checks (`scripts/agent/check`).

Do not give it your summary, your plan or your reasoning. It should read the code as it is on
the branch against the base, and decide for itself.

## What to do with findings

- Each finding must come with evidence: the file and line, and the input or command that shows
  the problem. Treat a finding without evidence as a question, and check it yourself.
- Fix what is Important. Leave Nits unless they are free.
- After fixing, ask for a re-review of only what changed since the last round. Three rounds at
  most. If a round returns only nits, stop.
- If you disagree with a finding, do not argue it away silently. Put the finding and your
  reason in the pull request so the user decides.

## Gotchas

- A reviewer asked to find problems always finds something. The reviewer's brief tells it to
  skip style; do not add work to satisfy taste.
- Giving the reviewer the diff alone makes it grade the diff. It needs the base branch and the
  criteria to notice what is missing.
- This checks the change against its task. For a bug hunt over a large diff in Claude Code,
  `/code-review` is the complementary tool.
