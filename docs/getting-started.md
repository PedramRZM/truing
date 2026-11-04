# Getting started

In your project's folder:

```sh
npx truing
```

That's the only command. You need Node.js 20.19 or newer and [Claude Code](https://claude.com/claude-code). Truing gets its own browser the first time, which takes a minute.

## What happens

1. **Truing checks Claude Code.** If you aren't signed in, it opens Claude Code's own sign-in. Truing never sees your login.
2. **Claude reads your project.** It's read-only, stays inside the folder, and can't open secret files.
3. **You review what it found.** Nothing of your project runs until you press Start. Check the start command, and answer anything Claude couldn't tell.
4. **Your app opens in Truing's window.** Press V and click anything to see its component, its tokens and where its code is.

## Change something

Pick an element and change a value in the panel on the right. It previews on the page straight away. Press Apply in the Changes tray, and the change goes into your source as a normal edit you can review with `git diff`.

For anything bigger, ask Claude in the Claude tab, or press A on what you picked. It uses your own Claude Code login and your project's own rules, and you can undo each turn.

## Change your mind later

Everything from the review screen is in the **Settings** tab. That's also where you can give Truing and Claude the whole project rather than only your UI files.

## Optional

You don't need a config file. If you want your settings in git, or want to add your own modules, you can add a `truing.config.ts`: [the README](../README.md#where-settings-live) explains it, and [`modules.md`](modules.md) covers writing a module.

## What works today

See [what works where](frameworks.md).
