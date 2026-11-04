# Contributing to Truing

Thanks for helping. Truing is written largely with AI coding agents and reviewed by people, and the rules here apply to both. [`AGENTS.md`](AGENTS.md) is the map: commands, where things live, the golden rules and the code conventions. Read it first, whichever way you work.

## Set up

You need Node.js 20.19 or newer, [pnpm](https://pnpm.io) 10, `git`, `make` and Python 3.10 or newer for the repo's tooling (standard library only).

```sh
git clone https://github.com/PedramRZM/truing.git
cd truing
pnpm install
pnpm exec playwright install chromium   # the browser Truing uses
make setup                              # once: git hooks and per-harness agent config
make check                              # the gate that also runs on every commit
```

To try your working copy on an app, run it from that app's folder, with the app's dev server running or ready to start:

```sh
pnpm --dir /path/to/truing dev
```

To change a feature, or add one, read [`docs/modules.md`](docs/modules.md): every feature is a module. For anything in Truing's own interface, read [`docs/design-language.md`](docs/design-language.md).

## Write a module

A module is a folder with a `module.ts` that declares what it does, and one file for each part it uses: `probe.ts` runs in the app's frames, `panel.tsx` in Truing's panels, and `server.ts` in Truing's own process. Only `module.ts` is required.

The smallest whole example is [`examples/element-count/`](examples/element-count/). Copy it, list your folder under `modules` in a `truing.config.ts` in a test project, and restart Truing. [`docs/modules.md`](docs/modules.md) covers the rest.

## You don't need a Claude account for most of this

The unit tests need no account and no secrets, and they run on the projects in `test/fixtures/`.

Only `pnpm check-claude` and `pnpm check-first-run` need a real `claude`, and they spend your own usage. Nobody has to run them to contribute.

## Test

```sh
make test                                           # unit tests (Vitest)
pnpm exec vitest run test/unit/camera.test.ts       # one file; add -t "<name>" for one test
pnpm check-first-run                                # the first run on a real claude: spends a little of your usage
```

The unit suite never starts `claude` and fails if a test does.

## Your editor

Everyone gets the same setup in VS Code or Cursor. Open the folder, accept the recommended extensions, and saving formats with Prettier. Lint findings show as you type, and the build and test commands are under **Tasks: Run Task**. `.editorconfig` covers other editors, and `make check` holds everyone to the same result whatever they use.

## How work is tracked

Work lives in [`backlog/`](backlog/) as files, so it's reviewed like code. Change it with the `backlog` CLI, not by hand, since hand edits break its metadata: `make board` shows it, and `backlog task list --plain` lists it. Issues are where people outside the project raise things. Once an issue is accepted, it becomes a task under an epic.

Numbers follow the order to do things in: `TRU-6.4` is the fourth task in the sixth epic. [`docs/roadmap.md`](docs/roadmap.md) shows the epics in order. You don't need a task number to contribute: an issue number is enough.

## Make a change

1. Pick or open an issue. For anything larger than a small fix, agree the shape first: a hard-to-reverse choice (a protocol, the module API, a new dependency) needs an ADR in `docs/adr/`.
2. Branch from `main`. A bug fix starts with a test that fails, and a behaviour change comes with tests.
3. Run `make check`, and look at anything visible on a real app. There's no CI, so paste its result in the pull request. Never skip, delete or weaken a test to get green, and don't use `--no-verify`.
4. Open a pull request using the template: what changed and why, how you verified it, and which agent helped if one did. A person approves every merge.

## Rules a contribution has to meet

- **Zero config.** A feature must never need a config file or a hard-coded project path, port, framework or token location. Its acceptance criteria say how it gets what it needs from the project: read it from the saved profile, or ask Claude to read the project, and ask the person when Claude can't tell.
- **The Claude auth rule.** Truing only ever runs the person's own unmodified `claude` binary. It never reads, stores, proxies or asks for credentials, tokens or login codes, and never shows a login form of its own.
- **No brand of any host project** in code, config, tests, docs or the backlog. `make check` fails on it. Reduce a real app's case to a fixture in `test/fixtures/`.
- **Third-party code** needs a compatible licence, its header and a row in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Report a vulnerability privately, as [`SECURITY.md`](SECURITY.md) describes, not in an issue. By taking part, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
