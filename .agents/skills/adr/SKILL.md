---
name: adr
description: Write or update an architecture decision record (MADR format) in docs/adr/ for any hard-to-reverse choice: protocols, the module API, how Claude is driven, what a person's project comes to rely on, external dependencies, licensing. Use whenever a decision is being made or revisited, when someone asks "should we use X or Y", or when a plan depends on a decision nobody has made.
---

# Architecture decision record

1. **Check history.** Look in `docs/adr/README.md` for decisions on the same topic; supersede an existing ADR rather than contradicting it silently.
2. **Gather evidence.** Link research reports (`docs/research/`), reference notes (`docs/references/`) and prior art. If evidence is missing, run the `research` skill first.
3. **Write it.** Create `docs/adr/<NNNN>-<kebab-title>.md` (next free number) from `docs/templates/adr.md`. Fill in:
   - the context and problem;
   - the decision drivers;
   - at least two considered options with honest pros and cons;
   - the decision and its consequences;
   - **confirmation**: how compliance will be checked (test, check or review item).
4. **Status.** Keep it `proposed` until a human accepts it. Agents don't accept ADRs. Record who decided and when.
5. **Index and maps.** Add the ADR to `docs/adr/README.md`. If it changes where things live or the rules, update `AGENTS.md` or `docs/architecture/golden-principles.md` in the same change.
