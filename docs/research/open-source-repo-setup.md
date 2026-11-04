---
title: 'How successful open-source developer tools set up their repositories, and what Truing should copy'
date: 2026-11-03
status: active # active | concluded | superseded
question: 'What do very successful open-source developer-tool repos ship for contributors, releases, changelogs, recurring maintenance and coding agents, and which of those fit a small new project like Truing?'
method: 'Repo files read through `gh api` at the commits listed under Findings; official docs through `gh api` and WebFetch; one local `zizmor` audit and one `npm pack --dry-run`. Harness: Claude Code, model Claude Opus 5.5. All counts are from scripts run on 2026-11-03.'
revisit_by: 2027-02-03 # npm publishing rules and agent workflows are moving fast
outcome: 'Feeds TRU-7, TRU-7.3, TRU-7.4, TRU-7.2 and TRU-7.7. No decision taken: the version policy and any new dependency need an ADR.'
---

# How successful open-source developer tools set up their repositories, and what Truing should copy

## Answer

Truing already has most of what these repos ship for contributors. The real gaps are in CI hardening and in releasing, which doesn't exist yet.

**Adopt now**, all small and with no new dependency: `.github/ISSUE_TEMPLATE/config.yml`; SHA-pinned actions with minimal `permissions` in both workflows; a `dependabot.yml` with a cooldown; the `packageManager` field; a hand-curated `CHANGELOG.md` with a stated pre-1.0 policy; and a PR template and `CONTRIBUTING.md` that work for someone with no `TRU-` number.

**Release flow** (TRU-7.3, TRU-7.4): the person runs their own `claude` to draft the version and changelog in a release PR, a human merges it, CI runs the gates, a human approves a GitHub environment, and CI publishes with npm trusted publishing. No changesets, no release-please and no hosted agent.

**Two conflicts need a decision.** npm requires the package to exist before a trusted publisher can be set, which collides with TRU-7.4's "never from a laptop"; [the flow](#recommended-release-flow) proposes a one-time, person-run placeholder that is not a release. And `.claude/settings.json` only binds Claude Code, so the publish gate has to live on GitHub as well.

**Skip for now:** governance docs, CODEOWNERS, stale bots, labelers, CodeQL and Scorecard workflows, devcontainers, changesets, CLA or DCO. They answer the problems of a large queue or a large team, and Truing has neither.

## Findings

Facts below were read from the file linked. **Inferred** marks my own conclusion. Recommendations are opinion.

### What was studied

`sst/opencode` now redirects to `anomalyco/opencode`, whose default branch is `dev`. Five comparison repos were chosen to span a pnpm monorepo, a pre-1.0 tool, a solo-founded project and heavy agent use. Playwright and Bun appear only where the six have nothing to show, and are labelled.

| Repo               | Commit read | Stars   | Licence (API) | Latest release (API)               | Why it's here                          |
| ------------------ | ----------- | ------- | ------------- | ---------------------------------- | -------------------------------------- |
| anomalyco/opencode | `3ba597f`   | 224,228 | MIT           | v1.19.5 (2.x is not marked latest) | Primary: closest kind of tool          |
| biomejs/biome      | `c2c2590`   | 26,043  | Apache-2.0    | @biomejs/biome@2.6.4               | Changesets, governance, volunteer team |
| vitejs/vite        | `b3cb057`   | 83,686  | MIT           | create-vite@9.3.3 (vite v8.3.5)    | PR-driven release, trusted publishing  |
| astral-sh/uv       | `f5fde68`   | 91,493  | Apache-2.0    | 0.13.7                             | Still 0.x, heavy hosted agents         |
| withastro/astro    | `402c0fa`   | 63,689  | NOASSERTION   | @astrojs/vercel@11.0.18            | Changesets, agent skills with evals    |
| shadcn-ui/ui       | `4aaea19`   | 127,250 | MIT           | shadcn@4.23.0                      | Lean setup from a small start          |

### What they ship for contributors

`repo` means the file is in the repository; `org` means it comes from the owner's `.github` repository, which GitHub applies across repos. Org files were read at their current `main`, not at a pinned commit.

| Item              | opencode                 | biome                    | vite                       | uv                            | astro                    | shadcn/ui                |
| ----------------- | ------------------------ | ------------------------ | -------------------------- | ----------------------------- | ------------------------ | ------------------------ |
| Bug form + config | [yes, blank off][oc-cfg] | [yes, blank off][bi-cfg] | [yes, blank off][vi-cfg]   | [yes, blank **on**][uv-cfg]   | [yes, blank off][as-cfg] | [yes, blank off][ui-cfg] |
| PR template       | [yes][oc-pr]             | [yes][bi-pr]             | [comment only][vi-pr]      | [yes, two headings][uv-pr]    | [yes][as-pr]             | none                     |
| CONTRIBUTING      | [112 lines][oc-con]      | [596][bi-con]            | [382][vi-con]              | [387][uv-con]                 | [746][as-con]            | [212][ui-con]            |
| Code of conduct   | none                     | [repo, CC 2.1][bi-coc]   | [org, CC 1.4][vi-coc]      | [org, CC 2.0][uv-coc]         | [org, CC 1.4][as-coc]    | none                     |
| Security policy   | [repo][oc-sec]           | none found               | [`.github/`][vi-sec]       | [repo, points to org][uv-sec] | [repo][as-sec]           | [repo][ui-sec]           |
| SUPPORT           | none                     | none                     | none                       | none                          | [org][as-sup]            | none                     |
| GOVERNANCE        | none                     | [repo][bi-gov]           | none                       | none                          | [org][as-gov]            | none                     |
| FUNDING           | none                     | [org][bi-fun]            | [org][vi-fun]              | none                          | [org][as-fun]            | [repo][ui-fun]           |
| CODEOWNERS        | [yes][oc-own]            | [one line][bi-own]       | none                       | none                          | none                     | none                     |
| AGENTS.md         | [yes][oc-ag]             | [yes][bi-ag]             | no; [Copilot file][vi-cop] | [yes][uv-ag]                  | [yes][as-ag]             | no                       |

Three things stand out:

- **Blank issues are off in five of six**, and `config.yml` sends support elsewhere. The community profile API returned no `issue_template` for any of them, even though they all have forms, so that field isn't a usable signal.
- **Security policies now carry a threat model.** [vite][vi-sec], [opencode][oc-sec] and [uv][uv-sec] say what is out of scope. Truing's `SECURITY.md` already does this.
- **Agent policies are now normal.** [vite][vi-con] says "Never let an LLM speak for you". [biome][bi-con] requires disclosure. [uv's org policy][uv-ai] says "We do not allow autonomous agents" for outside contributions. [opencode][oc-sec] bans AI-generated security reports. Truing's stance differs on purpose: agents are welcome, and a named human owns the change.

Only Playwright, outside the six, has a repo-level [`SUPPORT.md`][pw-sup] and a [CLA][pw-con]. None of the six mentions a DCO or CLA in `CONTRIBUTING.md`.

### CI and supply chain

Counted by script over every workflow file. "Pinned" is external `uses:` references on a 40-character SHA, leaving out local actions. "Top-level permissions" counts workflows with a root `permissions:` key, so it understates hardening in repos that declare permissions per job.

| Repo       | Workflows | Pinned  | Top-level permissions | Dependency bot              | Workflow audit                      |
| ---------- | --------- | ------- | --------------------- | --------------------------- | ----------------------------------- |
| opencode   | 22        | 89/89   | 16                    | none; [`/ai-deps`][oc-deps] | none found                          |
| biome      | 25        | 206/206 | 7                     | [Renovate][bi-ren]          | [zizmor][bi-ziz]                    |
| vite       | 13        | 33/33   | 7                     | [Renovate][vi-ren]          | [zizmor][vi-ziz], [Semgrep][vi-sem] |
| uv         | 47        | 511/511 | 44                    | [Renovate][uv-ren]          | [zizmor][uv-ziz]                    |
| astro      | 23        | 77/77   | 14                    | [Renovate][as-ren]          | [zizmor][as-ziz], [Semgrep][as-sem] |
| shadcn/ui  | 11        | 0/64    | 4                     | [Dependabot][ui-dep]        | none found                          |
| **Truing** | 2         | **0/6** | **0**                 | none                        | none                                |

- **SHA pinning is close to universal among them, but not a precondition for success.** shadcn/ui has 127k stars and pins nothing.
- **Release-age delays are common.** [biome][bi-ren] waits 3 days, [vite][vi-ren] 1,440 minutes, and Bun's [Dependabot config][bun-dep] 7 days. [GitHub's docs][gh-dep] describe a Dependabot `cooldown` option.
- **No Scorecard workflow in any of the six, and no CodeQL analysis workflow.** The only `codeql` hit is vite's [SARIF upload][vi-sem] for Semgrep. GitHub's CodeQL default setup is a setting, so it wouldn't show in a repo: **not verifiable from files**.
- **Truing, audited.** `uvx zizmor --offline` (1.32.0) on `.github/workflows` reported 16 findings, 6 suppressed: `unpinned-uses` ×6 (high), `excessive-permissions` ×2 (medium), `artipacked` ×2 (low).

