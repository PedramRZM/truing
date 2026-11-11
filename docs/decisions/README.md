# Decisions

One short file per decision that is hard to reverse or that an agent would otherwise propose
again: architecture, the data model, the language and framework, hosting, an integration, a
public name. `NNNN-short-title.md`, numbered in order, half a page at most.

Write the record before the work that depends on it, and have the owner review it. Record the
"no" as well as the "yes": a rejected approach that is not written down gets re-proposed by the
next session. A record is not edited after it is accepted; a later one replaces it and says so.

    # NNNN. Title

    Date: YYYY-MM-DD   Status: proposed | accepted | replaced by NNNN

    ## Context
    What forced a choice, and the constraints that matter.

    ## Decision
    What we will do, stated plainly, including what we will not do.

    ## Alternatives rejected
    Each with its effort and the reason it lost, in a line or two.

    ## Consequences
    What becomes easier, what becomes harder, what we are now committed to.

    ## Revisit if
    The concrete conditions that would change the answer.

Easy-to-reverse choices do not need a record. Make them and move on.

## Records

0001 to 0008 were written as MADR records before the move to this format (0009) and are kept as
they were accepted. New records use the format above.

| No.                                                                   | Decision                                                                                                                         | Status   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [0001](0001-compose-our-own-injected-browser-modules.md)              | Truing is composed from our own parts, injected by its own browser, with features as modules                                     | accepted |
| [0002](0002-zero-config-through-claude.md)                            | No config: Claude reads the project, Truing checks the answer, a person confirms, and the result is saved outside the repository | accepted |
| [0003](0003-lint-with-oxlint.md)                                      | Lint with oxlint, in `make check` and the editor                                                                                 | proposed |
| [0004](0004-versions-and-releases.md)                                 | Version policy, and a release flow where a person approves every publish                                                         | proposed |
| [0005](0005-nothing-from-a-project-runs-before-a-person-agrees.md)    | Nothing from a project runs before a person agrees, including compiling tokens and loading a config file                         | proposed |
| [0006](0006-full-access-keeps-limits.md)                              | Full access still keeps tests, secret files and what runs later off limits                                                       | accepted |
| [0007](0007-claude-looks-freely-and-asks-before-it-acts.md)           | Claude looks freely in the app, and asks the person before it changes anything                                                   | accepted |
| [0008](0008-a-take-links-the-projects-untracked-environment-files.md) | A take links the project's untracked environment files, and Truing never reads them                                              | accepted |
| [0009](0009-tasks-in-github-issues-and-the-tackroom-harness.md)       | Tasks live in GitHub issues, and the agent harness follows tackroom                                                              | accepted |
