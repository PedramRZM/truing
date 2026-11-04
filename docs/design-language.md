# Truing's design language

How Truing's own interface looks and behaves, after [Paper](research/paper-design-teardown.md). Every screen and module in Truing follows it. It covers Truing only: the app it frames keeps its own design system.

**Status (2026-11-02):** this is the target. TRU-3.1 has brought the tokens and measures; TRU-3.3, TRU-3.4, TRU-3.5, TRU-3.6 and TRU-3.7, TRU-3.8 and TRU-3.9 the layout and controls, TRU-3.10 the screens already built, and TRU-4.2, TRU-4.3 and TRU-4.4 the panel's editing. TRU-14.3 brings the Pages section. TRU-4.2 has made Layout, Flex, Grid and Spacing editable, TRU-4.3 Radius, Blending, Fill, Border, Text, Underline and Shadow, and TRU-4.5 gradients, images, filters, outlines, icons and the rest of what the app's classes set. Until then the code is behind this file.

## A dense desktop tool

Truing runs on a designer's computer, in its own window, beside work that needs the room. So this file overrides the generic web rules in `ui-design` and `design-reviewer`:

| Rule            | Generic web           | Truing                                             |
| --------------- | --------------------- | -------------------------------------------------- |
| Hit area        | 44 px                 | 24 px; 16 px for a handle on the canvas (TRU-16.4) |
| Body text       | 16 px                 | 12 px with 16 px lines                             |
| Widths to check | 412, 1440             | 1280, 1440. No phone layout                        |
| Primary action  | One per screen, large | Quiet. Only a confirming action is dark            |

Everything else still holds: 4.5:1 for text, 3:1 for outlines and meaningful icons, visible focus, every control reachable by keyboard, reduced motion, no sideways overflow.

## Colour

One set of `--ds-*` tokens in `src/shell/styles.css`, each a `light-dark()` pair, following the system. No colour literal anywhere else, except the overlay's list in `src/modules/selection/overlay.ts`, because the overlay draws inside the app's frame.

| Token role        | Light                     | Dark                      |
| ----------------- | ------------------------- | ------------------------- |
| Panel, popover    | `#f2f2f2`                 | `#2a2a2a`                 |
| Canvas            | `#eee`                    | `#282828`                 |
| Control           | `#f9f9f9`                 | `#373737`                 |
| Line              | `#e2e2e2`                 | `#373737`                 |
| Row hover         | `#eaeaea`                 | `#333`                    |
| Row selected      | `#e0e0e0`                 | `#3c3c3c`                 |
| Ghost hover       | black at 0.06             | white at 0.06             |
| Segment track     | black at 0.06             | black at 0.2              |
| Text 1            | black at 0.8              | white at 0.9              |
| Text 2, 3, 4      | black at 0.6              | white at 0.65, 0.575, 0.5 |
| Confirming button | `#1e1e1e`                 | `#f2f2f2`                 |
| Icon              | black at 0.5              | white at 0.4              |
| Accent            | `oklch(67% .17 258)`      | same                      |
| Accent fill       | `oklch(55% .145 258)`     | same                      |
| Focus ring        | `oklch(55% .145 258)`     | `oklch(60% .15 258)`      |
| Selection         | `oklch(78% .12 258 / .5)` | `oklch(74% .3 258 / .3)`  |
| Red               | `oklch(59% .25 20)`       | `oklch(71% .23 20)`       |
| Green             | `oklch(62% .16 150)`      | `oklch(74% .18 150)`      |
| Orange            | `oklch(81% .18 67)`       | same                      |

