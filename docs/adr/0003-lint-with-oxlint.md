---
status: proposed
date: 2026-11-03
decision-makers: []
consulted: []
related: [docs/research/open-source-repo-setup.md]
---

# Lint with oxlint

## Context and problem statement

Truing had types and formatting but no linter, so a contributor's editor couldn't flag likely bugs, and golden rule 3's ban on lint suppressions had nothing to apply to. The project owner asked for lint tooling that gives every developer the same experience. A new dependency needs an ADR (golden rule 4), so this records the choice. It was implemented at the owner's request, and needs their sign-off to become accepted.

## Decision drivers

- Few dependencies, and a fast enough run to sit in `make check`.
- A VS Code extension that works with no extra setup.
- Finds real bugs without a large style debate. Prettier already decides style.

## Considered options

1. oxlint
2. ESLint with typescript-eslint
3. Biome

## Decision outcome

Chosen option: "oxlint", with only the `correctness` category as errors, because it's one pinned dev dependency, needs no plugin tree, and runs in `make check`. It's what opencode and vite use.

### Consequences

- Good, because the whole repo lints in well under a second, so it can run on every commit.
- Good, because the VS Code extension reads the same `.oxlintrc.json` as the command line.
- Bad, because it has fewer rules than ESLint, and no type-aware rules unless `oxlint-tsgolint` is added.

### Confirmation

`pnpm lint` runs in `make check`, so it runs in the git hook and in CI.

## Pros and cons of the options

- **ESLint with typescript-eslint.** The largest rule set, and type-aware. It brings many packages and a slower run, and every repo has to maintain its config.
- **Biome.** One tool for lint and format, but moving would replace Prettier, which works and is already enforced.

## More information

Survey: [open-source repo setup](../research/open-source-repo-setup.md). Revisit if we need a rule only ESLint has, such as the Tailwind class rules planned for the off-token lint.
