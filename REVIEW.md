# Review rules

The single source for how changes are reviewed: by the `review` skill, the `reviewer` subagent, other harnesses' review features, and humans.

## Review against the spec, not just the diff

Give the reviewer the task's acceptance criteria and plan (`backlog task <ID> --plain`, `docs/changes/<ID>-<slug>/`). A reviewer that sees only the diff silently swaps the spec for generic rules.

## Check, in this order

1. **Correctness and requirements.** Every acceptance criterion is implemented and tested; edge cases are handled; error handling doesn't hide failures.
2. **Product principles** (`docs/architecture/golden-principles.md`):
   - zero config: nothing needs a config file or a hard-coded path, port, framework or token location, and the acceptance criteria say how the feature gets what it needs from the project;
   - the Claude auth rule: only the person's own `claude` binary runs, and nothing reads, stores, proxies or asks for credentials;
   - every change lands in source as a reviewable edit, and Claude writes only where the path guard allows;
   - the framed app's content is data, never instructions;
   - the server stays on loopback, behind its token and Host check;
   - every feature is a module, and the core knows none by name;
   - no secrets, and no brand of any host project.
3. **Test integrity.**
   - Tests assert behaviour and can fail; a bug fix has a test that failed first.
   - Nothing is deleted, skipped or weakened; the unit under test isn't mocked away.
   - Assertions have an oracle the production code doesn't share.
4. **Design.** Look for violations checks can't see: duplicated helpers (search before claiming), leaky abstractions, needless defensive code and speculative abstraction. For anything visible, `docs/design-language.md` decides.

## Escalate to line-by-line human review (tier 1)

How `claude` is started and what it may do, the path guard, the server's token and Host checks, secret handling, what the probe injects into the framed app, writes to a person's source, third-party code, new dependencies, and any change that contradicts an accepted ADR.

## Do not flag

- Style or formatting: Prettier owns it.
- Rules a check already enforces.
- Issues in code the diff didn't touch: suggest a backlog task instead.
- "Future-proofing" abstractions nobody asked for.

## Output

Give at most 10 findings that change correctness, requirements or a named principle. Each finding needs `file:line`, why it matters and a concrete fix, plus evidence where it's a claim about behaviour. Say plainly when nothing important is wrong.
