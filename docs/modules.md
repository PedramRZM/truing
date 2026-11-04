# Writing a Truing module

Every feature of Truing is a module, the core ones included (ADR 0001, TRU-1.6). A module plugs in without any change to Truing's core: list it in `truing.config.ts` and it loads. Take it out of the list and its probe, panel, server handlers and Claude tools are gone.

This guide builds the toy module in [`examples/element-count/`](../examples/element-count/). It counts the elements on the page in each frame and shows the counts in the left panel. The server can answer with them, and Claude can ask for a count.

## The four parts

A module has up to four parts. Each runs in a different place, so each lives in its own file:

| File        | Runs in                                                     | Made with                       |
| ----------- | ----------------------------------------------------------- | ------------------------------- |
| `module.ts` | everywhere: it holds the schemas the parts share            | `defineModule({ ... })`         |
| `probe.ts`  | every app frame, before the page's own scripts              | `defineProbe(module, setup)`    |
| `panel.tsx` | the shell, as a section in the left or right panel, or both | `definePanel(module, sections)` |
| `server.ts` | Truing's Node process (ops, edits, Claude tools)            | `defineServer(module, setup)`   |

The left panel is 240 px wide and the right 280 px, and both sit beside the canvas (TRU-3.3). A section has about 216 and 256 px for its content, so long paths truncate rather than scroll sideways.

The left panel has two tabs (TRU-3.4): Design holds the page's structure, Theme its tokens. A left section sits in Design unless `panel.tab` says otherwise. The right panel has views (TRU-5.2): Properties, Claude, and Claude's configuration, which opens from the chat. A right section sits in Properties unless `panel.view` says otherwise, and a view no module asks for doesn't show.

Only `module.ts` is required. Each part it declares needs its file, and each file needs its declaration; Truing refuses to start if they disagree. All four come from [`src/module.ts`](../src/module.ts).

```
examples/element-count/
  module.ts
  probe.ts
  panel.tsx
  server.ts
```

## 1. Declare it: `module.ts`

