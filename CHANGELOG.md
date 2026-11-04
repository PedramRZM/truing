# Changelog

What changed for people using Truing, in plain words. An agent may draft an entry, and a person always edits it. [`docs/maintaining.md`](docs/maintaining.md) explains how.

Truing is on 0.x, so the version says what to expect:

- **The middle number goes up** when something breaks: the `truing` command, the module API in [`docs/modules.md`](docs/modules.md), or a saved profile Truing can't migrate by itself.
- **The last number goes up** for everything else.

## Unreleased

## 0.1.0

The first public version. Run `truing` in a project's folder to open your running app in Truing's own window, inspect anything on the page, and change it from panels that offer your tokens. Exact changes go straight into your source, and Claude handles the rest on your own Claude Code login. Only the start command has to be known: Truing finds the port when the app starts. If a project has a `truing.config.ts`, you see it and confirm it before it runs.

You can change what setup confirmed later, in the Settings tab, and give Truing and Claude the whole project rather than only your UI files. Claude knows which pages and sizes are on the canvas, so asking about "this page" works with nothing picked.

Claude's answers show as formatted text, the chat's controls stay in reach in a long chat, and a permission prompt can be answered from any panel and doesn't time out. Undo stays to the files Claude changed, says what it left alone, and tells you when a project outside git can't be undone.
