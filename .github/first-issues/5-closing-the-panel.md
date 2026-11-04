# Closing the right panel loses a half-written message

Type a message to Claude, close the right panel with its button, and open it again: the message is gone. The same happens to unsaved text in the file viewer.

Switching between the panel's tabs already keeps both, because a tab that isn't showing stays mounted and hidden.

**Why it happens.** Closing the panel unmounts what's inside it, in `src/shell/docks.tsx`.

**What to change.** Keep the panel's contents mounted while it's closed, and hide them so they can't be reached by keyboard or by a screen reader. Check that nothing starts working harder while hidden.

**How to prove it.** Run your copy of Truing on any app, as `CONTRIBUTING.md` describes: type in the composer, close and reopen the panel, and find the same text. Say what you did in the pull request, with a screenshot. No Claude account is needed for this. Then run `make check`.
