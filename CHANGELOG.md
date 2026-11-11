# Changelog

What changed for people using Truing, in plain words. An agent may draft an entry, and a person always edits it. [`docs/maintaining.md`](docs/maintaining.md) explains how.

Truing is on 0.x, so the version says what to expect:

- **The middle number goes up** when something breaks: the `truing` command, the module API in [`docs/modules.md`](docs/modules.md), or a saved profile Truing can't migrate by itself.
- **The last number goes up** for everything else.

## Unreleased

## 0.1.1

**Outlines are off by default.** In Select mode, the blue boxes and labels on what you hover and pick no longer cover the page while you judge a change. The properties panel still shows what you picked. Turn the boxes on with the new Outlines tool in the left rail, or press B.

**Frames you keep.** The canvas holds up to twelve frames, and Truing remembers them for each project, so the next start opens the board as you left it. Cmd/Ctrl-click a link in Select mode, or choose "Open link in new frame" from the right-click menu, to open it in a frame beside the one it came from. New frame in the top bar copies the selected frame. Double-click a frame's name to rename it, and use Undo on the notice to bring back one you closed. With a frame selected, the route box, the device menu and Side by side change only that frame. A page your app opens in a new tab now opens as a frame too, instead of leaving Truing. If the board can't be saved, Truing says so and keeps running.

**Claude works on the canvas.** Claude can list, open, resize, move and close frames, and take a picture of one. Frames it opens show a small Claude mark, and it can't close yours. It can also scroll a frame and point at, click or type into what's on the page. Before each click or bit of typing, it asks you in the chat, whatever permission mode you're in. A turn stops after 60 tool calls and tells you.

**Starting your app.** If your app is already running, Truing uses it, on whatever port its start command chose. When there are several, Truing names them instead of guessing. If the start command can't run without a terminal, as in some turborepo setups, you can start the app yourself, and Truing opens it once it answers. A Storybook or another server that happened to be running is no longer taken for your app.

**Signing in.** Apps that sign in through another site, such as an identity provider, now work: that site opens in a window of its own, and your frames return to the app once sign-in comes back.

## 0.1.0

The first public version. Run `truing` in a project's folder to open your running app in Truing's own window, inspect anything on the page, and change it from panels that offer your tokens. Exact changes go straight into your source, and Claude handles the rest on your own Claude Code login. Only the start command has to be known: Truing finds the port when the app starts. If a project has a `truing.config.ts`, you see it and confirm it before it runs.

You can change what setup confirmed later, in the Settings tab, and give Truing and Claude the whole project rather than only your UI files. Claude knows which pages and sizes are on the canvas, so asking about "this page" works with nothing picked.

Claude's answers show as formatted text, the chat's controls stay in reach in a long chat, and a permission prompt can be answered from any panel and doesn't time out. Undo stays to the files Claude changed, says what it left alone, and tells you when a project outside git can't be undone.