### Tooling

| Item                | Who ships it                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packageManager`    | All five npm-based repos: [opencode][oc-pkg] (bun), [biome][bi-pkg], [vite][vi-pkg], [astro][as-pkg] and [shadcn/ui][ui-pkg] (pnpm 10.33.4 to 12.16.1)             |
| `.nvmrc`            | [astro][as-nvm] (24.21.0) and [shadcn/ui][ui-nvm] (v20.5.1, while its [release job][ui-rel] is named for Node 24: **inferred** drift)                              |
| Linter              | All six: [oxlint][oc-oxl] (opencode), biome itself, [oxlint][vi-oxl] (vite), [ruff][uv-ruf] (uv), [Biome and ESLint][as-esl] (astro), [ESLint][ui-esl] (shadcn/ui) |
| Formatter           | Prettier in [opencode][oc-pkg], [uv][uv-pre], [astro][as-pre] and [shadcn/ui][ui-pre]; biome itself; [oxfmt][vi-pkg] in vite                                       |
| Git hooks           | [husky][oc-hus] (opencode), [simple-git-hooks][vi-pkg] (vite). Truing's plain `.githooks/` needs no dependency                                                     |
| `.gitattributes`    | `* text=auto eol=lf` in [vite][vi-att], [uv][uv-att] and [biome][bi-att]; [opencode][oc-att] sets it per path; astro and shadcn/ui have none                       |
| `.editorconfig`     | All six                                                                                                                                                            |
| Committed `.vscode` | [astro][as-ext] (settings, extensions) and [shadcn/ui][ui-vs] (settings). opencode ships only [`*.example.json`][oc-vs]. biome, vite and uv have nothing           |
| Devcontainer        | [biome][bi-dev]; [astro][as-dev], which has one per example                                                                                                        |

Also read: shadcn/ui commits [`.claude/settings.local.json`][ui-cl], a file meant to stay local. Truing's `.gitignore` already excludes it. Copy Truing's way, not theirs.

### Releases and changelogs

| Repo      | Tool                                                                   | Who approves                                                          | Publish auth                                                         | `CHANGELOG.md`                                      | GitHub Release body                    |
| --------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| opencode  | [Own script][oc-rel] drafts with an agent, then dispatches [CI][oc-wf] | Person edits the notes and answers y/N; [role check][oc-plan] in CI   | [`npm publish --provenance`][oc-npm], `id-token: write`, no token    | [Root][oc-log], curated, with highlights            | [Same notes][oc-ghr]                   |
| biome     | [Changesets][bi-cs], [RELEASES.md][bi-rel]                             | `npm-publish` environment with required reviewers                     | [`id-token: write`][bi-wf], no token in the file (**inferred** OIDC) | [Per package, generated][bi-log]                    | Same text                              |
| vite      | [Own scripts][vi-pre], release PR ([docs][vi-con])                     | Merge, then `Release` environment with required reviewers             | [Trusted publishing][vi-pub], npm 11.5.2+                            | [Per package, generated][vi-log]                    | [Extracted from the changelog][vi-pub] |
| uv        | [Rooster][uv-rs] plus an [agent edit][uv-pre-wf], release PR           | Merge, then [dispatch][uv-wf]; `release-gate` with required reviewers | Not npm; PyPI [trusted publishing][uv-pypi]                          | [Root][uv-log], curated, [archived by minor][uv-ch] | Same text                              |
| astro     | [Changesets action][as-rel]                                            | Merging the `[ci] release` PR; no protected environment listed        | `id-token: write`, no token in the file (**inferred** OIDC)          | [Per package, generated][as-log]                    | Same text                              |
| shadcn/ui | [Changesets][ui-rls], own scripts                                      | Merging the version PR; no environment has protection rules           | `id-token: write`, no token in the file (**inferred** OIDC)          | [Per package, generated][ui-log]                    | Same text                              |

Environment protection comes from `gh api repos/<repo>/environments` today, not from files.

- **Nobody studied uses release-please or git-cliff.** No workflow reference and no config file in any of the six trees.
- **Changesets is used by three repos that publish several packages** (biome, astro, shadcn/ui, whose [`RELEASING.md`][ui-rls] lists four). opencode publishes [many more][oc-npm] without it. [Its README][cs-readme] says it focuses on monorepos, and also that the workflow is "beneficial for single package repos". **Opinion:** its main value, coordinating packages, doesn't apply to Truing.
- **Generated changelogs read like commit logs.** Compare [vite's][vi-log] with [opencode's][oc-log]. Keep a Changelog 2.0.0, published this year, says this directly: changelog tools produce ["raw material at best"][kac2], keep `CHANGELOG.md` as "the canonical record", and "machines can draft, but humans curate". It also suggests recording the brief for agents in an `AGENTS.md`.
- **Publishing is separated from building at the top end.** [opencode's release workflow][oc-wf] runs repo code with no secrets or `id-token`, and publishes in separate jobs that treat artifacts as data. [vite][vi-pub] switches off install scripts before publishing. At Truing's size only the principle transfers: the job that can publish should run as little as possible.

Release cadence, from the newest 100 releases of each repo, stable versions of the main package only. Median days between releases: uv 3.1, astro 3.0 (n=9), shadcn 3.9, vite 4.0, biome 6.7, opencode 0.6 (n=6, since 2.x began). None of them promises a date: [biome][bi-rel] gives no ETAs, and [vite][vi-rels] has no fixed cycle.

### Versioning before 1.0

- **[SemVer][semver]**: 0.y.z "is for initial development" and "Anything MAY change at any time". Its FAQ says to start at 0.1.0 and bump the minor per release, and that software used in production should probably be 1.0.0 already.
- **[uv's policy][uv-ver]** is the working precedent: 0.13.7 and "widely used in production". The minor is bumped for breaking changes and the patch for everything else, and what counts as public API is written down.
- **[node-semver][nsemver]**: `^0.2.3` means `>=0.2.3 <0.3.0-0`, so a minor bump is already a breaking bump to anyone who depends on a 0.x range. **Inferred:** this matters less for `npx truing`, which takes the latest, and more for module authors.
- **release-please** has [`bump-minor-pre-major`][rp-man] for this case; changesets' docs weren't checked for it, because neither tool is recommended here.

### Recurring rituals

| Ritual                  | What they do                                                                                                                                                                                                                                                                                                                | For Truing                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Triage                  | Written decision trees in [vite][vi-con] and [astro][as-con] (needs repro, then priority labels). Forms add the first label: [vite][vi-bug] `pending triage`, [biome][bi-bug] `S-Needs triage`                                                                                                                              | Weekly or when an issue arrives: the person asks their `claude` to summarise and propose, and applies it themselves |
| Labels                  | 43 to 100+ labels in the six                                                                                                                                                                                                                                                                                                | About six: `bug`, `enhancement`, `needs repro`, `good first issue`, `help wanted`, `docs`                           |
| Good first issue        | All six have such a label. Open issues carrying it today: 0 in all six. `help wanted` is live in [uv][uv-con] (56) and biome (23)                                                                                                                                                                                           | TRU-7.7's five issues are worth seeding, but the label isn't a promise of a stocked queue                           |
| Stale policy            | [shadcn/ui][ui-sta] 365 + 7 days. [opencode][oc-cls] 60 days, plus [closing PRs][oc-clp] without enough reactions. [vite][vi-req] closes `needs reproduction` after 3 days and [locks][vi-lck] closed issues after 14                                                                                                       | None. A new project closing its first issues by timer sends the wrong message                                       |
| Cadence                 | See above: no dates promised                                                                                                                                                                                                                                                                                                | Release when a user-visible change is ready, and say so                                                             |
| Dependency review       | Weekly, grouped, delayed. [opencode's `/ai-deps`][oc-deps] has an agent report upgradable versions and their changelogs, with no bot                                                                                                                                                                                        | Weekly Dependabot group; the person asks `claude` to read the changelogs, CI proves it, the person merges           |
| Security advisories     | Private reporting links in [opencode][oc-sec] (with a 6-business-day escalation), [shadcn/ui][ui-sec] and [uv's org][uv-sec]                                                                                                                                                                                                | Keep the flow. Never paste an embargoed report into a hosted tool                                                   |
| Contributor recognition | "Thanks @name" in changelogs: [changesets output][as-log], and [opencode][oc-log], whose [draft prompt][oc-rel] tells the agent to keep attribution. [astro's bot][as-con-bot] posts to Discord. None of the six READMEs embeds a common contributor image (searched for contrib.rocks, contributors-img, all-contributors) | "Thanks @name" on outside contributors' changelog lines. No bot                                                     |

[opensource.guide][osg-bp] backs the two habits that matter most here: write the rules down, so that saying no is easier, and automate what no human should do.

### How agents are used in real repos

Read from files. In what I read, no repo here publishes a stable release on an agent's decision alone. I can't rule out what a hosted service does outside the repo.

| Repo      | Local, person-run                                                                                                                                                                                                                                              | Hosted in CI                                                                                                                                                                                                                                 | Where a human gates it                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| opencode  | **[`script/release.ts`][oc-rel]**: an agent session allowed only read, glob, grep, `git *` and `gh *` returns a review, which the script saves as `RELEASE_REVIEW.md`; `$EDITOR` opens; a y/N prompt; then `gh workflow run`. [`/ai-deps`, `/issues`][oc-deps] | [`bot-docs-locale`][oc-loc] runs an agent, but it is disabled with `if: false`. The [triage workflows I read][oc-tri] are rule-based `github-script`, not models                                                                             | The y/N, CI's role check, and required notes                    |
| uv        | `scripts/release.sh`, then edit by hand ([docs][uv-con])                                                                                                                                                                                                       | 10 `openai/codex-action` steps with an `OPENAI_API_KEY` secret: [issue triage][uv-tri], [reproduce][uv-rep], [fix][uv-fix], [review][uv-rev] and [changelog rewrite][uv-pre-wf]. [Prompts in the repo][uv-pro] treat issue text as untrusted | Agent output lands in draft PRs or a release PR; `release-gate` |
| astro     | [`.agents/skills/`][as-ski] including changeset, triage and merge, [with evals][as-eva]                                                                                                                                                                        | [`.github/factory.yml`][as-fac]: label-triggered review, triage with `autoPrOnFix: false`, Anthropic models. The runtime isn't in the repo: **not verified**. [An agent can trigger preview publishes][as-fpr]                               | Merging the `[ci] release` PR for stable releases               |
| biome     | [AGENTS.md][bi-ag] sends user-facing changes to a [changeset skill][bi-csk]                                                                                                                                                                                    | [CodeRabbit config][bi-rab] present. [`agentscan.yml`][bi-scan] sets a honeypot aimed at agent PRs                                                                                                                                           | `npm-publish` environment                                       |
| vite      | [Copilot instructions][vi-cop]                                                                                                                                                                                                                                 | [Copilot setup steps][vi-cst] only                                                                                                                                                                                                           | Merge plus `Release` environment                                |
| shadcn/ui | Committed Claude settings                                                                                                                                                                                                                                      | None found                                                                                                                                                                                                                                   | Merging the version PR                                          |

- **`anthropics/claude-code-action` is used by none of the repos checked**: no reference in the workflows of the six, Playwright or Bun. It exists (9,772 stars, MIT), and [its setup][cca-setup] stores `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` as repository secrets, or uses workload identity federation.
- **[Its security doc][cca] warns about prompt injection** through hidden instructions in untrusted content. uv's [triage prompt][uv-tri-p] opens by treating issue content as untrusted.
- **The closest match to what Truing wants is opencode's `script/release.ts`:** local, read-mostly agent, editor, explicit yes, CI publishes. Its `gh *` allowance is wider than it needs to be: `gh` can write.

### Official guidance

- **GitHub community profile** [checks for][gh-prof] README, code of conduct, licence, contributing and issue templates. Truing meets all of them.
- **GitHub Actions hardening** [recommends][gh-sec] minimum `GITHUB_TOKEN` permissions, read-only by default. For actions, it calls a workflow lockfile "the strongest protection available", which "supersedes SHA pinning for repositories that adopt it", and recommends SHA pinning for repos that can't adopt one. The [changelog][gh-lock] says lockfiles became generally available on 2026-10-28, including on Free. None of the eight repo trees has `actions.lock` yet.
- **GitHub environments** [allow][gh-env] required reviewers on public repos on the Free plan, and "Prevent self-review" stops someone approving a run they triggered. **Inferred:** a solo maintainer must leave that off or they can never release.
- **OpenSSF [Scorecard][sc]** rates Dangerous-Workflow critical and Token-Permissions, Dependency-Update-Tool and Signed-Releases high. Most of it is usable as a checklist without running it.
- **npm [trusted publishing][npm-tp]** needs npm 11.5.1+ and Node 22.14+, a GitHub-hosted runner and `id-token: write`, with the workflow filename and `repository.url` matching exactly. It generates provenance automatically for a public package from a public repo. Configurations created after 2026-09-03 allow only `npm stage publish` by default, and direct `npm publish` has to be chosen. npm recommends then choosing "Require two-factor authentication and disallow tokens". A new configuration must complete a publish within 2 days or it expires.
- **npm [staged publishing][npm-stage]** (npm 11.15.0+) holds a version until a maintainer approves it with 2FA. No workflow file I read uses it.
- **npm [provenance][npm-prov]** links a package to its source and build, and doesn't guarantee "no malicious code".
- **opensource.guide on [CLAs and DCOs][osg-legal]**: a CLA adds administrative work, and a DCO is the common way to have contributors attest each commit. **Opinion:** neither solves a problem Truing has.
- **Contributor Covenant [3.0][cc3] exists**; Truing links 2.1, the same as biome, and the org files read use older versions.

### Truing today

Read on 2026-11-03. `PedramRZM/truing` returns 404 from `gh api`, so it is private or not created yet. The branch has no commits. No repository settings could be read.

- **Good already:** two issue forms; a PR template with agent disclosure; `CONTRIBUTING.md`; `CODE_OF_CONDUCT.md`; `SECURITY.md` with a threat model; `.gitattributes` identical to vite's first line; `.editorconfig`; `AGENTS.md`; `make check` shared by hook and CI; plain `.githooks/`.
- **Name:** `registry.npmjs.org/truing` returns 404 today, matching TRU-7.3.
- **Package:** `npm pack --dry-run --ignore-scripts` gives 161 files, 386 kB packed and 1.38 MB unpacked, with no build step in `package.json`.
- **Noticed, out of scope:**
  - `AGENTS.md` says dependencies are pinned, but `package.json` has carets on 7 packages, such as `remark-gfm` and `prettier`.
  - `e2e.yml` doesn't upload traces yet (TRU-7.2).
  - pnpm's current major is 12 and Truing's CI uses 10.27.0.

## Gap table

Rec is **now**, **later** or **skip**. "With TRU-n" means now, inside that task.

### Contributor files

| Item                        | Who does it                                      | Truing status                                            | Rec               | Why                                                                                                             |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Issue forms                 | All six ([opencode][oc-bug], [vite][vi-bug])     | Two forms, good                                          | skip (have it)    | Its zero-config field on feature requests is better than anything studied                                       |
| `ISSUE_TEMPLATE/config.yml` | [opencode][oc-cfg], [vite][vi-cfg], [uv][uv-cfg] | Missing                                                  | **now**           | Four lines: blank issues off, and a place for questions                                                         |
| PR template                 | Five of six ([opencode][oc-pr], [uv][uv-pr])     | Has one, but opens with `Refs: TRU-`                     | **now**           | An outsider has no `TRU-` number, while `CONTRIBUTING.md` says "pick or open an issue". Accept `#issue` as well |
| `CONTRIBUTING.md`           | All six                                          | Good; never explains the backlog                         | **now** (TRU-7.7) | TRU-7.7 AC #1 requires it. Say an issue becomes a task when accepted                                            |
| Code of conduct             | [biome][bi-coc], org files                       | Links CC 2.1; private route uses the advisory form       | skip (have it)    | Works once private reporting is on. 3.0 can wait                                                                |
| `SECURITY.md`               | [vite][vi-sec], [opencode][oc-sec]               | Has threat model; link needs a setting; no response time | **later**         | A response-time promise is a human's call. The setting is below, for the human                                  |
| `SUPPORT.md`                | [astro org][as-sup]; Playwright [repo][pw-sup]   | None                                                     | skip              | None of the six has one in its repo. A `config.yml` link does the job                                           |
| `GOVERNANCE.md`             | [biome][bi-gov], [astro org][as-gov]             | None                                                     | skip              | Voting rules for one maintainer are theatre. Write it with the second one                                       |
| `FUNDING.yml`               | [shadcn/ui][ui-fun], org files                   | None                                                     | later             | One line, but pointless until there are users                                                                   |
| `CODEOWNERS`                | [opencode][oc-own], [biome][bi-own]              | None                                                     | later             | Adds nothing solo. With a second maintainer, own `/.github/` as opencode does                                   |
| CLA or DCO                  | Neither in the six; [Playwright CLA][pw-con]     | None                                                     | skip              | Friction with no matching risk at MIT scale                                                                     |
| AI contribution policy      | [vite][vi-con], [biome][bi-con], [uv][uv-ai]     | Agent disclosure in the PR template                      | later             | Add rules for walls of text or AI reports ([opencode][oc-sec]) when noise appears                               |

