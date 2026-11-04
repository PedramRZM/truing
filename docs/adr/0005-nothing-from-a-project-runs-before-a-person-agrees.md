---
status: proposed
date: 2026-11-04
decision-makers: []
consulted: []
related: [TRU-6.4, TRU-6.5, docs/adr/0002-zero-config-through-claude.md]
---

# Nothing from a project runs before a person agrees

## Context and problem statement

ADR 0002 says a token stylesheet must compile as part of checking Claude's answer, before the review screen. A security review of the first run proved that does more than it sounds like: compiling imports the project's own `tailwindcss`, and a repository can commit a fake one, so its code ran before anyone had seen anything. Loading a `truing.config.ts` has the same problem, because loading it runs it. This changes what ADR 0002 decided, so it needs its own record and the owner's decision.

## Decision drivers

- Trying a tool on a repository you just cloned shouldn't run that repository's code before you've agreed.
- Zero config stays: a person shouldn't have to do more than confirm.

## Considered options

1. Nothing of a project's runs until a person has confirmed
2. Keep compiling at read time, and sandbox it
3. Keep compiling at read time, and accept the risk

## Decision outcome

Chosen option: "Nothing of a project's runs until a person has confirmed", because it needs no sandbox and costs only a later check.

- **The read only checks against the folder.** A token stylesheet is compiled once a person presses Start, and one that won't compile leaves the project without tokens, with the reason.
- **A `truing.config.ts` is shown, then confirmed, before it's loaded.** Truing keeps a hash of what was shown, outside the project, and asks again when the file changes. A file that changes while it's on screen isn't run.
- **`truing setup` and `truing tokens` need a project someone has opened in Truing,** as both run things from it.

### Consequences

- Good, because a repository can't run anything just by being opened.
- Bad, because a broken stylesheet shows up at Start, not on the review screen.
- Bad, because confirming isn't a sandbox. The start command runs the project's code on every start, and a config file's imports and listed modules run without being hashed. The screen says so. Confirming means "I trust this project enough to run it", as with `npm start`.

### Confirmation

`test/unit/first-run-security.test.ts`.

## Pros and cons of the options

- **Sandboxing the compile.** Keeps the check where ADR 0002 put it, but a sandbox for arbitrary Node code on every platform is a project of its own.
- **Accepting the risk.** No work, and any repository could run code on the machine of whoever opens it.

## More information

Supersedes the one sentence of ADR 0002 about when a stylesheet compiles. TRU-10.5 tracks covering a config file's imports and modules in what's confirmed.
