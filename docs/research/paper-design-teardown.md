# What Paper offers and what Truing should take from it (live look, 2026-11-02)

Feeds Truing. The maintainer found [Paper](https://app.paper.design/) on 2026-11-02 and asked for its ideas to come to Truing: the light theme and its colours, the panels that stay open with Design and Theme tabs, the toolbar's placement, the properties panel, and a layers panel for designers rather than developers. This note records what Paper does, how ours compares, and which task takes each idea.

Observed live on 2026-11-02 on a free account, in the web app at 1440 × 900, plus Paper's docs. Screenshots and measurements stayed local.

## Questions

- What does Paper's editor look like, measured: colours, sizes, type?
- How are its panels, toolbar, layers and properties organised, and what does each show for each kind of selection?
- What does it have that Truing doesn't, and which of those fit a tool that edits a real codebase?
- Where do its choices conflict with ours (the project's spacing convention, the product spec, Truing's contrast rule)?

## Research placeholders

- `[web]` open a file signed in (Playwright): select a frame, a flex frame and a text layer and read every panel section; open every menu; open the Theme tab in the empty Scratchpad and press "Use starter theme"; draw a frame with two rectangles and press Shift+A.
- `[web]` re-read `paper.design/docs/mcp` and `paper.design/docs/tokens` for changes.

## Findings

### Truing today (measured 2026-11-02, `/main` at 1440 × 900)

A headless run of Truing on a real app.

- **Theme.** Dark only, after Airship's tokens, on a dotted canvas.
- **Panels.** Two floating docks, 340 and 360 px wide, that start as pills and open over the canvas. Together they cover 700 of 1440 px.
- **Toolbar.** One horizontal bar at the bottom holding everything: Select / Interact, Hand, Spacing, route, reload, viewport, side by side, fit, zoom, shortcuts.
- **Layers.** The first rows a designer sees are `<body>`, `NextTopLoader`, `Providers`, `Provider`, `AuthProvider`, `QueryClientProvider`. Six rows and five levels down, nothing on the page has appeared yet. Rows are named by tag (`<body>`) or React component, and carry a `Server` badge. That is what `modules/selection/layers.ts` was built to show: the project's JSX. It is right for a developer and wrong as a designer's first view.

### The layout

| Region      | Width  | Holds                                                                                     |
| ----------- | ------ | ----------------------------------------------------------------------------------------- |
| Left panel  | 240 px | File name and panel toggle; Design and Theme tabs; Pages; layers; What's new and Feedback |
| Tool rail   | 42 px  | Vertical tools, full height, between the left panel and the canvas                        |
| Canvas      | rest   | Flat light grey by default (each page sets its own background), no dot grid               |
| Right panel | 280 px | People, zoom menu and Share on top; then the sections for the selection                   |

- **The panels sit beside the canvas, not over it.** Everything is on one plane, separated by 1 px lines.
- **The toggle collapses rather than closes.** The left panel's toggle (Shift+. collapses, . hides everything) turns it into a small floating pill with the file name. The rail floats on the left, vertically centred. With nothing selected, the right panel also drops to a pill holding people, zoom and Share.
- **Alt+1 and Alt+2** jump to Design and Theme.

### The light theme

One set of tokens, each a light and dark pair, so the theme follows the system with no second stylesheet. Greys for panels, canvas and lines, with four steps of text as black or white at falling opacity, and a blue accent. Sizes: type 12 px (13 px for headings, 10 px for small), line height 16 px, weights 400, 465 and 500. Controls 24 px tall, tree rows 28 px, radius 6 px. Controls carry a soft inset highlight rather than a border.

**Contrast, computed.** On the light panel, the first two text steps pass 4.5:1 (11.72:1 and 5.55:1). The third and fourth don't (3.89:1 and 3.04:1), nor does the icon colour (2.41:1). Truing's own rule is 4.5:1 for text, so Paper's colours can't all be taken as they are. The decision on 2026-11-02 was to take them except for text that fails, which moves to the next darker value (TRU-3.1).

### The left panel

- **Header:** logo menu (Back to dashboard, view toggles, Hotkeys, Duplicate file), file name, panel toggle.
- **Tabs:** Design and Theme, a segmented control. "Design" here means pages and layers.
- **Pages:** collapsible, a `+`, a tick on the current page.
- **Layers:**
  - 28 px rows, 12 px type, no tag names and no developer vocabulary.
  - The name comes from the content: `Frame`, `Rectangle`, `Cover Image`, and for text its words.
  - The icon says what it is, and for a frame it shows the layout: a row icon, a column icon, or a free frame's corners. You can read the structure of a page without opening anything.
  - The selected row gets a stronger background, and **its children a lighter band**, so the selection's extent shows in the tree.
  - Hover shows lock and eye at the row's end. A locked row keeps its lock visible.
  - Selecting on the canvas expands the tree to that row.
  - Alt+L collapses everything. Ctrl+R renames.

### The tool rail

Top to bottom, in groups split by lines: Move (V), Pan (Space); Frame (F), Rectangle (R), Pen (P), Text (T), Comment (C); Shaders (S), Create image, Create SVG. The current tool has a raised white button. Only tools live here: no route, no zoom, no sizes.

### The right panel: sections by selection

Each section has a title and a `+`. An empty one is a greyed title and `+` only, 33 px tall, so the panel is short and shows at a glance what isn't set. A filled one opens.

| Selection | Sections, in order                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing   | Page (background colour), MCP (Connect your agent)                                                                                                  |
| Frame     | Layout, Flex (when set), Radius, Blending, Fill, Outline, Border, Shadow, Inner shadow, Filters, Selection colors, Guides, Video, Export            |
| Text      | Layout, Blending, Fill, Text, Underline, Stroke, Shadow, Filters, Other styles (raw CSS like `white-space: pre-wrap`, each with a checkbox), Export |

- **Layout:** align buttons along the top; X, Y, rotation; W and H each with Fixed, Fit, Fill, Relative; rotate and flip; for free-placed layers, Left/Top constraints with a small pad; Wrap in flex for a child.
- **Add flex (Shift+A)** is one wide button when flex is off. It reads the layout: two rectangles 20 px apart in a frame with 40 px around them became `flex`, gap 20, padding 40.
- **Flex:** a 3 × 3 alignment pad, direction (down, right), wrap, gap, two padding fields with a per-side toggle that opens four, Absolute position, Clip content. A menu holds Space between and baseline alignment.
- **On the canvas, while flex is on:** small ticks at each gap and padding. Hovering one fills the area in light purple with a value badge (`20`). I did not try dragging them.
- **Radius:** a slider, a number, a per-corner toggle. Once tokens exist, the number gets a dropdown: `Full`, then `xs 2` to `4xl 32`.
- **Blending:** opacity, blend mode, eye.
- **Fill:** solid, gradient or image, with a colour field whose end holds a token button and an eyedropper.
- **Text:** font, weight, size, line height, letter spacing, horizontal and vertical alignment.
- **Selection colors:** every colour in the selection and everything inside it, each with hex, opacity, a token button and **how many layers use it**. I didn't change one, so I can't say how an edit behaves; in Figma, which has the same section, it changes them all. Our study's notes don't mention this idea, and for finding off-token colours it fits us better than it fits Paper.
- **The dimension pill** under the selection names the mode, not just the size: `Fill 288 × Fit 56`, in mono, on the accent.

### The Theme tab and tokens

- A count (`84 tokens`), search, a `+` whose menu lists the kinds: Color, Opacity, Radius, Spacing, Container, Breakpoint, Font family, weight and size, Line height, Letter spacing.
- Collapsible groups by kind. Colour rows have a swatch, others a kind icon and the value at the row's end.
- Clicking a row opens a small floating editor beside the panel: preview, Name, Value (with the same token button as a colour field), duplicate, delete. It saves when you click away.
- Token menu on a colour field: a list-to-grid slider, a `+` to create one, swatches and names.
- Paper's docs add detach, right-click copy to paste into a CSS theme file, and a roadmap of theme classes and theme modes. Paper's tokens map to Tailwind's by name, the same way ours do.

### Other things Paper has

- **Colour picker:** sRGB or Display P3, a uniform-lightness square, opacity and hue strips, previous and new, rows for LCH, HSL and RGB with copy buttons, hex with opacity.
- **Right-click menu:** Select layer…, Select parent, Select children, Copy, Copy link, Copy as (PNG, Tailwind, React CSS), Paste on top, Paste to replace, Duplicate, Copy styles, Paste styles, Rename, Frame selection, Remove flex, Ungroup, arrange, Show or hide, Lock or unlock, Set as thumbnail.
- **Code output** is plain React with no project context: `<div className="flex overflow-clip items-start gap-5 p-10 bg-white">`, with raw colours as `bg-[#DDDDDD]`. We start from the real source, so we need none of this generation.
- **Zoom menu** (right panel's top): zoom in, out, 100%, fit, selection; zoom centres the selection, number keys, invert, scroll wheel zooms, right click to pan; pixel grid, snap to pixel, layout guides, cursors, deep selection, comments.
- **A short toast** names each command run by key ("Zoom to selection", "Copied as React with Tailwind").
- **Hotkeys sheet** with a search field, over 100 commands in groups.
- **No chat panel in the web app.** The agent works from its own app, over MCP, and its edits show in the file. TRU-5.2's chat has no reference here, except the Create image box below for its composer.
- **Agents:** MCP through Paper Desktop's `paper mcp` over stdio, with one-click installs. The dialog ends with example first prompts. I read the docs and the dialog but did not connect one.
- **Shaders:** a gallery of WebGL effects (Paper Texture, Fluted Glass, Water, Halftone, Liquid Metal and more), as a layer with its own settings. Published as Paper Shaders.
- **Create image, Create SVG:** a prompt box at the canvas's foot that takes the selection as references, with model and ratio choices.
- **Multiplayer:** cursors, cursor chat, comments, Share.

### Not explored

No Paper Desktop, so no MCP tools and no tabs. I did not open Outline, Border, Shadow or Filters when filled, the Pen tool, comments, Guides, Video, or export. Create SVG I opened without reading it closely. Pro features may exist beyond the free plan.

The work in the Scratchpad was undone afterwards: it is back to no layers and no tokens. The Welcome file was only selected and read.

## Implications for Truing

### Taken, in new tasks

| Idea                                                 | Task      | Why it fits                                                          |
| ---------------------------------------------------- | --------- | -------------------------------------------------------------------- |
| Light theme, one `light-dark()` token set            | TRU-3.1   | the maintainer's ask; less chrome weight beside a light app          |
| Panels beside the canvas, always open, collapsible   | TRU-3.3   | the maintainer's ask; ours cover half the window and hide the app    |
| Design and Theme tabs                                | TRU-3.4   | the maintainer's ask; gives TRU-11.1's tokens a home                 |
| Vertical tool rail; route and sizes off it           | TRU-3.5   | the maintainer's ask                                                 |
| Layers for designers, with a Code view               | TRU-3.6   | the maintainer's ask; measured above                                 |
| Row bands, hide, lock, collapse all, reveal          | TRU-3.7   | Small, expected by anyone who has used Figma                         |
| Pages section from the app's routes                  | TRU-14.3  | Our pages are the app's routes, and a real list beats typing a route |
| Design panel by selection, empty sections collapsed  | TRU-3.8   | The shape TRU-4.2 and TRU-4.3 fill                                   |
| Dense controls: scrub, slider, token menu            | TRU-3.9   | Shared by TRU-4.2, TRU-4.3 and TRU-11.5; better built once           |
| Selection colours with counts                        | TRU-11.3  | Finds off-token colours; goes further with our tokens than Paper's   |
| Sizing mode on the pill                              | TRU-16.3  | Tells a designer why an element is that size                         |
| Gap and padding on the canvas, snapping to our scale | TRU-16.4  | Fast, and token-safe by construction                                 |
| Add flex with inferred gap, layout keys              | TRU-16.5  | The most striking single detail; needs mapping to our classes        |
| Copy as PNG                                          | TRU-16.6  | Designers paste shots into chats and reviews all day                 |
| Copy and paste styles                                | TRU-16.7  | Applies a token set across elements, with no new values              |
| View menu, zoom to selection, command toasts         | TRU-16.8  | Tidies what TRU-3.5 removes from the bar                             |
| Eyedropper to the nearest token                      | TRU-11.4  | The eyedropper with our token rule                                   |
| Insert text or a frame                               | TRU-16.10 | Yes, in v1.1 (2026-11-02)                                            |
| Blend modes, filters, inner shadow, gradients        | TRU-4.4   | the maintainer's ask: the panel's full set of visual controls        |

### Taken into existing tasks

TRU-4.2 (flex section's shape), TRU-11.5 (add menu by kind, floating editor), TRU-4.3 (section order, opacity, the empty-section pattern), TRU-5.2 (first prompts, the composer's shape), TRU-11.1 (Theme tab rather than the Design dock), TRU-16.11 (search in the shortcuts sheet).

### The language as a whole

The maintainer's reading on 2026-11-02: Paper's right panel belongs to designers' world, and our Design tab is "basically code and tokens and CSS stuff". So TRU-3.8 now leads with visual controls, and code moves to a closed section at the bottom, as TRU-3.6 does for layers. TRU-4.4 adds the effects. Paper's Colors and Adjustments sections weren't seen, as they're likely on image or shader layers.

`docs/design-language.md` states it for every screen and module, with a dense-desktop exception to the generic web rules. TRU-3.10 brings the screens already built up to it, and every pending task with studio UI points to it.

### Where we should differ from Paper

- **The code stays on the scale.** Paper writes any number and can detach any token. Ours accepts any typed number and snaps it to the nearest step, saying so (2026-11-02), on the project's spacing scale. Scrubs and handles step the same way. The panel shows numbers and swatches, and tokens stay one hover away.
- **X and Y only when true.** Paper places layers freely. Our elements sit in the app's flow, so X, Y, Left and Top show only for an element positioned absolutely or fixed. Rotate and flip stay, as classes.
- **Click selection stays ours.** Paper's first click takes the top frame, and a double-click goes in, with a "deep selection" toggle. Ours picks the component under the pointer and Enter goes in (TRU-2.1), which suits inspecting a dense real page. Paper's Esc selects the parent, where ours clears; TRU-2.3 chose that on purpose.
- **Keys stay ours where they clash.** `I` is Interact here and the eyedropper there, `S` is Spacing here and Shaders there, `C` is Copy path here and Comment there. Designers will build habits on ours, so TRU-11.4 picks a free key.
- **Nothing lifted.** We rebuild the layouts, and took Paper's colour values as a starting point (TRU-3.1). Paper's Matter and PaperMono fonts, its cursor images and its icons stay theirs: we keep Inter, JetBrains Mono and `lucide-react`.

### Left out, and why

- **Comments and multiplayer:** the product spec's out-of-scope list. Review happens on the PR and the preview.
- **Create image:** needs a model API, and Truing has no API keys. **Create SVG:** TRU-5.2's Claude can already be asked.
- **Pen, Rectangle:** these draw shapes a codebase doesn't have. A new frame or text is TRU-16.10.
- **Sharing, thumbnails, video export, pixel grid, Copy link, Rename:** nothing to attach them to in a local studio over code. A layer's name comes from the code.
- **Generating code from the canvas:** we edit the source itself.

## Sources

- Live app, 2026-11-02: `https://app.paper.design/`, Welcome file and Scratchpad.
- `https://paper.design/docs/mcp`, `https://paper.design/docs/tokens`, `https://shaders.paper.design/`.
- Ours: `src/shell/{docks,toolbar}.tsx`, `styles.css`, `src/modules/selection/layers.ts`, a headless run on 2026-11-02.