### CI and dependencies

| Item                        | Who does it                                                               | Truing status    | Rec          | Why                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------- | ---------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actions pinned to SHAs      | Five of six ([vite][vi-ziz], [astro][as-ziz])                             | 0/6              | **now**      | Six edits. Verified today: `actions/checkout` `3d3c42e` (v7.0.1), `actions/setup-node` `949feb2` (v7.1.0), `pnpm/action-setup` `ea17c68` (v6.1.0) |
| Minimal `permissions`       | [uv][uv-pre-wf], [vite][vi-pub], [astro][as-ziz]                          | None declared    | **now**      | `permissions: { contents: read }` and `persist-credentials: false` clear the zizmor findings other than pinning (**inferred**)                    |
| Workflow lockfile           | None of the eight trees; [GitHub][gh-lock] calls it stronger than pinning | None             | later        | Generally available for six days and needs a `gh` extension. Pin now, then revisit: [Dependabot maintains it][gh-lock] too                        |
| Dependency updates          | [shadcn/ui Dependabot][ui-dep], [Renovate in four][vi-ren]                | None             | **now**      | Dependabot is one file and [lists pnpm 7 to 12][gh-eco]. Group weekly with a cooldown, for `npm` and `github-actions`                             |
| zizmor in CI                | [vite][vi-ziz], [uv][uv-ziz], [astro][as-ziz], [biome][bi-ziz]            | Ran once by hand | with TRU-7.4 | Two simple workflows don't need it. A publishing workflow does                                                                                    |
| CodeQL, Scorecard, Semgrep  | Semgrep only: [vite][vi-sem], [astro][as-sem]                             | None             | skip         | **Cargo cult at this size:** no Scorecard or CodeQL analysis workflow in the six. Use Scorecard's docs as a checklist                             |
| Labeler                     | [astro][as-lab], [biome][bi-lab]                                          | None             | skip         | Solves routing across packages; Truing has one                                                                                                    |
| Stale bot                   | [shadcn/ui][ui-sta], [opencode][oc-cls]                                   | None             | skip         | **Cargo cult:** those repos have 1,779 and 3,780 open issues and PRs                                                                              |
| Needs-repro auto-close      | [vite][vi-req], [astro][as-con], [biome][bi-rep]                          | None             | later        | Useful once untriaged reports repeat                                                                                                              |
| PR title lint               | [biome][bi-tit], [vite][vi-tit], [opencode][oc-tri]                       | None             | skip         | Valuable when changelogs are generated from titles. Truing's won't be                                                                             |
| Triage bots with auto-close | [opencode][oc-cmp]                                                        | None             | skip         | **Cargo cult:** built for a flood of low-quality reports                                                                                          |

