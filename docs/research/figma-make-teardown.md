# What Figma Make offers and how it works (live look, 2026-10-31)

Feeds Truing (the code-first Truing). Figma Make is the reference the design team named: a chat-driven builder with a visual edit mode. This note records what a designer can do in it, how a visual edit turns into code, what runs underneath, and where it stops being useful for a team that already has a codebase and a design system. It was observed live on 2026-10-31 in a Starter (free) account on a scratch Make file, plus Figma's help centre and blog for what the Starter plan locks (Make kits). The screenshots stayed local in the local folder.

## Questions

- What can a designer change in Make without writing code, and where does each control live?
- How does a visual edit become code, and what does it cost?
- How does Make map a selected element to its source, and what does it know about tokens and components?
- What runs underneath: runtime, agent, versions, and how design-system context gets in?
- Where does Make fall short for a team with an existing repository and design system?

## Research placeholders

- `[web]` open a Make file signed in: Edit, select an element, read every panel section, open "Apply variable" and "Selection mode", stage an edit and Apply it, then Review, Make settings, Preview options, the composer's "+" menu and the model picker
- `[web]` re-read `help.figma.com/hc/en-us/articles/42009840449175` (editing a Make file) and `help.figma.com/hc/en-us/articles/35946832653975` (Make kits) for changes
- `[web]` search "Figma Make" on `figma.com/blog` for features added after 2026-10-31 (Code Connect in Make was "coming soon" on 2026-07-30)

## Findings

### The workspace (observed 2026-10-31)

- **Left: chat.** Several chats per file. Each agent turn shows a collapsible trace ("Worked for 11s": files explored, files edited, shell commands), a summary, an "Edited 2 files +102 −1" card with per-file diffs and a Review button, and a version card ("Add simple login form, 11:04 AM") that can be restored. Each turn shows its AI-credit cost. While the agent works, the prompt box becomes "Add message to queue".
- **Prompt box.** Selected elements appear as chips (`# button`). The "+" menu holds Plan, Upload files, Add context (uploads, Figma design frames, connectors), Browse assets, Select a Make kit, and Connectors. There is voice dictation and a model picker: Auto, GPT-6.1 Sol, GPT-5.6 Terra, Claude Sonnet 5.5, Gemini 3.8 Flash ("50% less" credits). Under the box: "Cloud" and the git branch `main`.
- **Right: workspace tabs.** Browser (the running app), Files (file tree plus a CodeMirror editor backed by a TypeScript language server), Terminal (a real shell in the sandbox) and Review (a diff of the last turn or other ranges).
- **Browser bar.** Back, forward, reload, a route box, and "Browser settings": the dev server's status (`localhost:3000`), hard reload, and open console. Preview options offer Window or Device mode, a viewport of Fullscreen, Custom, Phone, Tablet or Desktop, and width × height. There is also a comments toggle and the **Edit** button.
- **Top bar.** Multiplayer avatars, Make settings, Preview, "Open in canvas" (renders the app as layers into a chosen Figma Design file or a new one), Publish (a `figma.site` URL, or Figma Community) and Share.
- **Settings.** General, Domains, Fonts (detects custom fonts and asks for WOFF files before publishing), Environment variables, Chat preferences (web search and fetch on or off), Audio, and the GitHub (publish the code to a repository) and Supabase integrations.

### Edit mode: what a designer changes without code

- **Tools** (a floating bar): Select (V), Copy designs (the whole page or one element as Figma layers), Annotate for agent (A: drop a numbered pin on an element and type a request in place) and Draw (freehand markup with a note, sent to the agent).
- **Properties panel** for the selected element, in Figma's own layout:
  - Position.
  - Layout: W and H with Fixed, Fill or Hug; padding as horizontal and vertical, or per side; margin per side.
  - Typography: family, weight, size, line height, letter spacing, colour with opacity, bold, italic, alignment.
  - Appearance: opacity, and corner radius with per-corner values.
  - Background, Border, and Effects (drop shadows).
  - With nothing selected, the panel shows the page's typography and background.
- **"Go to source"** opened `src/App.tsx` at the selected `<button`, line 73, column 12, with the element's opening tag selected.
- **Elements panel.** A filterable tree of React components and DOM nodes, each shown as tag, id and Tailwind classes.
- **Inline text editing.** Double-clicking text in the preview makes it editable in place.
- **"Apply variable"** next to a value opens a searchable picker of CSS custom properties, grouped as Radius, Spacing, Sizing, Font size, Line height and Other, with their resolved values (`--radius-xl` 12px). The list is every variable found on the page, including Tailwind's internals (`--tw-shadow-alpha`, `--tw-translate-x`). It only holds the theme variables the page's utilities happened to emit.
- **Selection mode** turns one selection into many by **shared class**: "This element only", "All 2 .bg-indigo-600", "All 4 .rounded-xl", "All 8 .text-sm". It is not by component.
- The Effects section showed six drop shadows for one button: the panel parses every layer of Tailwind's composed `box-shadow` (shadow, ring and offsets) as a separate effect.

### How a visual edit becomes code, and what it costs

