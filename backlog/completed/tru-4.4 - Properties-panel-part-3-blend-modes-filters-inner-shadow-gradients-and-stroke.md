---
id: TRU-4.4
title: 'Properties panel, part 3: blend modes, filters, inner shadow, gradients and stroke'
status: Done
assignee: []
created_date: '2026-11-02 10:26'
updated_date: '2026-11-02 23:16'
labels:
  - panels
dependencies:
  - TRU-4.3
  - TRU-3.9
type: feature
ordinal: 40040
parent_task_id: TRU-4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The maintainer asked on 2026-11-02 for the range of visual controls in Paper's right panel. TRU-4.2 and TRU-4.3 cover layout, colour, type, radius, border and shadow. This task adds the rest. An earlier draft of TRU-4.3 left these out as rare, and the maintainer's ask reverses that.

Most of them are ordinary Tailwind classes, so they can use TRU-4.1's direct edits. There are no project tokens for most of them, so the controls step through Tailwind's own scales.

### Open question

The maintainer mentioned **Colors** and **Adjustments** sections in Paper, which weren't seen on 2026-11-02. They're probably on image or shader layers. Before starting, select an image and a shader in Paper and record what those sections hold in `docs/research/paper-design-teardown.md`, then add what fits to this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 **Blending.** Blend mode beside TRU-4.3's opacity, writing `mix-blend-*`, with Normal removing the class.
- [x] #2 **Filters.** One empty section until set. Its `+` offers blur, brightness, contrast, saturation and grayscale, each on Tailwind's scale, each with its own row and eye. Writes `blur-*`, `brightness-*`, `contrast-*`, `saturate-*` and `grayscale`. Each is its own class, so a row can go without touching the others.
- [x] #3 **Inner shadow.** Its own section, writing `inset-shadow-*`, tokens first if the project has them.
- [x] #4 **Gradient fill.** Fill's solid, gradient and image switch. Gradient offers direction and colour stops from colour tokens, writing `bg-linear-to-*`, `from-*`, `via-*` and `to-*`. Solid and gradient replace each other's classes.
- [x] #5 **Image fill.** For an `<img>` or a background image: shows the image and how it fits. Fit writes `object-*`. Choosing a new image goes to Claude, since it changes source and assets, with the reason in the tray.
- [x] #6 **Text stroke.** Its own section for text. Tailwind has no class for it, so it goes to Claude with the reason.
- [x] #7 **Same paths.** Everything is staged in TRU-4.1's tray, with breakpoint scope from TRU-4.2 and TRU-2.2's reach on a shared component. A class built at runtime goes to Claude with the reason.
- [x] #8 **Tests.** Unit tests for the class mapping and for what replaces what. Playwright on the fixture: a filter, a blend mode and a gradient on one element, and the source diff. Removing each one restores the source.
- [x] #9 **UI checked.** A browser check at 1280 and 1440 in light and dark, then a design review and a copy review, given `docs/design-language.md`.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Done through TRU-4.5, which lists what it left out: an eye on each filter, and the open question above.
<!-- SECTION:FINAL_SUMMARY:END -->