`module.ts` says what each part sends and answers, as [zod/mini](https://zod.dev/packages/mini) schemas. Use `zod/mini`, not `zod`: the probe is bundled into a script that runs in every frame, and full zod is half a megabyte. This file is imported by all the parts, so it imports nothing else.

```ts
import * as z from 'zod/mini';

import { defineModule } from '../../src/module';

export default defineModule({
  id: 'element-count', // kebab-case, unique
  title: 'Element count', // the section's heading
  probe: {
    // What the probe sends. The panel and the server get the latest, per frame.
    reports: {
      count: z.object({ elements: z.number() }),
    },
    // What the server or the panel can ask a frame's probe.
    commands: {
      count: {
        input: z.object({ selector: z.optional(z.string()) }),
        output: z.object({ elements: z.number() }),
      },
    },
  },
  panel: { docks: ['left'], tab: 'design' }, // 'left', 'right', or both; `tab` is 'design' (the default) or 'theme'
  server: {
    // Calls the panel makes to the server.
    ops: {
      counts: {
        input: z.object({}),
        output: z.record(z.string(), z.number()),
      },
    },
  },
  claude: {
    tools: {
      // snake_case, unique across modules
      count_elements: {
        description:
          'Counts the elements on the page shown in each frame of Truing. Give a CSS selector to count only the elements that match it. Returns the count by frame.',
        input: z.object({ selector: z.optional(z.string()) }),
      },
    },
  },
});
```

Everything below is typed from this declaration. A report name the module doesn't declare, a payload of the wrong shape or a missing handler is a type error, and Truing also checks every payload against its schema when it arrives.

## 2. Look at the page: `probe.ts`

The probe runs in every frame of the app, at document start, before React. The `setup` function gets a context and returns the handlers for the module's commands.

```ts
import { defineProbe } from '../../src/module';

import elementCount from './module';

export default defineProbe(elementCount, (ctx) => {
  const count = (selector?: string): number =>
    document.querySelectorAll(selector ?? '*').length;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const report = ctx.guard(() => {
    timer = null;
    ctx.report('count', { elements: count() });
  });
  const soon = (): void => {
    timer ??= setTimeout(report, 250);
  };

  ctx.listen('load', () => {
    report();
    new MutationObserver(ctx.guard(soon)).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });

  return {
    commands: {
      count: ({ selector }) => ({ elements: count(selector) }),
    },
  };
});
```

What the context gives you:

| `ctx.`                        | What it does                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frame`                       | The frame's id in the shell: `main`, or `phone`, `tablet` and `desktop` side by side.                                                                                                                                          |
| `report(name, payload)`       | Sends a report. Before Truing's socket opens, the latest report of each name is kept and sent once it does.                                                                                                                    |
| `mode()`, `onMode(callback)`  | Select or Interact, now and on every change.                                                                                                                                                                                   |
| `view()`, `onView(callback)`  | How the shell shows the frames (TRU-2.5): `scale`, the canvas's zoom, so an overlay can draw at screen size; `spacing`, the Spacing toggle (S).                                                                                |
| `onPick(callback)`            | A click in Select mode. The click never reaches the app.                                                                                                                                                                       |
| `onDoubleClick(callback)`     | A double-click in Select mode, after its two clicks' picks (the selection module edits text in place with it). It never reaches the app.                                                                                       |
| `onContextMenu(callback)`     | A right-click in Select mode, before the shell opens its context menu there. It never reaches the app.                                                                                                                         |
| `onEscape(callback)`          | Esc in Select mode, outside a field. In Select mode the frame never takes focus, so the shell catches Esc and hands it to every frame; the app never sees it. Return true if it used the key; if nothing did, Esc leaves Fill. |
| `listen(type, handler, opts)` | A `window` listener. Use it rather than `addEventListener`: Truing removes it if the module fails.                                                                                                                             |
| `guard(fn)`                   | Wraps any other callback (an observer, a timer, a promise's handler) so a throw stops this module only.                                                                                                                        |

Keep the app untouched:

- Never change the app's own DOM or styles. React would see the change, and the designer would be judging something else. Draw on top instead: the selection module puts its outlines in a shadow root on `<html>` ([`src/modules/selection/overlay.ts`](../src/modules/selection/overlay.ts)).
- Only window listeners in the capture phase run before the app's own. The core's Select guard runs before any module's, and in Select mode it stops pointer, click and submit events. That's why picks come through `onPick`.
- The probe ships inside the init script, so keep its imports small: no React and no full zod.

## 3. Show it: `panel.tsx`

The panel is a React component in the shell. It gets everything as props, so most panels need no hooks:

```tsx
import { Fragment } from 'react';

import { definePanel } from '../../src/module';

import elementCount from './module';

const number = new Intl.NumberFormat('en');

export default definePanel(elementCount, {
  left: function ElementCountPanel({ frames, reports }) {
    const counted = frames.flatMap((frame) => {
      const latest = reports.count[frame.id];
      return latest ? [{ frame, elements: latest.elements }] : [];
    });

    if (counted.length === 0) {
      return <p className="module-empty">Counts show once a frame loads.</p>;
    }

    return (
      <dl className="module-facts">
        {counted.map(({ frame, elements }) => (
          <Fragment key={frame.id}>
            <dt>{frame.label}</dt>
            <dd>
              {number.format(elements)}{' '}
              {elements === 1 ? 'element' : 'elements'}
            </dd>
          </Fragment>
        ))}
      </dl>
    );
  },
});
```

`definePanel` takes one component per dock the module names, keyed `left` and `right`; a missing or extra one is a type error. Each section gets the same props, so a module with a section in each dock (the selection module's layers tree and inspector) shares its probe and its reports between them. What stopped shows in the first dock's section only. A section is headed by the module's `title`; `panel.titles` gives one dock its own (`titles: { left: 'Page' }`). `panel.tab` needs a left section; Truing refuses to start without one. A tab that isn't showing stays mounted, so a section keeps its state across a switch.

| Prop                          | What it is                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `frames`                      | The frames on the canvas, in order: `id`, `label` (Phone, Desktop, a device name), `href`, `connected`, `width`, `height`. |
| `activeFrame`                 | The frame last selected, or `null`.                                                                                        |
| `reports`                     | The latest report of each declared name, by frame id. Empty until the probe sends one.                                     |
| `changes`                     | The changes in the tray, in the order they were staged (TRU-4.1).                                                          |
| `state`                       | What the server part last published, by name; undefined until it has (TRU-5.2).                                            |
| `rightView`, `showRightView`  | The right panel's view now, and a way to show another (TRU-5.2).                                                           |
| `peers`                       | Another module's reports, for those `panel.follows` names, and its ops. Answers are `unknown`: parse them (TRU-5.2).       |
| `call(op, input)`             | Calls one of the module's server ops; a promise of its output.                                                             |
| `command(frame, name, input)` | Asks one frame's probe; a promise of its answer.                                                                           |
| `openMenu({ x, y, frame })`   | Opens the shell's context menu at a point on the screen, for that frame's pick (a tree row's right-click).                 |
| `notify(text, { stays })`     | A toast at the canvas's foot, about 1.5 s, replacing the last; `stays` keeps a failure there until the next one.           |
| `propertySections`            | Every module's sections for the properties panel, for the module that draws it (below). Empty for the rest.                |

Truing gives each section its heading (the module's `title`) and catches a panel that throws. A panel follows [`the design language`](design-language.md), Truing's design language. Style with Truing's CSS variables (`--ds-*` in [`src/shell/styles.css`](../src/shell/styles.css)) and these shared classes:

- `module-empty` for an empty or waiting state, in text 2;
- `module-facts` on a `<dl>` for label and value rows, 24 px each: `the design language`'s Value row.

A section that stops shows `the design language`'s Failure pattern by itself. `panel: { docks: ['right'], foot: true }` pins a right section to the panel's foot, under whichever view shows; the section's title stays for screen readers only, so its first line has to say what it is. The Changes tray is the one that does (TRU-3.10).

The shell is dense, follows the system's light or dark, and shares nothing with the app: no Tailwind, and none of the app's components. Its colours are the `--ds-*` tokens (`the design language`); a test fails on a colour literal anywhere else.

### Under a view, and over the canvas

Two more places take a component, as options to `definePanel` (TRU-5.2):

- `foot` is pinned under the Changes summary while the module's view shows, and stays mounted behind it, so a half-written message survives a switch.
- `canvas` is drawn over the frames, in screen pixels, in the layer that moves with the canvas. It gets the panel's props and `place(frame, { x, y })`, which turns a point in a frame's own pixels into `{ left, top }`, or null when that frame isn't there.

### Adding to the properties panel

The right panel's Properties view is one list of sections that follows the selection (TRU-3.8). Any module can add one through `definePanel`, with no change to the shell. The module doesn't need a right section of its own:

```tsx
export default definePanel(
  module,
  { left: Panel },
  {
    properties: [
      {
        id: 'fill', // a slot in PROPERTY_SECTIONS, in src/module.ts
        title: 'Fill',
        applies: (pick) => true, // false leaves the section out
        empty: (pick) => false, // true draws one greyed line with a +
        Body: ({ pick }) => <p>{pick.own['background-color']}</p>,
      },
    ],
  },
);
```

- `PROPERTY_SECTIONS` in [`src/module.ts`](../src/module.ts) sets which sections show for an `element`, for `text` and for the `page` (nothing picked), and in what order. A new kind of section adds its slot there. Two modules may share a slot; they show in the config's order.
- `pick` says what's showing: `kind`, `frame`, `id` (null for the page), `classes`, `own` and `parent` (computed styles), `backdrop`, `setsText`, `width` and `height`. The properties it holds are `COMPUTED_PROPERTIES` in `src/modules/selection/design-values.ts`.
- `Body` gets the module's own panel props with `pick`.
- `closed: true` makes a section the designer opens, closed until they do and remembered after that (Code).
- `Add` is an empty section's `+`, rendered with the same props as `Body`. Without it, the `+` stays disabled. `empty` reads the pick with what's staged laid over it, so a section opens as soon as something is added.
- `pick.setsText` says the pick holds only text, or its classes set type or a text colour. `pick.backdrop` is the colour behind it, from its nearest ancestor with one, or null when that can't be told.
- A section that throws stops alone, and says so in its place.

The section's values follow `the design language`: a designer's numbers, with the linked token as an icon, and code only in Code.

### The panel's controls

Sections that edit a value use the shell's controls (TRU-3.9), in [`src/shell/controls/`](../src/shell/controls/). They hold no knowledge of what they change: they report it, and the section stages it.

| Control                                               | What it does                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ScaleField` (`field.tsx`)                            | A number on a scale. `onPreview` is live during a drag or an arrow key; `onCommit` comes once per change. |
| `SliderField` (`slider.tsx`)                          | The same, with a slider beside it.                                                                        |
| `TokenField`, `TokenButton` (`field.tsx`)             | A value only a token sets, or the button beside one. Each opens `TokenMenu`.                              |
| `Segmented`, `Checkbox`, `IconToggle` (`toggles.tsx`) | One of a few, on or off, pressed or not.                                                                  |
| `AlignmentPad` (`alignment-pad.tsx`)                  | The 3 × 3 pad for a flex frame.                                                                           |
| `ChoiceMenu` (`choice-menu.tsx`)                      | A few options behind an icon button, or a field when given `value`.                                       |

- `tokenRows(tokens, namespace)` and `stepsOf(rows)` in `token-rows.ts` turn the manifest into a menu's rows and a field's scale. The project's own tokens show, or Tailwind's where the project has none.
- Give a `ScaleField` a `key` per element, so a new pick starts it afresh.
- `Segmented`, `IconToggle`, `AlignmentPad`, `ChoiceMenu` and the token menus take `onPreview`, called with the option under the pointer and null once there is none. Show it on the page: every option that changes the page does (`the design language`, "Point to preview").
- `TRUING_CONTROLS=1 truing` adds a section with every control on the project's tokens, to try them. It writes nothing (`test/modules/controls/`).

### Commands: keys, the `?` sheet and the context menu

Truing has one list of commands (TRU-2.3, [`src/commands.ts`](../src/commands.ts)). The key handlers, the `?` sheet, the rail's tooltips and the context menu all read it, so they can't disagree. A module adds its own as `actions` in `module.ts`, and its panel runs them:

```ts
// module.ts
actions: {
  'copy-path': { title: 'Copy path', keys: [{ key: 'c' }], menu: 'copy' },
  'copy-selector': { title: 'Copy selector', menu: 'copy' },
},

// panel.tsx
export default definePanel(module, { right: Inspector }, {
  actions: {
    'copy-path': {
      enabled: (props) => /* is there a pick with a path? */,
      run: (props) => /* copy it, then props.notify('Copied the path') */,
    },
  },
});
```

- `keys` are chords: `{ key: 'Enter', shift: true }`, or `{ codes: ['Digit1'], shift: true }` for a key whose character moves with Shift or the layout. `mod` is ⌘ on a Mac and Ctrl elsewhere. A key without a modifier never fires in a field, the app's or Truing's, and Enter, Tab and Space never fire on a focused control. No two commands may share a chord (a unit test checks the list).
- `menu: 'copy'` puts the command in the right-click menu, in that group, with its first key beside it. Groups are kebab-case names; rows with the same name sit together, the groups in the order they first appear, with a line between them. The selection module's are `open`, `copy` and `select`.
- `enabled` says whether it applies now. A key does nothing while it's `false`, so Tab without a pick still moves focus. It may return a promise (the pick's call site is still being read): the menu shows the row disabled until it settles. Return the same promise for the same reports, or the menu waits forever.
- `run` gets the panel's props, for the frame the inspector shows.

