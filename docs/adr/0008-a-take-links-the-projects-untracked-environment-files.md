---
status: accepted
date: 2026-11-07
decision-makers: [the owner]
consulted: []
related: [TRU-14.4, TRU-14.5, docs/research/takes-worktrees-and-sessions.md]
---

# A take links the project's untracked environment files, and Truing never reads them

## Context and problem statement

A take (TRU-14.5) runs in its own git worktree, with its own dev server. A worktree holds only what git tracks, so it lacks the project's untracked environment files. TRU-14.4 measured what that means on a real app: the app ran, but sign-in failed, as the app had no identity provider address. Those files hold secrets. Golden rule 5 says Truing never reads or writes them, and the person's agent hooks block it too. How does a take get them?

## Decision drivers

- A take must behave like the person's own app, signed in included, or comparing takes means little.
- Secrets must not be read by Truing or Claude, nor copied around more than needed.
- No configuration: it has to work on a project Truing has never seen.

## Considered options

1. **Link them.** Each take gets a symbolic link to the checkout's own files: those the project's `.worktreeinclude` lists, or, without one, the environment files at the project's root, found by name.
2. **Copy what `.worktreeinclude` lists**, as Claude Code's own worktrees do.
3. **Ask the person each time** which untracked files a take may link to, listing names only, and save the answer with the project.

## Decision outcome

Chosen option: 1, "link them". The owner chose it on 2026-11-07, when asked with all three options.

- Truing creates links only. It never opens, reads, copies or prints the files, and it finds them by name only (a directory listing).
- With a `.worktreeinclude`, its list decides. Without one, the files at the root whose names start with `.env`, except examples and templates (`.env.example`, `.env.sample`, `.env.template`), are linked.
- The links are removed with the take's worktree. The person's own files are never touched.

### Consequences

- Good, because one copy of each secret stays on disk, where the person put it.
- Good, because a take signs in as the person's app does: cookies ignore the port, and TRU-14.4 saw the provider accept a take's port.
- Bad, because a take sees the checkout's files as they are now: a change to them shows in every take at once. That is the person's own file, so it is what they would expect.
- Bad, because a project that keeps environment files outside its root, or under other names, needs a `.worktreeinclude` for takes to find them. Truing says so when a take can't sign in.

### Confirmation

- A unit test of the link step: the right names are linked, examples are not, and nothing's contents are read (the test fixtures hold no secrets).
- REVIEW.md tier 1 already escalates secret handling to line-by-line human review; TRU-14.5's change goes there.

## Pros and cons of the options

- **Option 2** matches Claude Code, but leaves a second copy of every secret per take and copies nothing for a project without `.worktreeinclude`.
- **Option 3** gives the person full control, but stops the first take on a question most people answer the same way.

## More information

Revisit if a framework turns out not to follow links when it loads environment files, or if a project's tooling refuses a linked file. TRU-14.4 didn't try a link to an environment file; its first take with one is the check.
