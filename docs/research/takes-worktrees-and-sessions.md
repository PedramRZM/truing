---
title: 'Several takes at once: worktrees, dev servers, sign-in across ports, and Claude sessions'
date: 2026-11-07
status: concluded
question: 'Can an ordinary machine run several takes of one change side by side, each with its own worktree, dev server and Claude session, and what does a round cost?'
method: "Measured on one machine (Linux, 8 cores, 32 GB) against the real app: Next 16.2.9 with Turbopack, pnpm 10.24, 2.5 GB of node_modules. Three git worktrees outside the app's folder, three dev servers, three real `claude` sessions (Claude Code 2.1.319) on the owner's plan, with the owner's agreement. Commands below. Everything was removed afterwards."
revisit_by: 2027-02-07
outcome: 'TRU-14.5 (takes side by side), TRU-18.9 (comparing takes)'
---

# Several takes at once: worktrees, dev servers, sign-in across ports, and Claude sessions

## Answer

- **Worktrees, not a switch in one tree.** Each take gets a worktree and branch off the hand-back branch, its own dev server on a free port, and its own Claude session. Nothing temporary is written into the person's own checkout.
- **Cap: 3 takes**, as a default with no setting. Each take's dev server held about 2.3 GB once it had compiled one heavy page, so three takes and the person's own server come to about 9 GB.
- **Installs are cheap; first compiles are not.** A take's install from the package manager's store took 8 to 9 s. Its first load of a heavy page took 45 to 49 s, compiling from nothing; later loads took 0.3 s.
- **Each take needs its own install.** Borrowing the checkout's `node_modules` through a symlink stops Turbopack.
- **A take needs the project's untracked environment files.** Without them the app ran, but sign-in failed. Carrying them into a take touches secret files, so it needs a decision (below).
- **Sign-in carries across takes.** Cookies ignore the port, and the provider accepted a sign-in returning to a take's port. With the environment files present, one sign-in should serve every take; not seen end to end.
- **Three Claude sessions at once worked.** A take of a small change took 25 to 35 s and about $0.55 in Claude Code's own estimate, so a round of three is about $1.70 of a plan's usage.
- **Takes converge unless told not to.** Two of three takes asked for different directions made the same change. The prototyping prompt must hold each take to its direction, and Truing should notice when two takes match.

## No per-project setup

- **Install**: the package manager the lockfile names (here `pnpm install --frozen-lockfile`, from its store), the same reading setup already makes; nothing is configured for takes.
- **Start**: the profile's start command, moved to a free port with `commandOnPort` and `PORT`, as Truing already does when the port on record is taken (TRU-10.10).
- **A project that can't run twice** (a fixed port it ignores, a lock outside the folder) gets a plain message that takes need the app to run more than once, and the one-tree option is not offered instead (above).

## Findings

All are measurements on 2026-11-07 with the commands in the appendix (primary).

| Step                                                                 | Result                                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `git worktree add -b <branch> <path> HEAD`, three times              | 0.6 to 1.0 s each, 140 MB of checked-out files each                                                   |
| `pnpm install --frozen-lockfile --offline` in a take                 | 9.4 s, ran the project's `prepare` script                                                             |
| `pnpm install --frozen-lockfile` in a take                           | 8.1 s                                                                                                 |
| `node_modules` as a symlink to the checkout's                        | `next dev` stopped: "Symlink [project]/node_modules is invalid, it points out of the filesystem root" |
| Three `pnpm dev -p <port>` at once                                   | each "Ready" in about 0.4 s                                                                           |
| First load of the heavy page, two takes compiling at once            | 45.0 s and 48.8 s                                                                                     |
| The same page again                                                  | 0.25 s and 0.37 s                                                                                     |
| Memory of a take's server after that page                            | `next-server` 2.27 GB proportional (2.36 GB resident), `next dev` 77 MB                               |
| Sign-in on a take without the project's untracked environment files  | 500: the app had no identity provider address                                                         |
| The provider asked to return to `localhost:3101` instead of `:3000`  | its sign-in page, as for `:3000`                                                                      |
| Three `claude -p` at once, one per take, a small styling change each | all succeeded in 40 s; 25, 25 and 35 s; 4 to 6 turns; $0.548, $0.560, $0.597                          |
| What the three takes changed                                         | take 1 and take 2 both added `text-title-2xl`; take 3 added `font-bold text-primary`                  |

A first round asked for a change in a file that only chooses which component to show. All three sessions declined rather than edit outside the file they were given, in 33 to 38 s for about $0.49 each: a take with too narrow a brief still costs a round.

## Claims ledger

| #   | Claim                                                            | Source                               | Verifier verdict |
| --- | ---------------------------------------------------------------- | ------------------------------------ | ---------------- |
| 1   | A take's install from the store takes 8 to 9 s                   | appendix, step 2                     | not verified     |
| 2   | Turbopack refuses a symlinked `node_modules` outside the project | appendix, step 3, its error          | not verified     |
| 3   | A take's server holds about 2.3 GB after one heavy page          | appendix, step 4                     | not verified     |
| 4   | The provider accepts a return to another localhost port          | appendix, step 5                     | not verified     |
| 5   | Three concurrent takes cost about $0.55 each                     | appendix, step 6, Claude Code's JSON | not verified     |

## Options and trade-offs

- **Worktrees** keep every take real (its own server, its own Claude session, its own branch) and leave the person's checkout alone. They cost memory and a slow first compile.
- **Sibling components behind a temporary switch** in the person's own tree need one server and no install, but write throwaway code into the person's source and need a clean-up that must never miss. ADR 0001 puts every change through a reviewable edit; a switch would be a change the person never asked for. Not chosen.
- **Carrying environment files into a take** has three ways: copy them, link them, or ask the person. Copying puts a second copy of secrets on disk. A link keeps one copy and Truing never reads it. Claude Code's own worktrees copy what a project's `.worktreeinclude` lists. This is a choice about secret files, so it is the owner's (golden rule 5) and needs an ADR before TRU-14.5 builds it.

## Open questions and unverified claims

- **Environment files in a take**: link, copy what `.worktreeinclude` lists, or ask. Needs the owner's decision.
- **Warming a take's first compile** by copying the checkout's build cache was not tried.
- **Sign-in end to end in a take**, with the environment files present, was not seen.
- **One machine only.** A 16 GB machine would fit one or two takes, not three.
- **Prompt for diverging takes**: TRU-14.5's evaluation should measure how often takes match.

## Appendix: the commands

From the Truing checkout, with the app's checkout at `$APP` and takes under `~/.cache/truing/takes/<project>/`:

1. `git -C $APP worktree add -q -b truing-take-$n ~/.cache/truing/takes/app/take-$n HEAD`
2. In a take: `pnpm install --frozen-lockfile --offline`, or without `--offline`.
3. In a take: `ln -s $APP/node_modules node_modules`, then `pnpm dev -p 3102`.
4. In each take: `pnpm dev -p 310$n`; `curl -w '%{time_total}' http://localhost:310$n/<heavy page>`; the server's memory from `/proc/<pid>/smaps_rollup` (`Pss:`) and `ps -o rss=`.
5. `curl` of the provider's authorize URL with `redirect_uri=http://localhost:3101/api/auth/loginCallback`, and the client id from the app's own sign-in redirect.
6. In each take at once: `claude -p "<brief>" --output-format json --max-turns 8 --permission-mode acceptEdits --allowedTools "Read,Edit"`, then `num_turns`, `duration_ms` and `total_cost_usd` from its JSON.
7. Clean-up: `git worktree remove --force <path>` and `git branch -D truing-take-$n`.