### What the context menu shows besides the actions

A panel can add a header and lists to the right-click menu (TRU-2.4), as data: the shell draws them, places them in the window and handles their keys.

```ts
// panel.tsx
export default definePanel(module, { right: Inspector }, {
  actions: { … },
  menu: {
    header: (props, target) => ({ title: 'Button · button', place: 'src/a.tsx:12', open: () => … }),
    lists: [
      {
        title: 'Select layer',
        group: 'select',
        items: (props, target) => /* [{ id, label, detail?, current? }] */,
        highlight: (props, target, item) => /* outline it in the frame; null clears */,
        choose: (props, target, item) => /* pick it */,
      },
    ],
  },
});
```

- `target` is the menu being shown, a new object per opening: `{ id, frame, point }`. `point` is the right-click in the frame's own pixels, or `null` when a tree row opened the menu.
- `header` gives the menu's first rows: a title, then `place` (a path that opens in the editor when `open` is given, or a sentence saying why there is none).
- Each list is a row at the end of its `group` that opens the list beside the menu, on hover, →, Enter or a click. `items` returning `null` leaves the row out; an empty list shows it disabled. Hovering or focusing an item calls `highlight`, and choosing it calls `choose` and closes the menu. `current` marks one item with a check.
- `header` and `items` may return promises. Return the same promise for the same target (and the same reports), or the menu waits forever.

