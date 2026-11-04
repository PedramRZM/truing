# What works where

Truing opens any web app that runs on `localhost`, and asks Claude to read it. How much it can do after that depends on the stack.

## Frameworks

| Your app                 | View it, resize it, work with Claude | Pick an element and find its code | Direct edits to source |
| ------------------------ | ------------------------------------ | --------------------------------- | ---------------------- |
| Next.js 16 with React 19 | Yes                                  | Yes                               | Yes                    |
| Any other framework      | Yes                                  | May not find the file             | Only where it's found  |

The review screen says so when your project isn't on Next.js. Adapters for Vite, React Router and Astro are planned in [the roadmap](roadmap.md).

## Styling

| Your styling           | What you get                                       |
| ---------------------- | -------------------------------------------------- |
| Tailwind v4            | Panels offer your tokens, and edits write classes  |
| Tailwind v4, no tokens | Panels show raw values, and edits write classes    |
| Anything else          | You can inspect, and ask Claude to make the change |

Truing uses your project's own Tailwind, once you've pressed Start.

## Computers

| System  | State                                                 |
| ------- | ----------------------------------------------------- |
| Linux   | Tested on every change                                |
| macOS   | Written to work, and not yet tried on a clean machine |
| Windows | Not supported yet                                     |