- **The chrome is grey.** Hierarchy comes from weight, size and position. The accent marks the selection, focus and state, never decoration.
- **Light text 2, 3 and 4 are one value.** Paper's lighter greys are 3.89:1 and 3.04:1 on the panel, so they rise to black at 0.6 (5.55:1).
- **Outlines and icons hold 3:1 too.** Paper's light focus ring is 2.07:1 on the panel and its light icon 2.41:1, so they rise to the accent fill (4.39:1) and black at 0.5 (3.89:1). The focus colour also draws the active frame and the current row's mark. Status dots carry a 1 px ring in the icon colour, as orange and green can't hold 3:1 on the light canvas.
- **White text sits on the accent fill** (4.91:1), not the accent (3.03:1). That includes a menu's highlighted row.
- **The accent isn't small text on a panel.** Even the fill is 4.39:1 on `#f2f2f2`. Use text 1 with an icon.
- **Red and green are for state:** failed, applied. Each comes with a word or an icon, never colour alone.

## Type and measures

- **Inter** for the interface, **JetBrains Mono** for values on the canvas, classes and paths. No Paper fonts. Both ship inside the shell's CSS (Latin and Latin Extended), so no installed font or network is needed. Other scripts fall back to the system's fonts.
- **Sizes:** 12 px with 16 px lines; 13 px for a panel's name; 10 px only for small labels on the canvas, and never mono numbers (JetBrains Mono's zero reads as an 8 at that size). Weights 400, 465 and 500.
- **Heights:** control 24 px, tree or list row 28 px, menu row 24 px, empty section 33 px.
- **Radius:** 6 px for controls, menus and popovers. Larger only on a dialog.
- **Lines, not boxes.** Regions are split by 1 px lines on one plane. Controls have no border: they carry `--ds-shadow-control`, a soft inset highlight. Only what floats has a shadow.
- **Icons:** `lucide-react`, one stroke, 16 px in a 24 px button.

## Layout

| Region      | Width  | Holds                                                                                                               |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Left panel  | 240 px | Project name, Design and Theme tabs; Design holds Pages and layers, Theme holds tokens                              |
| Tool rail   | 42 px  | Tools only, in groups split by a line                                                                               |
| Canvas      | rest   | Flat, with a slim bar along its top for route and viewport                                                          |
| Right panel | 280 px | Zoom and actions on top; Properties or Claude (360 px while Claude shows), with Claude's configuration under Claude |

Panels sit beside the canvas and never cover it. Collapsed, a panel becomes a small floating pill under the canvas's bar, and with the left panel collapsed the rail floats too, vertically centred.

## Patterns

Use these before inventing another. A new one is added here in the same pull request.