## 4. Serve it: `server.ts`

The server part runs in Truing's Node process. `setup` gets a context and returns the handlers for every op, direct operation and Claude tool the module declares; a missing one stops the module at start.

```ts
import { defineServer } from '../../src/module';

import elementCount from './module';

export default defineServer(elementCount, (ctx) => ({
  ops: {
    counts: () =>
      Object.fromEntries(
        Object.entries(ctx.reports('count')).map(([frame, latest]) => [
          frame,
          latest.elements,
        ]),
      ),
  },
  tools: {
    count_elements: async ({ selector }) => {
      const frames = ctx.frames();
      if (frames.length === 0) {
        throw new Error('No frame of the app is open in Truing.');
      }
      const counts = await Promise.all(
        frames.map(async (frame) => {
          const { elements } = await ctx.command(frame, 'count', { selector });
          return [frame, elements] as const;
        }),
      );
      return Object.fromEntries(counts);
    },
  },
}));
```

| `ctx.`                           | What it does                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `root`, `config`                 | The project's root folder and its config.                                                                         |
| `log(line)`                      | A line in Truing's terminal output, prefixed with the module's id.                                                |
| `frames()`                       | The frames this module's probe runs in now.                                                                       |
| `reports(name)`                  | The latest report of a name, by frame id.                                                                         |
| `command(frame, name, input)`    | Asks one frame's probe. Rejects if the frame is gone, reloads or doesn't answer within 5 s.                       |
| `stage(change)`                  | Puts a change in the Changes tray, routed Direct or Claude (below).                                               |
| `changes`                        | The tray: its list, Undo, Discard, "Let Claude do this" and Apply (below).                                        |
| `publish(name, value)`           | Tells the panel something, checked against `server.state`. Keeps the latest for a new shell (TRU-5.2).            |
| `exclusive(job)`                 | Runs one job that writes source, after the ones before it. Apply and Claude's turns share this queue (TRU-5.2).   |
| `screenshot`                     | `element(frame, selector)` and `frame(frame)`: what's on the canvas, cropped, never scrolling the page (TRU-5.2). |
| `onClose()`                      | A handler you return: Truing is closing, so stop what the part started (TRU-5.2).                                 |
| `onReport(name, payload, frame)` | A handler you return, not a context function: called for each report as it arrives.                               |