1. Changing a value in the panel updates the preview at once and stages the change in a tray above the prompt box: the element's selector, "1 change", Discard and Apply (Ctrl+Enter).
2. **Apply sends the staged change to the AI agent as a message.** For a radius changed from 12 to 8 px, the agent wrote: "I'll update only the selected button's radius from `rounded-xl` to Tailwind's 8px `rounded-lg` utility." It then edited one file (+1 −1) and saved a new version, which is a git commit.
3. **That one class swap cost 8 AI credits.** Generating the whole login form cost 14. Figma's own words: "Edits stack up in the chat panel first, staged and credit-free, until you apply them," and applying "consumes credits and updates your file to a new version" ([blog, 2026-07-30](https://www.figma.com/blog/properties-panel-and-annotations-now-in-figma-make/)). Annotations cost credits too ([help](https://help.figma.com/hc/en-us/articles/42009840449175)).

### Underneath (what can be seen from the outside)

Each Make file runs in a cloud sandbox with a git repository and a live Vite dev server (React 19, Tailwind 4, TypeScript). The agent works with a shell and file tools, and each version it saves is a git commit. It opens the preview in a browser to check its own work. A kit's components are presented through their stories, each mounted in its own grid view. Selection maps back to a file through source maps, with no attributes added to the markup. Make also resends the last build error to a preview that reconnects, and forces a full reload when an edit turns a component module into a plain re-export. Both exist because an agent edits files under a live preview.

The sandbox's own files and scripts were looked at during the session. They are Figma's, so they are not quoted here.

### Design-system context

- **Make kits** carry design-system context. A kit is a React package published to npm (public, or Figma's private registry for an organisation) together with guidelines and supporting files; Make can draft the guidelines. Kits need React 18+, Vite compatibility and a paid plan; on Starter the menu shows an upgrade prompt ([help: Make kits](https://help.figma.com/hc/en-us/articles/35946832653975), [developer docs](https://developers.figma.com/docs/code/bring-your-design-system-package/)).
- Figma says edits in the panel "use the color and typography tokens already defined in your codebase". Linking Make to Figma Design components through Code Connect was "coming soon" on 2026-07-30 ([blog](https://www.figma.com/blog/properties-panel-and-annotations-now-in-figma-make/)). On this Starter file, tokens surfaced only as the raw page variables described above.
- **Unverified:** what Plan mode changes (it appears in the "+" menu; the help page fetched for it covers editing, not planning).

### Where Make falls short for us

1. **It edits its own sandbox, not our repository.** The GitHub integration publishes Make's code out to a repo; nothing brings a feature branch of ours in.
2. **Token support is shallow.**
   - Values show as raw px and hex.
   - The variable picker is whatever CSS variables the page emitted, internals included.
   - Nothing flags a value that is not on a token.
   - There is no way to create a token.
3. **"Same element" means "same class".** It never means "every `<Button variant="tonal-neutral">`", and there is no choice between editing one instance and editing the component.
4. **Every visual edit goes through the agent**, so a class swap costs credits and several seconds.
5. **The AI runs on Figma's credits and model list**, not on the person's own Claude plan.

## Implications for Truing

**Worth copying:**

- The four edit tools (Select, Annotate for agent, Draw, plus a component gallery instead of Copy designs).
- The staged-changes tray with Apply and Discard.
- Selection chips in the prompt box, Go to source, and the properties panel's sections and sizing modes (Fixed, Fill, Hug).
- Inline text editing.
- Viewport presets plus a custom width and height.
- Per-turn diffs, version cards and a Review tab.
- Each change landing as a git commit with a readable message.
- The agent opening the preview in a browser to check its work.
- Stories as the component gallery .
- The two HMR safety nets for agent edits.

**Worth doing better:**

- Apply simple changes without the model: a token or class swap is a deterministic source edit, and only judgement calls go to Claude.
- Read the full token table from the project's token stylesheet instead of the page's emitted variables.
- Flag off-token values, and let designers create tokens.
- Select by component identity and variant.
- Run on the person's own Claude subscription, on our own feature branches, with every change reviewable as a pull request.

**Not needed:** publishing, domains, Supabase, the connector catalogue, `site.json`. "Copy designs" and "Open in canvas" are optional; a code-to-Figma path exists through the Figma MCP if designers want it.

## Sources

- Live session, 2026-10-31, Figma Make on a Starter-plan account, a scratch file. Two prompts were sent: one that generated a small login form (14 credits) and one applied radius edit (8 credits). This is primary observation.
- Figma, "Edit a Figma Make file", help centre, `https://help.figma.com/hc/en-us/articles/42009840449175`, no date on the page. Official: the edit tool, Draw, annotations and version history, and that edits and annotations use credits.
- Phillip Wang (Director of Product Management, Figma), "A properties panel and annotations, now in Figma Make", 2026-07-30, `https://www.figma.com/blog/properties-panel-and-annotations-now-in-figma-make/`. Official: staged edits are free, applying costs credits, tokens from the codebase, Code Connect coming.
- Figma, "Use your design system package in Make kits", help centre, `https://help.figma.com/hc/en-us/articles/35946832653975`. Official kit requirements. Read via search summary only; not opened in full.
- Figma, "Bring your design system package", developer docs, `https://developers.figma.com/docs/code/bring-your-design-system-package/`. Official. Read via search summary only.