- **Tabs and switches:** a segmented control, the pressed part raised on the control colour. Left panel: Design | Theme. Layers: Design | Code. Right panel: Properties | Claude, at the same height.
- **Section:** a 12 px title in weight 500, and a `+` when something can be added. Empty, it's one greyed line. Filled, it opens, and what was added can be taken away with a `−` at its row's end (TRU-4.3). Radius and Blending are never empty: a slider at 0 or 100 is how you set them. Split by a line.
- **Row:** 28 px, with hover and selected backgrounds. Children of the selection get the hover colour as a band. Actions appear at the row's end on hover, and a row's active state (locked, hidden) stays visible. Long text truncates, and the full text shows on hover.
- **Tree:** nothing scrolls sideways. A row that is an only child steps in a quarter of a step and a row among siblings a full 12 px step, and past 120 px left for the name the step shrinks so the deepest row showing keeps that room. React pages nest forty levels deep, so plain steps left no room for names.
- **Field:** 24 px on the control colour, with an icon or letter label you can drag to step (TRU-3.9). It shows what a designer sees: a number, a font, a swatch. A small icon says it's linked to a token, and the token's name shows on hover. A colour shows its token's name beside the swatch, since a colour has no number to read. Arrow keys step, Shift steps four, Enter commits, Esc cancels, and leaving the field commits what's typed.
- **Slider:** a 12 px track and a 22 px thumb in a 24 px line, beside its number. It moves along the scale's steps, not its values, so 8 to 12 is as far as 96 to 180 (TRU-3.9).
- **Segmented control, checkbox and icon toggle:** the pressed part raised on the control colour. A checkbox is 16 px in a 24 px line, and only its tick takes the accent fill (TRU-3.9).
- **Token menu:** floats under what opened it, over a clear layer, so a press anywhere outside closes it. A filter on top, then Nearest for a value off the scale, semantic tokens, then families. Each row has its swatch or kind icon, name and value, and the current one is ticked. Colours are 28 px rows with a list-to-grid slider; other tokens are menu rows. A `+` shows once TRU-11.5 can create one (TRU-3.9).
- **Alignment pad:** 112 × 88 px, nine cells of at least 24 px. The current cell draws three lines running the way the children flow, and the rest a dot (TRU-3.9).
- **Point to preview.** An option shows on the page while the pointer is on it: a menu's row, a segment, a cell of the alignment pad, a toggle. Nothing is staged, and leaving puts the page back. The arrow keys do the same in a menu. A native `<select>` can't say which option the pointer is on, so options that change the page use a menu instead (TRU-4.2).
- **Scope row:** a segmented control at the top of Layout, for which sizes a change holds: All sizes, From this size up (`md:` on Tablet, `lg:` on Desktop), This size only. Phone has no "up" and Desktop no "only". This size only goes to Claude, as the value above it has to be restored. A field shows the breakpoint its value comes from at its end (TRU-4.2).
- **Option menu:** a field, or an icon button, that opens 24 px rows on the clear layer, with a tick on the chosen one and the highlighted row on the accent fill. For a few choices that need no filter: a variant, Space between (TRU-4.2).
- **Value row:** 24 px, a label in text 2 and the value beside it, for a value that can't be changed here yet. Marks at its end: the token icon, and a warning icon for a value off the scale. It has no control colour, so it doesn't look editable. TRU-3.9's fields replace it as TRU-4.2 and TRU-4.3 make each value editable (TRU-3.8).
- **Word row:** a label in text 2 beside an option menu, for one word among a few: Blend, Overflow, Case. Its options show on the page while pointed at (TRU-4.5).
- **Like-this prompt:** after a change on a pick, one sticky block at the panel's top: how many are like it, Change all and Only this one. The others are outlined in the frame while it asks, and pointing at Change all shows the change on them. It says Change, not Apply, as Apply is what writes to the code (TRU-4.5).
- **Field note:** one line in text 2 under the value it's about, with a warning icon, for a fact about that value: text that fails contrast (TRU-4.3). It leaves when the value is fixed.
- **Button:** ghost by default; control colour for a real action; dark only for the one action that confirms (Apply, Send). In the rail, the current tool is raised on the control colour, and a tool that does nothing in the current mode is disabled.
- **Menu:** 24 px rows, the panel colour at 92%, a line between groups, the shortcut at the row's end in text 2, the highlighted row on the accent fill with white text.
- **Popover:** floats beside what opened it. A darker header holds its title as a tab, with its actions and close at the end. Saves when you click away, unless it writes to the code.
- **Dialog:** rare. For a choice that needs the whole window's attention.
- **Changes summary (TRU-3.10):** one line pinned to the right panel's foot, under whichever view shows: a chevron and "3 changes" that open the list upward, then Discard, then Apply, the one dark button. It counts every staged change, so a change made on several elements counts each. The list's rows are Rows, with Undo at the end on hover, and whether it's open is remembered. With nothing staged, the line is the empty state.
- **Failure in a section (TRU-3.10):** a red warning icon, what stopped in text 1, the message in text 2 under it, and a control-colour button when something can bring it back. No box.
- **Fold (TRU-3.10):** a `<details>` line of 24 px with a lucide chevron. At the start of its line, or at the end for a section's title, where a `+` would sit. A count of what it holds sits just before the chevron, in text 2 (TRU-5.1). `→` is drawn with an icon too: neither bundled font holds it.
- **Toast:** a short line at the canvas's foot, about 1.5 seconds, replacing the last. For what a key just did. Failures stay until read, in place.
- **Empty state:** one or two lines in text 2 saying what will show here and how to get it.
- **Composer:** chips for what's attached, then the text, then small menus at the left and the action at the right. One shape wherever a person writes to Claude (TRU-5.2, TRU-12.2, TRU-17.2, TRU-17.4). At the panel's foot it sits under the Changes summary. Smaller, it floats by a pick.
- **Chat (TRU-5.2):** a designer's message sits on the control colour, and Claude's answer is plain text on the panel, with no bubbles or avatars. What Claude did is a quiet row in text 2, runs of the same thing folded into one. A turn's diff is a Section with its files as Rows, the frames after it, and Undo and Keep at the end.
- **Permission prompt (TRU-5.2):** the command or file in mono on the control colour, and Don't allow and Allow at the end. Only yes or no: nothing can edit what Claude asked to run.
- **Markdown (TRU-5.2):** a file's Markdown reads as text in the panel's measures: headings in weight 500, 12 or 13 px, never larger. Tables have 1 px lines, and a wide one scrolls by itself. Frontmatter shows first, in mono. It can't load a picture, and a link opens outside Truing.
- **Label on the canvas:** mono at screen size, on the accent fill, at any zoom. The frame can't load the shell's fonts, so it's the system's mono, at 12 px as these labels hold numbers. Spacing chips keep their kind's fill (margin, padding, gap, measure): on one accent they couldn't be told apart (TRU-3.10).
- **A label stays off what it names.** A pick's or hover's label sits above the outline, or below it when there's no room above: a nav bar at the page's top stays in full view. It goes inside only an element that fills the frame (TRU-4.5).
- **Measuring is a tool.** A pick shows its outline and name. Its padding, margin, gaps and their tokens show only while Spacing is on, or Alt is held, so the page stays clear to judge a change.