A report sent as the pointer moves would render every panel each time. List it in `probe.serverOnly` and it goes to the server alone, never the shell.

### Claude tools

A tool's handler returns any JSON value; Claude gets it as text. To refuse, throw an `Error` whose message says what went wrong and what to try instead. Claude reads the message, never a stack trace. Write the description for Claude: what the tool does, what each input means, and what comes back.

Truing collects every module's tools into one list (`truing.modules.tools`), each with its JSON Schema. Its MCP server (TRU-12.1) will serve that list to Claude. Until then the tools can be listed and called, but Claude can't reach them.

### Staged changes and direct operations

Every visual change goes into the Changes tray the same way, whichever path will apply it (the product spec, TRU-4.1). A module describes the change, and Truing decides how it is applied:

```ts
const change = await ctx.stage({
  label: 'Button variant: tonal → default', // what the tray shows
  intent: "Set Button's variant to default.", // in words, for Claude
  viewport: { frame: 'phone', width: 390 }, // where it was made
  scope: 'all', // or { from: 'md' }: from a breakpoint up
  element, // the pick: tag, selector, classes, call site, definition, component
  property: 'variant variant',
  before: [{ value: 'tonal', token: null }],
  after: [{ value: 'default', token: null }],
  write: {
    by: 'edit',
    edit: {
      kind: 'variant',
      at,
      definition,
      component: 'Button',
      name: 'variant',
      value: 'default',
    },
  },
});
```

`write` says what would be written without a model:

