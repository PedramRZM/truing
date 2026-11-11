# Project memory

What earlier sessions learned about this project the hard way. One line per file. This index is
kept by the `dream` pass; read it to find the file you need, then read that file.

## Runtime

- [[connected-is-not-hydrated]]: a connected frame isn't a hydrated one; wait for React before driving the page in tests.

## Testing

- [[first-run-on-real-projects]]: what the first runs on real projects found that the unit suite didn't.

## Tooling

- [[hooks-in-a-worktree-leak-git-variables]]: a git hook in a linked worktree leaks GIT_* variables to every child git, so a test's temporary repository acts on the real one.
