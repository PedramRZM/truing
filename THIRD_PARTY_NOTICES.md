# Third-party notices

Files in this package that come from other projects (ADR 0001). Each vendored file keeps a header with its source, commit, licence and what we changed. Dependencies installed from npm are not listed here; their licences ship with them.

## Vendored files

| File in this package           | Source                                                                              | Commit                      | Licence                                                            | Changes                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/vendor/airship/frames.ts` | [Airship](https://github.com/0xnyn/airship) `packages/overlay/src/canvas/frames.ts` | `9307ddfe2828` (2026-10-24) | MIT, Copyright (c) 2026 Nayan Kumar (`src/vendor/airship/LICENSE`) | Trimmed to the device presets (`PRESET_GROUPS`, `PRESETS`, `presetById`, `groupOfPreset`, `matchPreset`); formatted with Prettier |

## Adapted, not copied

Ideas and values taken from Airship (MIT, same licence as above) and rewritten for this package:

| File in this package   | What was taken                                                                     | From Airship                                                          |
| ---------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/shell/camera.ts`  | Fit never past 100% with 64 px padding, zoom about a point, the frame gap          | `canvas/space.ts` (`fitTo`), `canvas/viewport.ts`, `canvas/frames.ts` |
| `src/shell/canvas.tsx` | The resize grips: eight of them, sizes, and west and north grips moving the origin | `canvas/frame-chrome.ts`, `styles/canvas.css.ts`                      |
| `src/shell/styles.css` | Type sizes, radii, the floating bar and docks                                      | `packages/editor-tokens/EDITOR.md`, `styles/*.css.ts`                 |

## Fonts

Listed here because the font files ship inside the shell's CSS, unlike other npm dependencies. Bundled through `@fontsource-variable/*`, pinned in `package.json`. Each package carries its licence in its `LICENSE` file.

| Font           | Package                               | Licence                   | Subsets               |
| -------------- | ------------------------------------- | ------------------------- | --------------------- |
| Inter          | `@fontsource-variable/inter`          | SIL Open Font License 1.1 | Latin, Latin Extended |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono` | SIL Open Font License 1.1 | Latin, Latin Extended |

## Agent skills

Guidance for coding agents working on this repo, read by the `ui-design` skill. These files sit in `.agents/skills/` and aren't part of the npm package. Each keeps its licence beside it; `.agents/skills/ui-design/references/vendor/VENDORED.md` lists what was edited and why.

| Files in `.agents/skills/ui-design/references/vendor/` | Source                                                                                                                                      | Commit         | Licence                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------- |
| `vercel-web-interface-guidelines.md`                   | [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) `AGENTS.md`                                 | `e3d624baaf29` | MIT (`LICENSE.vercel-web-interface-guidelines`) |
| `emil-design-eng.md`                                   | [emilkowalski/skills](https://github.com/emilkowalski/skills) `skills/emil-design-eng/SKILL.md`                                             | `85e8e2363b71` | MIT (`LICENSE.emilkowalski-skills`)             |
| `make-interfaces-feel-better/*.md`                     | [jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better) `skills/make-interfaces-feel-better/` | `35545ea1512a` | MIT (`LICENSE.make-interfaces-feel-better`)     |
| `fixing-accessibility.md`                              | [ibelick/ui-skills](https://github.com/ibelick/ui-skills) `skills/fixing-accessibility/SKILL.md`                                            | `c5bcd86450b3` | MIT (`LICENSE.ibelick-ui-skills`)               |
