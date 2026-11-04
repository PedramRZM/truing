# Product spec: Truing

- Status: living document, adopted from the first spec on 2026-10-31
- Epic: TRU-20. Workflow: [code-first-workflow.md](code-first-workflow.md). Decision: [ADR 0001](../adr/0001-compose-our-own-injected-browser-modules.md)

## User problem

Developers now build whole features quickly with coding agents, but design still runs design-tool-first. A designer draws, a developer translates, and the two drift apart. Designers can't touch the real product, so every spacing, colour or copy correction is a ticket, a wait and a re-check.

Truing flips the order. **The developer ships the feature to a branch. Someone else then refines the real UI on their own machine, visually, without writing code,** and hands the result back as a reviewable pull request. The reference product is Figma Make ([teardown](../research/figma-make-teardown.md)), but working over the real repository, its components and its tokens, on the person's own Claude subscription.

## Who

- **The person refining the UI.** Often a designer who doesn't write code. Has a Claude plan that includes Claude Code, and a way to reach the repository.
- **The developer.** Builds the feature, reviews the PR, owns anything beyond UI.

## Decisions already made

- **Zero config.** Truing runs in any folder. It needs no config file, hard-coded path, port, framework or token location. What it needs from a project comes from a saved profile, which Claude fills by reading the folder with read-only tools. When Claude can't tell, Truing asks in the UI. A person confirms the start command before anything runs. `truing.config.ts` is optional, for anyone who wants settings in git.
- **Hand-back.** Truing commits to a hand-back branch cut from the feature branch, and opens a PR into the feature branch. The developer reviews the diff and CI runs before it lands. Branch names and PR conventions are read from the project.
- **Local app.** The app runs on the person's machine, however that project runs it.
- **Tokens.** Code first. The project's token source is the source of truth. People create and change tokens through reviewed PRs, and any Figma file is updated from code.
- **Base and shape** ([ADR 0001](../adr/0001-compose-our-own-injected-browser-modules.md)): our own tool, injected by its own browser, with nothing added to the app and no proxy. Every feature is a module.

## User stories

- As a designer, I want to open the feature a developer just built on my machine and see it as it really is, so I refine the real thing.
- As a designer, I want to click anything and see what it is (component, variant, the tokens it uses, where it lives), so I know what I'm changing and what else it affects.
- As a designer, I want every other instance of the same component highlighted, so I can tell a one-off from a system change.
- As a designer, I want values that aren't on a token flagged, with the nearest tokens offered, so the product stays on the system.
- As a designer, I want to change spacing, size, type, colour, radius, borders and shadows from a panel that offers the project's tokens, so the code stays on the system.
- As a designer, when no token fits, I want to create one (name, value, category) and apply it in the same step, so the system grows deliberately instead of drifting.
- As a designer, I want to edit text in place, switch a component's variant, and drag siblings into a new order.
- As a designer, I want to see and edit the page at phone, tablet and desktop widths, and say whether a change applies to every size or only from one size up.
- As a designer, I want to fix how a page behaves on a phone by showing the change in the Phone frame (stack this, hide that, move this below). I want it made properly in code even when it needs more than a class change, and checked at every size before I keep it.
- As a designer, I want to ask Claude for changes I can't make with the panel: inline on an element, with numbered notes on several elements, or by drawing on the page. I want Claude to use the project's tokens and components while doing it.
- As a designer, I want to see what changed, undo any step, and send the whole set to the developer as one PR with before and after screenshots.
- As a designer or developer, I want to see how the page in the frame performs (Web Vitals, slow interactions, components that re-render). I want to hand a finding to Claude, which can measure before and after its fix (TRU-17.3, TRU-17.4).
- As a developer, I want changes to arrive as a normal PR into my feature branch: small diffs, tokens not raw values, nothing outside UI files.
- As anyone, I want to run one command in a folder and get there, with no config to write.

## Happy path

1. A developer pushes `feat/x`.
2. The person runs one command, `truing feat/x`. It checks the machine, fetches the branch, creates or updates a hand-back branch, installs dependencies, starts the app and opens Truing in its own Chromium window. On a project Truing hasn't seen, it first checks Claude, reads the project and shows what it found, and the person confirms the start command.
3. Truing shows the app in a frame, with a route box and viewport presets (Phone 390, Tablet 768, Desktop 1440, Custom). If the app needs a sign-in, the person signs in in that window, as in any browser.
4. **Inspect.** In Select mode, hovering outlines elements and clicking selects one. The inspector shows:
   - the component and its variant (e.g. `Button · variant tonal-neutral · size sm`);
   - where it is used and where it is defined;
   - each style with its token name, and anything off-token in a warning style with the nearest tokens;
   - an "Instances" control that highlights every instance on the page and shows the count across the codebase.