### Releases

| Item                      | Who does it                                          | Truing status      | Rec           | Why                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------- | ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CHANGELOG.md`, curated   | [opencode][oc-log], [uv][uv-log]                     | None               | **now**       | TRU-7.4 AC #2 asks for plain words. Start with `Unreleased` and state the version policy                                                                                       |
| Pre-1.0 version policy    | [uv][uv-ver]                                         | `0.1.0`, no policy | **now** (ADR) | People will rely on the CLI, module API and profiles, so golden rule 4 applies                                                                                                 |
| Release skill and PR flow | [opencode][oc-rel], [uv][uv-pre-wf], [vite][vi-con]  | None               | with TRU-7.4  | See [the flow](#recommended-release-flow). No new dependency                                                                                                                   |
| Trusted publishing        | [vite][vi-pub], [opencode][oc-npm]                   | None               | with TRU-7.3  | No long-lived npm secret in the repo, and provenance comes with it                                                                                                             |
| Environment with reviewer | [vite][vi-con], uv, biome                            | None               | with TRU-7.4  | The only gate that holds for every harness and every person                                                                                                                    |
| Changesets                | [biome][bi-cs], [astro][as-rel], [shadcn/ui][ui-rls] | None               | skip          | **Not justified for one package.** A new dependency plus a file per PR. Its README says it suits single packages too, but coordinating packages is what these repos use it for |
| release-please, git-cliff | None of the six                                      | None               | skip          | Output is ["raw material at best"][kac2], and it's a new dependency                                                                                                            |
| Preview packages          | [biome][bi-rel], [vite][vi-pkp], [astro][as-pkp]     | None               | later         | Helps when reporters need to test fixes. Truing has none yet                                                                                                                   |
| Signed binaries, SBOM     | [opencode][oc-wf], [uv][uv-wf]                       | None               | skip          | **Cargo cult:** Truing ships an npm tarball, and provenance covers it                                                                                                          |
| Hosted agents in CI       | [uv][uv-tri], [astro][as-fac]                        | None               | skip          | Needs a provider secret in Actions, against the rule set out below; adds injection risk on public text                                                                         |

### Tooling

| Item                 | Who does it                               | Truing status                   | Rec            | Why                                                                                                                                 |
| -------------------- | ----------------------------------------- | ------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `packageManager`     | All five npm-based repos ([vite][vi-pkg]) | Missing; CI hard-codes it twice | **now**        | One source of truth. Remove `version:` from CI: [the action fails][pnpm-src] if the two differ                                      |
| `.nvmrc`             | [astro][as-nvm], [shadcn/ui][ui-nvm]      | None; CI says 24                | later          | Four of six skip it, and [one][ui-nvm] looks stale                                                                                  |
| Linter               | All six                                   | None; `tsc` and Prettier        | later (ADR)    | The one gap every repo agrees on. Golden rule 3 bans lint suppressions with no linter to suppress. Needs an ADR as a new dependency |
| Formatter            | Most                                      | Prettier                        | skip (have it) | Enforced by `make check`                                                                                                            |
| `.gitattributes`     | [vite][vi-att], [uv][uv-att]              | Good                            | skip (have it) | `linguist-generated` on the `make sync` outputs would be a nicety, later                                                            |
| `.editorconfig`      | All six                                   | Good                            | skip (have it) |                                                                                                                                     |
| `.vscode` settings   | [astro][as-ext], [shadcn/ui][ui-vs]       | Only the generated `mcp.json`   | skip           | Three of six have none. `make check` enforces format whatever the editor                                                            |
| Devcontainer         | [biome][bi-dev], [astro][as-dev]          | None                            | skip           | **Inferred:** a poor fit for a tool that opens a local Chromium window and drives the person's own `claude`                         |
| `AGENTS.md`          | Four of six                               | Good                            | skip (have it) | Add a release pointer when the skill lands                                                                                          |
| Local agent settings | [shadcn/ui][ui-cl] commits them           | Git-ignored                     | skip (have it) | Theirs is the anti-pattern                                                                                                          |

## Recommended release flow

For TRU-7.3 and TRU-7.4. It follows vite's PR-then-environment gate and opencode's local draft-review-confirm loop, without opencode's scale. Everything here is a proposal: nothing has been built or tested.

**Version policy (for an ADR).** While on 0.y.z: bump `y` for anything breaking in the `truing` CLI, the module API in `docs/modules.md`, or a profile format change that can't migrate on its own; bump `z` for everything else. State it at the top of `CHANGELOG.md`.

**Steps**

| #   | Who           | What                                                                                                                                                                                                                               | Gate                                            |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Person        | Starts their own `claude` in the repo and invokes a new `release` skill                                                                                                                                                            | Their login, their machine                      |
| 2   | Agent         | Reads the commits since the last tag, merged PRs and closed `backlog` tasks, as data. Drafts the entry from the brief in the skill. Proposes `y` or `z` from the policy and flags any profile format change (TRU-7.4 AC #4)        | None needed: local files only                   |
| 3   | Agent         | On `release/x.y.z`, changes only `package.json`'s version and `CHANGELOG.md`. Runs `make check`, `make e2e` and `npm pack --dry-run`. On a failure it stops and reports `BLOCKED`, and never touches a test                        | Golden rules 1 to 3                             |
| 4   | Person, agent | The person reads and edits the entry. The agent pushes and opens the PR                                                                                                                                                            | `git push` is `ask`                             |
| 5   | **Person**    | Reviews and merges, keeping the subject `release: vx.y.z`                                                                                                                                                                          | `gh pr merge` is `ask`; a human approves merges |
| 6   | CI            | `release.yml` sees that subject on `main`, and runs `make check` and e2e (TRU-7.4 AC #3)                                                                                                                                           | Required jobs                                   |
| 7   | **Person**    | Approves the `release` environment in the GitHub web page, not through an agent                                                                                                                                                    | Required reviewer                               |
| 8   | CI            | Publish job: `id-token: write`, no `pnpm install`, `npm publish --access public --ignore-scripts`, which needs direct publishing chosen on npm. Then tags, and creates the GitHub Release from the matching `CHANGELOG.md` section | OIDC, no stored token                           |
| 9   | Agent, person | `npm view truing`, then `npx truing@x.y.z` and `npm audit signatures` in a scratch install on a clean machine. The person announces it, if at all                                                                                  | Reports evidence only                           |

Steps 6 to 8 follow [vite's workflow][vi-pub]; steps 1 to 5 follow [opencode's script][oc-rel]. Skipping `pnpm install` in the publish job is **inferred** from there being no build step in `package.json`: revisit it if TRU-7.3 adds one. `npm publish` rather than `pnpm publish` because [pnpm's docs][pnpm-pub] describe trusted publishing without saying from which version, and Truing is on 10.27.0: **unverified for pnpm 10**. Node 24.22.1 here ships npm 11.19.1, above the minimum. Check `npm --version` in CI.

**The brief for the agent** goes in the skill, as [Keep a Changelog 2.0.0][kac2] suggests: write for a person using Truing; say what they can now do or what stopped breaking; drop internal, CI and agent-tooling changes; never paste a commit log; thank outside contributors by handle; don't invent anything you can't trace to a PR or commit. [uv's prompt][uv-edi] is a good model of those rules.

**How this meets the repo's rules**

- **The person's own `claude` (golden rule 8).** Steps 1 to 5 and 9 run in their terminal under their login. No `claude-code-action`, no provider key or `claude setup-token` output stored in Actions. The rule's text is about what the product does; this note applies it to maintaining the repo too, as the person asked.
- **No hosted output (golden rule 12).** The changelog is a file in the repo and the source of truth. No gists or artifacts. A GitHub Release is generated from that file by CI, in line with Keep a Changelog; I read that as allowed, since `gh release` is already on the `ask` list, but **a human should confirm it**.
- **`ask` on publishing.** `.claude/settings.json` has `git push`, `gh pr merge`, `gh release`, `pnpm publish` and `npm publish` on `ask`. In this flow the agent never needs the last three: if one is prompted during a release, the answer is no, and CI does it.
- **Gaps in that gate (proposed fix, for the human):**
  - `gh workflow run` and writing `gh api` calls aren't on `ask`, and `tools/agent-hooks/guard.py` has no publish rule. They aren't on `allow` either, so **inferred**: they prompt in default mode, but not in a more permissive one. Those commands can dispatch a workflow, or approve a pending deployment with the person's `gh` login. Consider adding them to `ask`.
  - `ask` only binds Claude Code, while golden rule 11 asks for harness-neutral guidance. So the GitHub environment and required reviewer are the real gate, and the skill should state the rule in words.
- **Untrusted text.** PR titles, issue bodies and commit messages from outsiders are data for the agent. The draft step needs no network writes, and the entry passes human review before merge.

**First publish: a conflict to resolve.** npm says a package ["must already exist"][npm-trust] before a trusted publisher can be configured. That collides with TRU-7.4 AC #1 ("never from a laptop") and makes TRU-7.3 AC #2 harder for the first version. Nothing below was tested, because each option creates external state.

| Option                                                                                                                                                                                                                                                                                                                                                                                                              | Keeps "never from a laptop"                                           | First real version has provenance | Cost and risk                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A (recommended).** The person runs `npm stage publish` once on a minimal package, at a version other than `0.1.0`, because [a staged version can't also be published][npm-stage-cli]. [npm's docs][npm-stage] say staging a new package creates a public `0.0.0-stage` placeholder. The person sets the trusted publisher, CI publishes the real `0.1.0` within 2 days, and the person rejects the stage with 2FA | For every real release; a human must accept this one non-release step | Yes, through OIDC                 | No secret in GitHub, and works with [any token type][npm-stage-cli]. Leaves the public placeholder version. **Unverified and untested by me or any source I found:** that the placeholder counts as "exists" for trusted publishing. If it doesn't, fall back to C                             |
| B. The person puts a short-lived granular token in the `release` environment, CI publishes `0.1.0` with [`--provenance`][npm-prov], and the person deletes the secret and disallows tokens. The trusted publisher goes on just before `0.1.1`, because of the 2-day expiry                                                                                                                                          | Yes                                                                   | Yes                               | One secret for one run, and it must be a bypass-2FA token, since [others get a 2FA prompt][npm-stage-cli] on `npm publish`. npm is deprecating those and [removes][npm-tok] direct publishing of new versions with granular tokens in January 2027. That page doesn't cover brand-new packages |
| C. The person publishes a placeholder directly from a laptop, then sets the trusted publisher, as [a community tool][azu] documents                                                                                                                                                                                                                                                                                 | No                                                                    | Yes                               | A junk version on npm, as with A, but the route is documented by others. Publishing to npm is hard to undo, so try A first                                                                                                                                                                     |

**Direct or staged publishing, for a human to decide.** Recommendation: direct for now, because the docs confirm provenance on that path and TRU-7.3 AC #2 needs it.

|                        | Direct `npm publish`        | Staged `npm stage publish`                                                                                                                               |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setting on npm         | Must be chosen              | The default for new configurations                                                                                                                       |
| Human gate             | GitHub environment reviewer | [2FA approval][npm-stage] on npmjs.com or the CLI. **Inferred:** an agent can't complete it, since [approval can't use OIDC][npm-tp] and prompts for 2FA |
| Provenance             | [Automatic][npm-tp]         | [`--provenance` is a listed flag][npm-stage-cli]. **Unverified:** that it holds through approval                                                         |
| Tag and GitHub Release | Same run, after publish     | CI can't tell when approval happens, so they need another step                                                                                           |

Move to staged if a test shows provenance survives it. npm itself [points that way][npm-tp] for maximum security.

### For the human

None of this has been done. Each creates external state.

1. **Create the repo or make it public** at `PedramRZM/truing`. Provenance needs a public repo, and `repository.url` must match exactly, including case.
2. **Enable private vulnerability reporting**, then test the link. `SECURITY.md` and `CODE_OF_CONDUCT.md` both depend on it. GitHub's page doesn't say what the link does when the setting is off. Must happen before announcing.
3. **Set Actions defaults:** workflow permissions read-only.
4. **Add a ruleset on `main`:** require a PR and the `check` and `e2e` jobs.
5. **Turn on** Dependabot alerts and secret scanning. Optional later: immutable releases, which [lock the tag and assets][gh-imm]; opencode's script mentions them.
6. **Create the `release` environment:** yourself as required reviewer, "Prevent self-review" off, limited to `main`.
7. **npm:** an account with 2FA; the first-publish option you pick above; a trusted publisher with the `release.yml` filename and `release` environment, and direct publishing chosen unless you go staged; then "Require two-factor authentication and disallow tokens".
8. **Issues:** create labels and TRU-7.7's five issues; decide on Discussions, which the `config.yml` link needs; set the repo description and topics.
9. **Decide:** the version-policy ADR, a linter ADR, the two `ask` additions, the first-publish option, direct or staged publishing, and whether a GitHub Release counts as hosted output.

## Claims ledger

Verdicts are from the `citation-verifier` run recorded under [Verification](#verification).

| #   | Claim                                                                                                                                | Source (URL, permalink at a SHA, or script + output)                      | Verifier verdict |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------- |
| 1   | `sst/opencode` resolves to `anomalyco/opencode`, 224,228 stars, MIT, default `dev`                                                   | `gh api repos/sst/opencode`, 2026-11-03                                   | confirmed        |
| 2   | Pinned counts: opencode 89/89, biome 206/206, vite 33/33, uv 511/511, astro 77/77, shadcn/ui 0/64                                    | Script over workflow files at the listed commits                          | confirmed        |
| 3   | Truing has 0/6 pinned, no `permissions`; zizmor 1.32.0 reports 16 findings, 6 suppressed                                             | `.github/workflows/`; `uvx zizmor --offline`                              | confirmed        |
| 4   | Blank issues off in five of six, on in uv                                                                                            | [opencode][oc-cfg], [uv][uv-cfg] and siblings                             | confirmed        |
| 5   | opencode's `script/release.ts` drafts with a restricted agent session, opens an editor, asks y/N, then runs `gh workflow run`        | [script][oc-rel]                                                          | confirmed        |
| 6   | opencode's plan script requires notes and an admin or maintain role for stable releases                                              | [plan-release.sh][oc-plan]                                                | confirmed        |
| 7   | vite: release PR, then `Release` environment approval, then publish; npm 11.5.2+ noted in the workflow                               | [CONTRIBUTING][vi-con], [publish.yml][vi-pub]                             | confirmed        |
| 8   | uv rewrites the changelog with Codex in `release-prepare.yml`, read-only, and opens a PR                                             | [workflow][uv-pre-wf], [prompt][uv-edi]                                   | confirmed        |
| 9   | uv's policy: minor for breaking, patch otherwise; "widely used in production"                                                        | [versioning.md][uv-ver]                                                   | confirmed        |
| 10  | uv's org policy disallows autonomous agents for contributions                                                                        | [AI_POLICY.md][uv-ai]                                                     | confirmed        |
| 11  | astro's `factory.yml` has `autoPrOnFix: false` and Anthropic models; a workflow lets the bot publish previews                        | [factory.yml][as-fac], [factory-preview.yml][as-fpr]                      | confirmed        |
| 12  | No `claude-code-action` reference in the workflows of the eight repos                                                                | grep over the fetched workflows                                           | confirmed        |
| 13  | claude-code-action setup stores credentials as repository secrets, or uses federation                                                | [setup.md][cca-setup]                                                     | confirmed        |
| 14  | No release-please or git-cliff in the six                                                                                            | Tree and workflow grep                                                    | confirmed        |
| 15  | Required reviewers on vite `Release`, uv `release-gate`, biome `npm-publish`; none on opencode `release`, astro or shadcn/ui         | `gh api repos/<repo>/environments`, 2026-11-03                            | confirmed        |
| 16  | Trusted publishing: npm 11.5.1+, Node 22.14+, 2-day expiry, automatic provenance for public repo and package                         | [npm docs][npm-tp]                                                        | confirmed        |
| 17  | Package must exist before a trusted publisher can be configured                                                                      | [npm trust][npm-trust]                                                    | confirmed        |
| 18  | Keep a Changelog 2.0.0 phrases as quoted                                                                                             | [source at a commit][kac2-src]                                            | confirmed        |
| 19  | SemVer 0.y.z wording and FAQ                                                                                                         | [semver.org][semver]                                                      | confirmed        |
| 20  | `^0.2.3` := `>=0.2.3 <0.3.0-0`                                                                                                       | [node-semver README][nsemver]                                             | confirmed        |
| 21  | `pnpm/action-setup` throws when `version` and `packageManager` differ                                                                | [run.ts][pnpm-src]                                                        | confirmed        |
| 22  | Dependabot has `cooldown` and lists pnpm v7 to v12                                                                                   | [options][gh-dep], [ecosystems][gh-eco]                                   | confirmed        |
| 23  | Dependabot updates SHA-pinned actions and their version comments                                                                     | [Bun PR #47828][bun-pr] (observed)                                        | confirmed        |
| 24  | Median release gaps as listed                                                                                                        | `gh api repos/<repo>/releases?per_page=100` over stable main-package tags | confirmed        |
| 25  | A good-first-issue label exists in all six (biome: `S-Good first issue`), 0 open; `help wanted` 56 in uv, biome's `S-Help-wanted` 23 | `gh api repos/<repo>/issues?labels=…`, 2026-11-03                         | confirmed        |
| 26  | Registry returns 404 for `truing`; repo returns 404 for this login                                                                   | `curl registry.npmjs.org/truing`; `gh api repos/PedramRZM/truing`         | confirmed        |
| 27  | New trusted publisher configurations allow `npm stage publish` by default; direct publishing is chosen                               | [npm docs][npm-tp]                                                        | confirmed        |
| 28  | Staging a new package creates a public `0.0.0-stage` placeholder; approval needs 2FA; npm 11.15.0+                                   | [staged publishing][npm-stage]                                            | confirmed        |
| 29  | Direct publishing of new versions with a granular token is removed in January 2027                                                   | [access tokens][npm-tok]                                                  | confirmed        |
| 30  | GitHub calls lockfiles "the strongest protection available"; GA on 2026-10-28 including Free; Dependabot regenerates entries         | [secure use][gh-sec], [changelog][gh-lock]                                | confirmed        |
| 31  | No `actions.lock` in the eight trees; no `stage publish` in the workflow files read                                                  | Grep over fetched trees and workflows                                     | confirmed        |

## Options and trade-offs

**Changelog and release tooling for one package.**

| Option                                             | For                                                                                    | Against                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Curated file, agent drafts, own small workflow** | No dependency. Meets "plain words". Matches opencode and uv. Keep a Changelog backs it | Workflow and extract script to maintain, perhaps 60 lines (**estimate**). Depends on the release ritual      |
| Changesets                                         | Used by three studied repos. Asks for the entry at PR time, when context is fresh      | Dependency plus an ADR. Monorepo-focused. Outsiders must learn it                                            |
| release-please                                     | Maintained Release PR. Truing's `<type>: <summary>` commits nearly fit                 | Dependency. Generated text, and none of the six use it. Agent-authored commit subjects are not reader-facing |
| git-cliff                                          | Local, configurable                                                                    | Same as above, and no studied repo uses it                                                                   |

**Writing the entry per PR or at release time.** Per PR, in `Unreleased`, gives better context; at release, an agent can draft it all at once and needs no contributor to learn anything. **Recommendation:** at release, and a PR author may add a line if they want. Change it if entries turn out thin.

**Dependabot or Renovate.** Four of six use Renovate and it is more configurable, but it needs an app installed. Dependabot is one file and no account decision. Pick Dependabot, and revisit if grouping falls short.

## Open questions and unverified claims

**Could not verify**

- Repository settings of any studied repo beyond environments: branch rules, CodeQL default setup, secret scanning. Not visible from files.
- Whether biome, astro and shadcn/ui really publish by OIDC. I read `id-token: write` and no npm token in the workflow files; a token could be injected some other way.
- Whether a `0.0.0-stage` placeholder satisfies npm's "must already exist", whether provenance holds through staged approval, and whether a granular token can directly publish a brand-new package. npm's pages don't settle these. No option in the first-publish table has been tried.
- Whether workflow lockfiles are fully GA: the [changelog][gh-lock] says so, while a GitHub Enterprise Cloud docs page reached through search still said preview.
- pnpm 10.27.0 and trusted publishing. pnpm's current docs don't give a version.
- What astro's factory runtime actually does. Only its config is in the repo.
- Whether opencode's triage workflows use models anywhere. I read `triage-pr-standards`, `triage-compliance-close`, `triage-close-prs`, `triage-close-issues` and `triage-contributor`, in part; `CONTRIBUTING.md` says automated checks flag "AI-generated walls of text".
- Whether GitHub's default labels still include those named in the rituals table. From memory.
- What `security/advisories/new` does when private reporting is off, and its default state.
- The flow itself. Nothing was built or run. `zizmor` and `npm pack --dry-run` are the only things executed against Truing.

**Limits of the method**

- Workflow counts use a regex, not a YAML parser. References written `uses: $/.github/...` in vite and uv are read as repo-local (**inferred**) and left out of the pinned totals.
- Release-gap medians cover only the newest 100 releases, so monorepos with many packages have thin samples (astro n=9, opencode n=6).
- Most docs came through WebFetch, which summarises with a small model. Quoted Keep a Changelog text was then checked against its source; others were left to the verifier.
- Stars show popularity, not that any one practice caused it. These repos have teams or money that Truing doesn't, which is why "who does it" never decides a recommendation alone.

**Left for a human**

- Is a GitHub Release acceptable under golden rule 12?
- Should a response-time promise go in `SECURITY.md`?
- Which linter, if any, before outside contributions start?

### Verification

A fresh-context `citation-verifier` run on 2026-11-03 confirmed ledger rows 1 to 26 and returned an overall fail for errors outside the ledger, all fixed here: wrong source files for two claims, who writes `RELEASE_REVIEW.md`, a changesets overstatement, a partial account of GitHub's pinning advice, a primary npm source I had called missing, and a flow that missed npm's stage-only default and the 2-day expiry. Row 17 was reworded to the stronger source it found. It noted that rows outside the ledger and its spot checks were only sampled, and it did not open `osg-bp` or `gh-imm`.

A second, narrower run checked ledger rows 27 to 31, the first-publish section and the lockfile facts. The rows and quotes held. It failed the first-publish section on five points, all fixed here: the costs of options A and C, a misdescribed secondary source, option B's need for a bypass-2FA token, and things I had called unsettled that npm's `npm stage` page settles. The final wording of that section has not been through a third run.

[oc-cfg]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/ISSUE_TEMPLATE/config.yml
[oc-bug]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/ISSUE_TEMPLATE/bug-report.yml
[oc-pr]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/pull_request_template.md
[oc-con]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/CONTRIBUTING.md
[oc-sec]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/SECURITY.md
[oc-own]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/CODEOWNERS
[oc-ag]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/AGENTS.md
[oc-deps]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.opencode/command/ai-deps.md
[oc-pkg]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/package.json
[oc-oxl]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.oxlintrc.json
[oc-hus]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.husky/pre-push
[oc-att]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.gitattributes
[oc-vs]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.vscode/settings.example.json
[oc-rel]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/script/release.ts
[oc-wf]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/workflows/release.yml
[oc-plan]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/release/plan-release.sh
[oc-npm]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/release/publish-npm.sh
[oc-ghr]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/release/publish-github-release.sh
[oc-log]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/CHANGELOG.md
[oc-cls]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/script/github/close-issues.ts
[oc-clp]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/workflows/triage-close-prs.yml
[oc-loc]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/workflows/bot-docs-locale.yml
[oc-tri]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/workflows/triage-pr-standards.yml
[oc-cmp]: https://github.com/anomalyco/opencode/blob/3ba597f7769e19cc3b5f67e3d6667e7b6318f6a3/.github/workflows/triage-compliance-close.yml
[bi-cfg]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/ISSUE_TEMPLATE/config.yml
[bi-bug]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/ISSUE_TEMPLATE/03_bug.yml
[bi-pr]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/PULL_REQUEST_TEMPLATE.md
[bi-con]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/CONTRIBUTING.md
[bi-coc]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/CODE_OF_CONDUCT.md
[bi-gov]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/GOVERNANCE.md
[bi-fun]: https://github.com/biomejs/.github/blob/main/FUNDING.yml
[bi-own]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/CODEOWNERS
[bi-ag]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/AGENTS.md
[bi-ren]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/renovate.json5
[bi-ziz]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/workflows/actions_linter.yml
[bi-pkg]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/package.json
[bi-att]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.gitattributes
[bi-dev]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.devcontainer/devcontainer.json
[bi-cs]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.changeset/config.json
[bi-rel]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/RELEASES.md
[bi-wf]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/workflows/release.yml
[bi-log]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/CHANGELOG.md
[bi-csk]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.agents/skills/changeset/SKILL.md
[bi-rab]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.coderabbit.yaml
[bi-scan]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/agentscan.yml
[bi-lab]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/labeler.yml
[bi-rep]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/workflows/needs-repro.yml
[bi-tit]: https://github.com/biomejs/biome/blob/c2c259089211ad0628105779650ee366f7994958/.github/workflows/pull_request_title_lint.yaml
[vi-cfg]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/ISSUE_TEMPLATE/config.yml
[vi-bug]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/ISSUE_TEMPLATE/bug_report.yml
[vi-pr]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/PULL_REQUEST_TEMPLATE.md
[vi-con]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/CONTRIBUTING.md
[vi-coc]: https://github.com/vitejs/.github/blob/main/CODE_OF_CONDUCT.md
[vi-sec]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/SECURITY.md
[vi-fun]: https://github.com/vitejs/.github/blob/main/FUNDING.yml
[vi-cop]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/copilot-instructions.md
[vi-cst]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/workflows/copilot-setup-steps.yml
[vi-ren]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/renovate.json5
[vi-ziz]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/workflows/zizmor.yml
[vi-sem]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/workflows/semgrep.yml
[vi-pkg]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/package.json
[vi-oxl]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/oxlint.config.ts
[vi-att]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.gitattributes
[vi-pre]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/scripts/prepare-release.ts
[vi-pub]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/workflows/publish.yml
[vi-log]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/packages/vite/CHANGELOG.md
[vi-rels]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/docs/releases.md
[vi-req]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/workflows/issue-close-require.yml
[vi-lck]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/workflows/lock-closed-issues.yml
[vi-tit]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/workflows/semantic-pull-request.yml
[vi-pkp]: https://github.com/vitejs/vite/blob/b3cb0575aff63004a71301a1ec798aeea2aa05d7/.github/workflows/preview-release.yml
[uv-cfg]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/ISSUE_TEMPLATE/config.yml
[uv-pr]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/PULL_REQUEST_TEMPLATE.md
[uv-con]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/CONTRIBUTING.md
[uv-coc]: https://github.com/astral-sh/.github/blob/main/CODE_OF_CONDUCT.md
[uv-sec]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/SECURITY.md
[uv-ai]: https://github.com/astral-sh/.github/blob/main/AI_POLICY.md
[uv-ag]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/AGENTS.md
[uv-ren]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/renovate.json5
[uv-ziz]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/workflows/check-zizmor.yml
[uv-ruf]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/ruff.toml
[uv-pre]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.prettierrc
[uv-att]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.gitattributes
[uv-rs]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/scripts/release.sh
[uv-pre-wf]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/workflows/release-prepare.yml
[uv-wf]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/workflows/release.yml
[uv-pypi]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/workflows/publish-pypi.yml
[uv-log]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/CHANGELOG.md
[uv-ch]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/changelogs/0.12.x.md
[uv-ver]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/docs/reference/policies/versioning.md
[uv-tri]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/workflows/issue-triage.yml
[uv-rep]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/workflows/reproduce-bug.yml
[uv-fix]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/workflows/fix-bug.yml
[uv-rev]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/.github/workflows/pull-request-code-quality-review.yml
[uv-pro]: https://github.com/astral-sh/uv/tree/f5fde681577aadf322d056dc3c2b5330a8c0a002/agents/prompts
[uv-tri-p]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/agents/prompts/triage-issue.md
[uv-edi]: https://github.com/astral-sh/uv/blob/f5fde681577aadf322d056dc3c2b5330a8c0a002/agents/prompts/editorialize-changelog.md
[as-cfg]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/ISSUE_TEMPLATE/config.yml
[as-pr]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/PULL_REQUEST_TEMPLATE.md
[as-con]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/CONTRIBUTING.md
[as-coc]: https://github.com/withastro/.github/blob/main/CODE_OF_CONDUCT.md
[as-sec]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/SECURITY.md
[as-sup]: https://github.com/withastro/.github/blob/main/SUPPORT.md
[as-gov]: https://github.com/withastro/.github/blob/main/GOVERNANCE.md
[as-fun]: https://github.com/withastro/.github/blob/main/FUNDING.yml
[as-ag]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/AGENTS.md
[as-ren]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/renovate.json5
[as-ziz]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/workflows/zizmor.yml
[as-sem]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/workflows/semgrep.yml
[as-pkg]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/package.json
[as-nvm]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.nvmrc
[as-esl]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/eslint.config.js
[as-pre]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/prettier.config.mjs
[as-ext]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.vscode/extensions.json
[as-dev]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.devcontainer/devcontainer.json
[as-rel]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/workflows/release.yml
[as-log]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/packages/astro/CHANGELOG.md
[as-con-bot]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/workflows/congrats.yml
[as-ski]: https://github.com/withastro/astro/tree/402c0fae01d251c97298c255804008ff566802f9/.agents/skills
[as-eva]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.agents/evals/README.md
[as-fac]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/factory.yml
[as-fpr]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/workflows/factory-preview.yml
[as-lab]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/labeler.yml
[as-pkp]: https://github.com/withastro/astro/blob/402c0fae01d251c97298c255804008ff566802f9/.github/workflows/preview-release.yml
[ui-cfg]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.github/ISSUE_TEMPLATE/config.yml
[ui-con]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/CONTRIBUTING.md
[ui-sec]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/SECURITY.md
[ui-fun]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.github/FUNDING.yml
[ui-dep]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.github/dependabot.yml
[ui-pkg]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/package.json
[ui-nvm]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.nvmrc
[ui-rel]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.github/workflows/release.yml
[ui-esl]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.eslintrc.json
[ui-pre]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/prettier.config.cjs
[ui-vs]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.vscode/settings.json
[ui-cl]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.claude/settings.local.json
[ui-rls]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/RELEASING.md
[ui-log]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/packages/shadcn/CHANGELOG.md
[ui-sta]: https://github.com/shadcn-ui/ui/blob/4aaea19d9cff3e0908e12a8c1d504b8c5ec34610/.github/workflows/issue-stale.yml
[pw-sup]: https://github.com/microsoft/playwright/blob/df99adab7ff784412ebf5d0970a03a788184ba6a/SUPPORT.md
[pw-con]: https://github.com/microsoft/playwright/blob/df99adab7ff784412ebf5d0970a03a788184ba6a/CONTRIBUTING.md
[bun-dep]: https://github.com/oven-sh/bun/blob/3bf1a06469dfb356d5563b7f6f84a3919759c66f/.github/dependabot.yml
[bun-pr]: https://github.com/oven-sh/bun/pull/47828
[cca]: https://github.com/anthropics/claude-code-action/blob/main/docs/security.md
[cca-setup]: https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md
[cs-readme]: https://github.com/changesets/changesets/blob/main/README.md
[rp-man]: https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md
[nsemver]: https://github.com/npm/node-semver/blob/main/README.md
[pnpm-src]: https://github.com/pnpm/action-setup/blob/master/src/install-pnpm/run.ts
[pnpm-pub]: https://pnpm.io/cli/publish
[kac2]: https://keepachangelog.com/en/2.0.0/
[kac2-src]: https://github.com/olivierlacan/keep-a-changelog/blob/08d0df5a7e93b71d902def8be0f0d40025b56289/source/en/2.0.0/index.html.md
[semver]: https://semver.org/
[npm-tp]: https://docs.npmjs.com/trusted-publishers/
[npm-prov]: https://docs.npmjs.com/generating-provenance-statements/
[gh-prof]: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories
[gh-sec]: https://docs.github.com/en/actions/reference/security/secure-use
[gh-env]: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
[gh-dep]: https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference
[gh-eco]: https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories
[gh-imm]: https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases
[sc]: https://github.com/ossf/scorecard/blob/ab792da5b906666164d82faa3378374fc664aad0/docs/checks.md
[osg-bp]: https://github.com/github/opensource.guide/blob/e7ac98e94600c5eea834f9a026c000d26b28df24/_articles/best-practices.md
[osg-legal]: https://github.com/github/opensource.guide/blob/e7ac98e94600c5eea834f9a026c000d26b28df24/_articles/legal.md
[cc3]: https://www.contributor-covenant.org/version/3/0/code_of_conduct/
[azu]: https://github.com/azu/setup-npm-trusted-publish
[npm-trust]: https://docs.npmjs.com/cli/v11/commands/npm-trust
[npm-stage]: https://docs.npmjs.com/staged-publishing/
[npm-stage-cli]: https://docs.npmjs.com/cli/v11/commands/npm-stage
[npm-tok]: https://docs.npmjs.com/about-access-tokens/
[gh-lock]: https://github.blog/changelog/2026-10-28-github-actions-workflow-lockfiles-are-generally-available/
