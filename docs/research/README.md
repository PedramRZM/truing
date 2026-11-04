# Research

Notes written while Truing was being designed, kept so a decision can be traced to its evidence.

**How to read these.** They were written when Truing was being built inside one real project: Next 16, React 19, Tailwind v4, shadcn. "Our stack", "the real app" and "for us" mean that project, and route names like `/main` and `/list` are placeholders for its pages. Numbers measured on it are facts about that one project, not about every project. Truing now runs in any folder, and "the designer" in a note means whoever is using it. Task numbers such as TRU-2.2 are in `backlog/`.

| Note                                                                   | What it answers                                                                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [claude-subscription-bridge.md](claude-subscription-bridge.md)         | How a local tool can run Claude on a person's own plan, within Anthropic's terms. Written when the tool was internal, so re-read the terms for a public release.         |
| [element-to-source-react19.md](element-to-source-react19.md)           | React 19 owner stacks against compile-time attributes on Turbopack                                                                                                       |
| [figma-make-teardown.md](figma-make-teardown.md)                       | What Figma Make offers and how it behaves, observed live                                                                                                                 |
| [paper-design-teardown.md](paper-design-teardown.md)                   | What Paper offers, observed live: the reference for Truing's chrome, panels and layers                                                                                   |
| [menus-spacing-frames-takes.md](menus-spacing-frames-takes.md)         | The right-click panel, spacing at a glance, frames from pages, and AI takes side by side                                                                                 |
| [open-source-repo-setup.md](open-source-repo-setup.md)                 | What successful developer-tool repos ship for contributors, releases, changelogs, recurring maintenance and agents; a gap table and an agent-run release flow for Truing |
| [oss-landscape.md](oss-landscape.md)                                   | What exists, open and closed, and the option of composing our own                                                                                                        |
| [token-inspection-and-authoring.md](token-inspection-and-authoring.md) | The token table, off-token detection, writing tokens, and Figma sync                                                                                                     |

**What was left out of the public copies.**

- Figma Make's sandbox files and scripts, which were seen during the live session. `figma-make-teardown.md` describes how the product behaves instead.
- Paper's token values, which were read from the running app. `paper-design-teardown.md` describes the theme in words.
