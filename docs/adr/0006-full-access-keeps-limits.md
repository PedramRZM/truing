---
status: accepted
date: 2026-11-04
decision-makers: [owner]
consulted: []
related:
  [
    TRU-10.7,
    docs/adr/0005-nothing-from-a-project-runs-before-a-person-agrees.md,
  ]
---

# Full access still keeps some files off limits

## Context and problem statement

Some people want Truing and Claude to reach all of a project's code, not only its UI files. Today's path guard always refuses tests. Full access has to say whether that still holds, and what else stays out of reach, because Claude edits unasked inside what's allowed.

## Decision drivers

- A failing test shouldn't go away because Claude edited it.
- Full access is about code. It isn't a way to get at secrets, or to run things later that nobody approved.

## Considered options

1. Full access allows every file
2. Full access allows every file except tests, secret files, and what runs later without a prompt

## Decision outcome

Chosen option: "every file except tests, secret files, and what runs later without a prompt", because editing those would undo the other limits.

- **Tests:** test files and snapshots, and under full access any `test/` or `tests/` folder.
- **Secret files:** neither read nor written.
- **What runs later:** Git's own files and hook managers, `.mcp.json`, and `.claude/` apart from a designer's own rules and skills.
- **Outside the project:** refused, following links.

The owner decided the test question on 2026-11-04.

### Consequences

- Good, because a steered Claude can't push through a hook script, and can't pass by editing a test.
- Bad, because "full access" isn't quite full, so the screen says what's left out.
- Bad, because it isn't a sandbox. Claude can still change `package.json` or other code that runs when the project opens, and the screen says so. Full access means "I trust this project and this Claude with its code".

### Confirmation

`test/unit/project-settings.test.ts`, through both the path guard and the edit engine.

## More information

A list that names `**` with off-limits patterns of its own isn't full access: only an explicit choice is.
