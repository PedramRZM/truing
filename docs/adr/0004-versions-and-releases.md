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
- Agents help on the person's own machine, under their own login (golden rule 8), with no provider secret in CI.
- No long-lived npm token in the repository.
- A changelog people want to read.

## Considered options

1. A hand-curated changelog drafted by an agent, with a small workflow of our own
2. Changesets
3. release-please or git-cliff

## Decision outcome

Chosen option: "a hand-curated changelog drafted by an agent", because Truing publishes one package, and generated changelogs read like commit logs.

- **Versions.** While on 0.x, the middle number goes up for anything breaking in the `truing` command, the module API or a saved profile that can't migrate itself, and the last number for everything else.
- **Flow.** A person runs the `release` skill with their own agent, which drafts a PR. A person merges it. CI runs the gates. A person approves a GitHub `release` environment. CI publishes with npm trusted publishing.

### Consequences

- Good, because no agent can publish on its own in any harness: the gate is on GitHub.
- Good, because no dependency is added and no npm token is stored.
- Bad, because a workflow of our own has to be maintained, and a person has to edit each entry.

### Confirmation

The workflow is built and tested in the task for the release workflow and changelog (TRU-7.4). `CHANGELOG.md` states the policy at the top.

## Pros and cons of the options

- **Changesets.** Used by biome, astro and shadcn/ui, which publish several packages. Coordinating packages is its main value, and Truing has one. It would add a dependency and a file per PR.
- **release-please, git-cliff.** Generate text from commits, and none of the six projects studied use them.

## More information

Open for the owner to decide, with the options in [the research note](../research/open-source-repo-setup.md#recommended-release-flow):

- how to do the first publish, as npm needs a package to exist before a trusted publisher can be set;
- direct or staged publishing;
- whether a GitHub Release generated from the changelog counts as hosted output under golden rule 12.
