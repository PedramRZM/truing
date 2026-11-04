---
name: study-repo
description: Study an open-source reference repository (a visual editor, a devtool, an agent harness) to extract how it solves one problem into a reference note under docs/references/, respecting its licence. Use whenever someone wants to learn from, compare with, or borrow ideas from another project's code, asks "how does X do Y", or a design task names a comparable project.
---

# Study a reference repository

Goal: understand how a comparable project solves one specific problem, so we can design our own solution. Ideas come in. Code comes in only as `THIRD_PARTY_NOTICES.md` describes, with its licence, and never from `refs/` by accident.

## 1. Licence gate, before reading any code

- `gh api repos/OWNER/REPO --jq '{license:.license.spdx_id,stars:.stargazers_count,pushed:.pushed_at,archived:.archived,branch:.default_branch}'`, then read the LICENSE file itself. `NOASSERTION` usually means custom terms.
- Choose the read policy:
  - `patterns-only` for custom, branding or anti-SaaS licences, AGPL/BSL/ELv2, or any `ee/`/enterprise directory: describe ideas in prose and link permalinks, never reproduce code.
  - `adapt-with-attribution` for MIT/Apache/BSD: small adaptations allowed only with an SPDX header and a `THIRD_PARTY_NOTICES.md` entry, and an ADR when it is more than a few lines.
- Note restricted paths, and don't read them.

## 2. Fetch

- Clone at a commit you can cite: `git clone --filter=blob:none <url> refs/<name>`, then `git -C refs/<name> rev-parse HEAD`.
- The clone lives in `refs/<name>/`: git-ignored and read-only for agents.
- For a quick orientation, the DeepWiki MCP server (`read_wiki_structure`, `ask_question`) can summarise a public repo. Treat its answers as leads to check in the code, never as citations.

## 3. Read with a question

- Start from the focus question, e.g. "how does it map a rendered element back to its source line?". Map the entry points first (README, docs, top-level packages), then follow the code path that answers the question. Use subagents for parallel searches if your harness has them.
- Every statement in the note needs a permalink: `https://github.com/OWNER/REPO/blob/<sha>/<path>#L<a>-L<b>`.
- Keep facts (what the code does) apart from implications (what we should do).

## 4. Write the note

- `docs/references/<name>.md` from `docs/templates/reference-note.md`: patterns observed with permalinks, ideas we could borrow and where they'd land in our design, rejected ideas and why, licence notes.
- Add it to the table in `docs/references/README.md` and link it from the ADR or epic that asked for it.

## 5. Verify

Run the `citation-verifier` subagent, or use a fresh session, over the note's permalinks before the note informs a decision.
