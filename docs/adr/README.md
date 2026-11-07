# Architecture decisions

Binding decisions. An accepted ADR isn't edited: a new one supersedes it.

| ADR                                                                | Decision                                                                                                                         | Status   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [0001](0001-compose-our-own-injected-browser-modules.md)           | Truing is composed from our own parts, injected by its own browser, with features as modules                                     | accepted |
| [0002](0002-zero-config-through-claude.md)                         | No config: Claude reads the project, Truing checks the answer, a person confirms, and the result is saved outside the repository | accepted |
| [0003](0003-lint-with-oxlint.md)                                   | Lint with oxlint, in `make check` and the editor                                                                                 | proposed |
| [0004](0004-versions-and-releases.md)                              | Version policy, and a release flow where a person approves every publish                                                         | proposed |
| [0005](0005-nothing-from-a-project-runs-before-a-person-agrees.md) | Nothing from a project runs before a person agrees, including compiling tokens and loading a config file                         | proposed |
| [0006](0006-full-access-keeps-limits.md)                           | Full access still keeps tests, secret files and what runs later off limits                                                       | accepted |
| [0007](0007-claude-looks-freely-and-asks-before-it-acts.md)        | Claude looks freely in the app, and asks the person before it changes anything                                                   | accepted |