5. **Edit visually.** Changes from the panel, inline text edits, variant switches, drag-reorders and changes made in the Phone or Tablet frame all preview at once. They gather in a **Changes** tray, each listed with its own undo. Each is labelled with how it will be applied:

   - **Direct:** a token or class swap on a static class string, a text edit, a variant prop, a static reorder. These are written to source exactly, with no model call.
   - **Claude:** anything that needs judgement or restructuring. Examples: responsive changes beyond a class swap, classes built at runtime, elements from a `.map()`, and changes spread over several components.

   **Apply** is one action. It writes the direct changes, then sends the Claude changes to Claude as one structured request. That request carries each element's source location, the intended values per viewport, and screenshots of the frames. Claude's edits are checked at Phone, Tablet and Desktop, and shown as a diff before they're kept. The app reloads on its own and shows the result.

6. **Create a token** when needed (see Rules: tokens). The new token appears in the project's token source and on the element in the same Apply.
7. **Ask Claude** for anything else: in the chat panel, with the selection attached as chips; in place on one element, with numbered pins; or by drawing on the page. Claude's answer shows what it changed and can be undone as one step.
8. **Send to developer.** Truing commits each applied step on the hand-back branch with a readable message. **Send** pushes the branch and opens a PR into `feat/x`, with the list of changes, before and after screenshots, and any new tokens.
9. The developer reviews and merges into `feat/x`.

## Rules

**Safety and scope**

- **Never in a deployed build.** Truing's runtime is injected into the app's frames by Truing's own browser, so the app contains none of its code (ADR 0001).
- **Git is the only store for changes.** Every change is a source edit on the hand-back branch. What Truing learned about a project lives in a profile outside the repository.
- **UI files only.** Truing and Claude may change the project's UI files, token source and stories, as read into the profile and confirmed by a person. They may not change server code, data, configuration, dependencies or tests. Claude's permissions enforce this, not just its instructions.
- **Claude runs on the person's own login.** Truing only ever runs their own unmodified `claude`. It never reads, stores or relays a credential, and has no login form. How Truing talks to Claude must stay within Anthropic's terms ([research](../research/claude-subscription-bridge.md)).
- **Existing copy is never reworded** unless the person asked for that text to change.

**Tokens**

- The panel offers what the project's scale allows for each property. Colours come from the palette or the semantic variables, type from the text styles, radius and shadow from their tokens.
- A raw value (`p-[13px]`, `text-[#333]`, `style={{…}}` colours) is off-token. It is flagged wherever it is shown, and the PR lists any left in place.
- **Creating a token:** names follow the project's existing patterns. The value is checked against existing tokens, and if one is visually indistinguishable, Truing offers that token instead. Every new token is called out in the PR.

**Instances and components**

- Editing one instance changes that call site only: classes or props on that usage.
- Changing a shared component's definition shows how many places use it, on this page and in the codebase, before Apply, and the PR flags it for the developer.
- Switching a variant uses the component's existing variants. Adding a variant goes to Claude, and the PR flags it.

**Viewports and responsive refinement**

- Tailwind is mobile-first. In a viewport other than Phone, the person chooses "all sizes" or "from this size up". The latter writes the breakpoint prefix (`md:`, `lg:`). That's a direct edit when the class string is static.
- Responsive refinement is mostly **Claude** work. The person shows the intent in the frame where it's wrong. Claude implements it the way the codebase does responsive layout: breakpoint classes first, then a different structure or component only when classes can't do it.
- Phone, Tablet and Desktop can be shown side by side on the same route, so a change at one size is checked against the others before Apply.

**Direct where possible, Claude where needed**

- Every visual change goes into the Changes tray the same way, whichever path applies it. Truing never refuses a visual change because it can't write it directly. It routes it to Claude and labels it so.
- **Direct (no model call):** token swaps on static class strings, including inside `cn()` and `cva()` definitions; breakpoint-prefixed classes on static strings; text in JSX; a variant prop; reordering static sibling JSX elements; creating a token.
- **Claude:** responsive restructuring; classes or text built at runtime; elements generated by `.map()` over data; a third-party component's internals; adding a variant or a prop; changes that span several components; anything the person marks "let Claude do this", even when a direct path exists.
- A Claude change is sent with its context: the elements' source locations, the component and variant, the tokens in play, the before and intended values per viewport, and cropped screenshots of each affected frame. The person sees Claude's diff and the frames after it, then keeps or undoes it as one step.

## Edge cases

- **Element rendered from a list** (`.map()` over data): an edit changes the template, so every item. The inspector says "applies to all N items".
- **Element rendered by a Server Component:** the source location still works. Live props may not be readable, and the inspector says so instead of showing nothing.
- **Element inside a library component** (Radix portals, icons): the inspector points to the project's call site and offers only what its wrapper exposes.
- **Hidden states** (hover, open menus, dialogs, errors): Interact mode lets the person click through the app to reach a state, then switch back to Select. Reloads after Apply may close a dialog. Truing re-selects the same source element where it can.
- **Feature branch moves while someone works:** Truing says so and merges the new commits on request. A conflict stops and asks for a developer.
- **Claude usage limit reached:** direct edits keep working. Claude changes stay staged in the tray, and the chat says when the limit resets.
- **Claude's change looks wrong at another size:** the per-viewport check after Apply shows it. The person undoes Claude's part only, or asks for a correction in the chat.
- **The app fails to start:** the log is shown, with a way to correct the command and try again.
- **The app fails to compile after an edit:** the error is shown in Truing with the change that caused it, and one click undoes it.
- **Two people on one feature:** out of scope for now. One hand-back branch per person.

