# Roadmap

Truing is an open-source local tool. Run it in any folder, it opens your real running app in its own Chromium window, you inspect and change the UI, and changes land in your source. AI goes through your own unmodified `claude` CLI.

Every milestone holds to one rule: no config. A feature gets what it needs from the saved project profile or by asking Claude to read the project, and it asks you when Claude can't tell. `truing.config.ts` stays optional.

Milestones are in order, and they have no dates. An epic's number is its place in that order, and a task's number is its place in the epic: `TRU-6.4` is the fourth thing to do in the sixth epic. To see an epic's tasks with their status, run `backlog task list -p TRU-6 --plain`.

## Already built

| Epic  | Outcome                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| TRU-1 | Open the real app in Truing: the spikes, the token table, the shell and the module contract                |
| TRU-2 | Inspect anything on the page: component, variant, source, tokens, instances, spacing and the context menu  |
| TRU-3 | A shell that works like a design tool: theme, fonts, panels, tool rail, layers and the shared controls     |
| TRU-4 | Edit on tokens, and stage every change: the Changes tray, the direct edit engine and the properties panels |

The decisions behind them are in [ADR 0001](adr/0001-compose-our-own-injected-browser-modules.md).

## v0.1 Zero-config foundation

Run `truing` in a folder and reach your app, with nothing to write and nothing added to your project.

- **TRU-5, Claude inside Truing.** Chat, undo and the project's instructions are built (TRU-5.1, TRU-5.2). The findings from reviewing them get fixed before anyone else relies on it (TRU-5.3).
- **TRU-6, zero-config setup.** Done. Truing checks Claude Code for real, hands sign-in to Claude Code itself, offers projects, has Claude read one into a profile, and shows every value with its reason. Only the start command is required, and nothing runs until a person confirms it. A `truing.config.ts` is shown and confirmed before it's loaded, since loading it runs it. `pnpm check-first-run` proves this against a real `claude`.

## v0.2 Everyone can install it

- **TRU-7, open-source readiness.** The browser tests are green (TRU-7.1, done), and run on every PR next (TRU-7.2). `npx truing` works for someone who has never heard of this repository (TRU-7.3), with a release workflow and changelog (TRU-7.4), verified on macOS (TRU-7.5), with a demo and docs site (TRU-7.6) and first issues for contributors (TRU-7.7).
- **TRU-8, read everything through Claude.** Writable and off-limits files come with evidence (TRU-8.1), and reads get a cache and a cost budget (TRU-8.2). Tokens not on Tailwind v4 go into the same table (TRU-8.3), and a stale profile is noticed and only what changed is re-read (TRU-8.4). A failed start is explained from its log (TRU-8.5), and missing dependencies are offered as a fix (TRU-8.6).
- **TRU-9, more frameworks and platforms.** The UI says honestly what works on each framework (TRU-9.1), and a Vite and React adapter comes first (TRU-9.2).
- **TRU-10, day to day on real projects.** The inspector is tested on heavy signed-in screens (TRU-10.1). The shell gains a project switcher (TRU-10.2) and a settings screen for the profile (TRU-10.3), and adding your own module takes one line (TRU-10.4).

## v0.3 Design system round trip

Tokens go all the way round, and changes go back to the developer.

- **TRU-11, stay on the design system.** You can see every token (TRU-11.1), see what's off-token on the page (TRU-11.2, TRU-11.3), sample a colour and get a token back (TRU-11.4), and create a token where your project defines them (TRU-11.5). The same check runs in source as a lint with a baseline (TRU-11.6).
- **TRU-12, Claude applies what the panels can't.** Claude gets design tools (TRU-12.1) and applies what the direct engine can't write, checked at every size (TRU-12.2).
- **TRU-13, hand changes back as a pull request.** Opening a branch takes one command (TRU-13.1), and handing changes back is a PR that follows your project's own naming and template (TRU-13.2). A pilot on a project Truing has never seen measures all of it, and decides the open questions in the workflow spec (TRU-13.3).

## v1.0 Team ready

What a team needs day to day.

- **TRU-14, pages, frames and takes.** A board of routes (TRU-14.1, TRU-14.2), a Pages section (TRU-14.3), and several AI takes side by side (TRU-14.4, TRU-14.5).
- **TRU-15, components across the app.** A gallery from whatever the project has (TRU-15.1), look-alike components (TRU-15.2), and swapping an icon (TRU-15.3).
- **TRU-16, everyday editing.** Element states and contrast (TRU-16.1), component colours (TRU-16.2), sizing labels (TRU-16.3), spacing handles (TRU-16.4), add flex (TRU-16.5), copy as PNG (TRU-16.6), copy and paste styles (TRU-16.7), a view menu (TRU-16.8), drag to reorder (TRU-16.9), insert text or a frame (TRU-16.10), a command palette (TRU-16.11), and a decision on an inline surface (TRU-16.12).
- **TRU-17, teach, annotate and measure with Claude.** Annotate and draw (TRU-17.1), teach Claude your rules (TRU-17.2), and performance findings it can measure (TRU-17.3, TRU-17.4).
- **TRU-18, Claude works in Truing.** An idea to prove, starting with a spike on what Claude may do on its own (TRU-18.1). Claude creates frames (TRU-18.2), takes screenshots (TRU-18.3) and moves through the app (TRU-18.4). It finds layout shifts (TRU-18.5), incorrect mounting and odd layouts (TRU-18.6), and regressions (TRU-18.7), reviews a route on request (TRU-18.8), and compares its takes (TRU-18.9).
- **TRU-19, teams.** API-key and cloud-provider sign-in (TRU-19.1), a shared profile that stays optional (TRU-19.2), and a token export for Figma (TRU-19.3).
- **Reach, finishing earlier epics.** Several apps in a monorepo (TRU-8.7), React Router and Remix (TRU-9.3), Astro (TRU-9.4), a Vue spike (TRU-9.5), and Windows (TRU-9.6).

The product-level epic for visual refinement (TRU-20) closes here.
