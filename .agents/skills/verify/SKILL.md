---
name: verify
description: Verify the current change in this repo before committing or declaring work done — typecheck, unit tests, e2e for shell changes, verify-ui for anything visible; confirm each acceptance criterion with evidence, inspect the diff for leftovers, and report results honestly. Use before every commit, before moving a task to Review or Done, and whenever someone asks "does it work", "is it done", "check this" or "verify".
---

# Verify

Run this before committing code and before moving a task to Review or Done. Claude Code's commit instructions prompt for it before code commits; in other harnesses, run it yourself. Either way, the git pre-commit hook runs `make check` as the enforced gate. This skill adds the judgement a hook can't: which further checks apply, acceptance criteria and evidence.

1. **Run the gate.** `make check` covers agent-config drift, docs lint and the brand guard, hook tests, `pnpm typecheck`, `pnpm format:check` and `pnpm test`. Read the output rather than assuming it passed.
2. **Run what the change calls for.**
   - The shell, a module, the probe, the server or how the app is started: `pnpm test:e2e`, or the narrowest spec first (`pnpm exec playwright test test/e2e/<file>.spec.ts`) and the whole suite before finishing.
   - Anything a person sees: the `verify-ui` skill at 1280 and 1440 px, in light and dark, against `docs/design-language.md`. Open each screenshot and say what you see.
   - Text a person reads: the `ux-copy` skill.
   - A prompt or what Claude is handed: the `ai-features` skill, and `pnpm check-claude` where it applies. It runs the real `claude`, so say when you couldn't.
3. **Check the product rules against the diff.** Zero config: nothing new needs a config file or a hard-coded path, port, framework or token location. The Claude auth rule: nothing reads, stores, proxies or asks for credentials.
4. **Fix causes, not checks.** Never edit, skip or delete tests, and never add suppressions, to get green. If a test looks wrong, stop and report `BLOCKED: <reason>`.
5. **Prove each acceptance criterion** with evidence: a test name, a command and its output, or observed behaviour. Criteria you couldn't verify stay unchecked and are reported as unverified. Tick verified ones: `backlog task edit <ID> --check-ac <n>`.
6. **Read the diff** (`git diff --stat`, then the full diff) for leftovers: debug output, commented-out code, unrelated changes, secrets, and TODOs without a task.
7. **Report briefly:** what you ran, the results, which criteria are met, and what remains unverified.