## Out of scope

- Hosting Truing anywhere but a local machine.
- Real-time multiplayer and comments. The PR covers review.
- Editing server logic, data, routes, API calls or anything outside UI files.
- Two-way Figma sync. A one-way token export is TRU-19.3.
- Designing brand-new screens from nothing.

## Metrics

- **Time to first run:** from nothing installed to the app in Truing, on a project it has never seen. Target: under 30 minutes, with no config written.
- **Lead time:** from "feature on its branch" to "refinements merged into the feature branch". Measured on the pilot (TRU-13.3).
- **How changes were applied:** the split between direct and Claude changes, recorded rather than targeted. The measure shows where a new direct operation would save the most Claude usage.
- **Claude changes kept vs undone:** the share of Claude-applied visual changes kept after the per-viewport check. Target: at least 80% on the pilot.
- **Off-token count** from the lint baseline (TRU-11.6): down, never up.
- **Developer review time** for a typical refinement PR: under 15 minutes.

## Acceptance criteria

Each criterion names how it is proven.

- [ ] One command takes a person from a checked-out repo to Truing showing a branch. Proof: run on a clean account, timed (TRU-13.1, TRU-13.3).
- [ ] Clicking any element shows its component, variant, call-site and definition locations, and its styles as token names. Proof: unit tests on a fixture page covering a server-rendered element, a client component, a primitive with cva and a mapped list (TRU-2.1).
- [ ] "Instances" highlights every instance of the selected component on the page, and shows the codebase count. Proof: unit tests on a page with three `Button` variants (TRU-2.2).
- [ ] Off-token values are flagged in the inspector and listed for the page, with the nearest tokens. Proof: unit tests over the token matcher, plus a look at a fixture (TRU-11.2).
- [ ] Token swaps, text edits, variant switches and static reorders are written to source without a model call. The diff touches only the changed characters plus Prettier's formatting. Proof: unit tests on the edit engine over fixture files, and a check that no Claude process starts during them (TRU-4.1, TRU-11.5, TRU-16.9).
- [ ] A person can create a token. It lands in the right place, near-duplicates are refused with a suggestion, and the element uses it in the same change. Proof: unit tests on the token writer, and a look at the flow (TRU-11.5).
- [ ] Viewport presets resize the frame, and Phone, Tablet and Desktop can be shown side by side. "From this size up" writes the right breakpoint prefix. Proof: a look at 390, 768 and 1440 (TRU-1.5, TRU-4.2).
- [ ] A visual change that can't be written directly is staged like any other, labelled "Claude", and applied through Claude as part of the same Apply. The result is checked at Phone, Tablet and Desktop, and Claude's part can be undone without losing the direct edits. Proof: an integration test with a scripted Claude session, plus one live run (TRU-12.2).
- [ ] Chat, annotations and drawings reach Claude with the selected elements' context. Claude's edits are limited to UI files, and each answer can be undone as one step. Proof: an integration test with a scripted session, plus a denied attempt to edit server code (TRU-5.2, TRU-12.1 and TRU-17.1).
- [ ] Send pushes the hand-back branch and opens a PR into the feature branch with the change list, new tokens and before/after screenshots. Proof: a dry run against a throwaway branch (TRU-13.2).
- [ ] No Truing code in a production build. Proof: a check that builds and searches the output for Truing's marker (TRU-1.5).
- [ ] Features are modules: one can be added or removed without editing the core. Proof: a test that adds and removes a toy module (TRU-1.6).
- [ ] The performance panel shows Web Vitals, long tasks and React renders for the framed page, each tied to a source location. A finding can be handed to Claude, which measures before and after. Proof: a fixture with a slow component and a layout shift (TRU-17.3), and three seeded findings run through Claude (TRU-17.4).
- [ ] A project Truing has never seen opens with no config file and nothing added to the project. Proof: TRU-6's checks, and the pilot (TRU-13.3).

## Open questions and risks

- **Turbopack source maps and Server Components.** Settled by TRU-1.1: owner stacks resolve exactly. The fallback for pages past React's cap is TRU-10.1.
- **Claude bridge and Anthropic's terms.** Spawning the unmodified `claude` CLI is the case the terms name as allowed. Driving the Agent SDK with a subscription login is not clearly allowed, so Truing doesn't. Settled by TRU-1.2, and worth re-reading before each public release.
- **Adopt or compose.** Settled by TRU-1.3 and ADR 0001.
- **Fidelity of direct edits on cva and `cn()`.** Fixture-tested in TRU-4.1.
- **How often a read of a project is right.** Measured in TRU-13.3 and the tasks under TRU-8.