- `{ by: 'edit', edit }` goes to Truing's direct engine (`src/edits/`). An edit is `classes` (on a `className` literal or `cn()` call), `cva` (one variant's classes), `variant` (a prop checked against the cva config) or `text`. The engine checks it when it is staged: if it can be written exactly, the change is **Direct**; if not, it is **Claude**, with the reason in plain words ("class is built at runtime").
- `{ by: 'op', op, input }` names one of the module's own **direct operations**, for writes the engine doesn't do. Declare them in `module.ts` under `server.direct` (name and input schema), and handle them in `server.ts` under `direct`. Each returns `{ status: 'applied' }`, `{ status: 'needs-claude', reason }` or `{ status: 'failed', message }`.
- `null` is a change only Claude can carry out; give the `reason` ("layout change at Phone size needs restructuring").
- An `edit` with a `reason` goes to Claude anyway, and the edit stays for its preview and for TRU-12.2 to read (TRU-4.2: a change at one size only).

`claude: true` stages it for Claude even when it could be direct ("Let Claude do this"). The staged change (`StagedChange`, version 5) also records each file the edit reads with its hash: Apply stops with "changed since you made this change; reload" if one moved on.

`reach` says which code the change is for (TRU-2.2): `{ kind: 'use' }`, the default, for one use of a component, or `{ kind: 'component', component, usages }` for the component itself, which changes every use. `usages` counts its uses in the code, or is null when that isn't known. The tray shows a shared change with its count, and TRU-13.2's PR says which changes are shared. A `cva` edit is always the component's. TRU-4.5 adds `{ kind: 'list', items }`, one place in the code that draws `items` elements, and `{ kind: 'similar', of }`, which follows change `of` onto an element like the one it was made on: undoing that change takes its followers with it, and the tray folds them into one line on its row. `element.also` names the other elements one edit changes, so the preview shows on them, and `list: true` on an edit lets the engine write JSX inside a `.map()`, as the designer chose every item. The selection module's `usages.ts` counts the uses of any component by its module and export, so other modules (the gallery, TRU-15.1) can ask about components that aren't picked.

`ctx.changes` is the tray itself: `list()`, `onChange(callback)`, `preview(draft)` (shows a change still being made, or an option under the pointer, without staging it; null clears it), `draft()`, `remove(id)`, `discard()`, `setClaude(id, claude)` and `apply()`, which writes every direct change, all or none, and leaves the Claude ones staged until TRU-12.2 sends them. Panels get the list as `props.changes`. The built-in `changes` module is the tray: it previews each change in the frames through an override stylesheet, and lists them with Undo, Apply and Discard.

## 5. Load it

A project's own modules are the one thing Truing can't work out by reading. List yours in an optional `truing.config.ts` at the project's root, in the order its section should appear:

```ts
modules: [
  'selection', // a bare name: a module that ships with Truing, in src/modules/
  './truing/modules/element-count', // a path from the project root: your own
],
```

Restart `truing` after changing the list. `truing --watch` rebuilds panels as you edit them; a probe or server change needs a restart.

A module of your own lives outside this package. Its imports of `react`, `react-dom`, `zod` and `lucide-react` resolve from Truing's own dependencies, never the app's, so the shell never carries two Reacts. Import the contract by its path, `src/module`.

## When a module fails

A module that throws stops alone; the rest of Truing keeps working:

| Where it throws                                                                                              | What happens                                                                                                         |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| the probe's `setup`, or a callback from `listen`, `guard`, `onMode`, `onPick`, `onContextMenu` or `onEscape` | Its listeners are removed in that frame, and its section says it stopped there. Reloading the frame starts it again. |
| a probe command                                                                                              | The caller gets the error; the probe keeps running.                                                                  |
| the panel, while rendering                                                                                   | Its section shows the error instead of the panel.                                                                    |
| the server's `setup`                                                                                         | Its ops and tools are not registered, and its section says it didn't start.                                          |
| an op, a tool or a direct operation                                                                          | The caller gets the error message.                                                                                   |

[`test/modules/broken/`](../test/modules/broken/) throws in its probe and its panel; `test/e2e/modules.spec.ts` checks that the others keep working.

## Testing a module

- **Unit (Vitest):** call the server part through the host with `createModuleHost`, and the probe with `startProbes`. See `test/unit/module-host.test.ts` and `test/unit/probes.test.ts`.
- **Through Truing (Playwright):** start Truing with your module listed and check what a designer sees; `test/e2e/modules.spec.ts` does this for the toy module.

## Not wired yet

- **Skills.** ADR 0001 gives a module a Claude skill too. Truing's own design skill ships in its plugin (`src/claude/plugin/`, TRU-5.2), but a module can't add one yet: that waits for Claude's tools (TRU-12.1).
