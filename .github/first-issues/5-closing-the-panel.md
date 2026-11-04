# Closing the right panel loses a half-written message

Type a message to Claude, close the right panel with its button, and open it again: the message is gone. The same happens to unsaved text in the file viewer.

Switching between the panel's tabs already keeps both, because a tab that isn't showing stays mounted and hidden.

**Why it happens.** Closing the panel unmounts what's inside it, in `src/shell/docks.tsx`.

**What to change.** Keep the panel's contents mounted while it's closed, and hide them so they can't be reached by keyboard or by a screen reader. Check that nothing starts working harder while hidden.

**How to prove it.** Add an e2e test beside the others in `test/e2e/`: type in the composer, close and reopen the panel, and find the same text. Tests find things by role and name. Run it with `pnpm exec playwright test <your file>`, then run `make check`. No Claude account is needed, since a fake one stands in.
