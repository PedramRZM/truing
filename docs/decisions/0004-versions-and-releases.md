---
status: proposed
date: 2026-11-03
decision-makers: []
consulted: []
related: [docs/research/open-source-repo-setup.md]
---

# How Truing is versioned and released

## Context and problem statement

Truing has no release process yet, and people will come to rely on its command, its module API and its saved profiles. That needs a stated version policy and a release flow before the first publish. Some choices below are the owner's and are still open.

## Decision drivers

- A person approves anything that publishes, whichever coding agent they use.
- Agents help on the person's own machine, under their own login (golden rule 8).
- No npm token stored anywhere.
- A changelog people want to read.

## Considered options

1. A hand-curated changelog drafted by an agent, with a small workflow of our own
2. Changesets
3. release-please or git-cliff

## Decision outcome

Chosen option: "a hand-curated changelog drafted by an agent", because Truing publishes one package, and generated changelogs read like commit logs.

- **Versions.** While on 0.x, the middle number goes up for anything breaking in the `truing` command, the module API or a saved profile that can't migrate itself, and the last number for everything else.
- **Flow.** A person runs the `release` skill with their own agent, which drafts a PR. A person merges it, then publishes from a clean clone with `npm publish`, which runs the gates first and asks for their two-factor code. The owner removed CI on 2026-11-04, so nothing runs on a server. Then the tag is pushed and a GitHub Release is made on it from the changelog entry (see More information).

### Consequences

- Good, because no agent can publish on its own: it takes the person's npm login and two-factor code.
- Good, because no dependency is added and no npm token is stored.
- Bad, because a person has to edit each entry, and a release is only as clean as the machine it's published from.
- Bad, because with no CI there's no npm provenance, so nobody can check which commit built a version.

### Confirmation

`prepublishOnly` in `package.json` and `test/unit/release.test.ts` (TRU-7.4). `CHANGELOG.md` states the policy at the top.

## Pros and cons of the options

- **Changesets.** Used by biome, astro and shadcn/ui, which publish several packages. Coordinating packages is its main value, and Truing has one. It would add a dependency and a file per PR.
- **release-please, git-cliff.** Generate text from commits, and none of the six projects studied use them.

## More information

The owner decided on 2026-11-11 that each published version gets a GitHub Release, despite the rule against hosted output (AGENTS.md). Its notes are the version's `CHANGELOG.md` entry, word for word: `node scripts/check-release.mjs --notes <version>` prints it. The Release is made on the version's tag only after `npm publish` succeeded, so it never announces a version npm doesn't have. `CHANGELOG.md` stays the source, and the Release is a copy of it.
