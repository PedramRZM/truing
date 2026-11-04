---
name: research
description: Research a question with web sources and/or code experiments and write a dated, cited report into docs/research/. Use whenever a decision needs outside evidence — comparing libraries, tools, vendors or models; checking how others solve a problem; verifying current versions, licences, prices or best practices — or when someone says research, investigate, compare, evaluate, "find out" or "what's the current state of".
---

# Research

Research in this repo exists to support decisions, so every report should end in a recommendation or a clearly stated decision someone still has to make.

## 1. Frame the question

- Write the question in one sentence and say which ADR, epic or task it feeds.
- Check what we already know: `docs/research/README.md`, `docs/learnings/`, `docs/references/`. Extend or supersede existing research instead of duplicating it.
- Split the question into 3–6 independent sub-questions.

## 2. Gather evidence

- If your harness supports subagents, research sub-questions in parallel and have each return findings with their sources; otherwise work through them in order.
- Prefer primary sources: official docs, the repository itself (README, LICENSE, releases), papers, the author's own post. Use secondary sources for news and sentiment, and label them as secondary.
- Get tool and repo facts (stars, licence, latest release, archived) from commands run today, e.g. `gh api repos/OWNER/REPO --jq '{stars:.stargazers_count,license:.license.spdx_id,pushed:.pushed_at,archived:.archived}'`.
- When the question is "can X do Y", a small experiment in the research folder beats reading docs.
- Link to third-party code; never paste it into the repo. Name no host project in the report.

## 3. Write the report

Create `docs/research/<YYYY-MM-DD>-<kebab-slug>/` (UTC date), or a single `docs/research/<kebab-slug>.md` if there are no raw notes to keep:

- `README.md`: the report, from `docs/templates/research-report.md`: frontmatter, the answer first, findings with citations, a claims ledger, options, the recommendation, open questions.
- `notes/`: optional raw notes, one file per sub-question.

Mark every claim as sourced or `unverified`. Quote at most ~25 words from any source. Dates, versions, numbers and licences must match the source exactly. Mark facts versus opinions.

## 4. Verify in a fresh context

Give the claims ledger to someone who didn't write it: the `citation-verifier` subagent where available, otherwise a new session. Fix or drop anything contradicted. Writers reliably miss their own errors, which is why this step is separate.

## 5. Close

- Add the report to the table in `docs/research/README.md`.
- Link it from the task or ADR it feeds; if it changes a decision, draft the ADR with the `adr` skill.
- Set `revisit_by` in the frontmatter; fast-moving topics (AI tools, models, prices) default to three months.