## The properties panel

The right panel speaks a designer's language, like Paper's: Layout, Blending, Fill, Text, Shadow, Filters. Code stays one click away, never in front.

- **Top:** what's picked, how many instances, which uses a change is for, and its variants, which change here. There's no separate Edit heading. An element picked as Text keeps its words in the Text section; any other that holds only text has them here.
- **Middle:** sections of visual controls, in designers' words and numbers.
- **Bottom:** a **Code** section, closed by default, holding classes, the token breakdown, props, owners and source.
- **Any number can be typed; the code stays on the scale.** Typing 17 where the scale has 16 and 20 snaps to 16, says so, and offers to create a token (TRU-11.5). A tie goes to the smaller. A value already off the scale shows as its number, flagged, with the nearest tokens (TRU-11.2). A size the page lays out isn't flagged for its number, only for a class written by hand (`min-h-[40px]`).
- **A new pick commits.** Leaving a field commits what's in it, and a pick in a frame is leaving it, whether typed or stepped (TRU-4.2).
- **A text style on top, its values below (TRU-4.3).** Changing one value keeps the style's name and flags it. A plain size with no style is flagged too; no type classes at all isn't. A size alone writes Tailwind's own size and keeps the style's weight.
- **Text shows wherever text is set (TRU-4.3):** on what's picked as Text, and on an element that holds only text or whose classes set type or a text colour. There Colour leads the section; for Text, colour stays in Fill.
- **Fill is Solid, Gradient or Image (TRU-4.5).** A gradient shows as a bar, then its shape, direction and each colour with where it sits. A gradient written by hand can only be read. An image shows, with how it fits; a new one goes to Claude.
- **An icon has its own section (TRU-4.5):** Colour, Fill, Lines and Line width, without the type around them.
- **A shadow is a token, never its layers (TRU-4.3).** One by hand reads Custom, flagged, with the tokens nearest its blur.
- **How a change gets applied stays in the Changes tray,** not on each control. Direct or Claude is shown there, with the reason.

## Words

Designers' words first: Frame, Text, Fill, Fit, Fixed. Code's words go in the Code view and the source links. `ux-copy` sets the voice.

## Checking a screen

`/verify-ui` at 1280 and 1440, in light and dark, then `design-reviewer` and `copy-reviewer`, given this file. A change to this file is a design decision: it says why, and a maintainer reviews it.
