# ADR 0002: zero config, by asking Claude to read the project

- Status: accepted
- Date: 2026-11-03

## Context

ADR 0001 kept everything specific to a project in one config file. That's fine for one project and a dealbreaker for anyone else: dev command, port, primitives, tokens and writable paths are all things you'd have to look up before you could try the tool. Every project differs, and a list of framework rules would always be behind.

## Decision

Nobody writes a config. On the first run in a folder:

1. **Claude reads the project**, through the person's own Claude Code, with read-only tools, no project settings or hooks, secrets denied, and a JSON schema for the answer. Claude says where each value came from.
2. **Truing checks the answer against the folder.** It doesn't trust it: a path must exist inside the project, a port must be a port, a glob can't climb out, and a token stylesheet must compile. A value that fails is dropped with the reason.
3. **The person decides what's left.** Anything Claude couldn't settle becomes a question on the review screen. The person confirms the start command before anything runs, because a repository's contents can try to influence what Claude reports.
4. **Reality gets the last word.** Truing runs the app and follows the port it really answers on, and asks the system who holds a port before attaching to it.
5. **The result is saved outside the repository**, one file per folder under the person's config directory.

Features get what they need from that saved profile, or by asking Claude the same way. A `truing.config.ts` at a project's root still wins if there is one, for people who want settings in git and for listing their own modules. Nothing requires it.

Sign-in stays with Claude Code. Truing runs the unmodified `claude` binary, starts `claude auth login` with its terminal inherited and unread, and never holds a credential or shows a login form.

## Consequences

- The first run costs one Claude run on the person's own plan, about 15 to 40 seconds.
- Truing needs Claude Code to set up without typing. "Set up without Claude" fills the same screen by hand.
- Wrong answers are possible, so the review screen isn't optional, and every value shows its evidence.
- Tokens are read deterministically only for Tailwind v4. Other forms come later through Claude, into the same table (TRU-8.3).
- Truing compiles tokens with the project's own `tailwindcss`, not a pinned copy, so it works across versions. The compiler API is unstable upstream, so an API change shows up as "no compiler API" and the project opens without tokens.
- Truing removes framing headers (`X-Frame-Options`, CSP) from the app's pages inside its own frames, through a local browser extension. A framed page therefore runs without its CSP inside Truing.
