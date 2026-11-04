// The module contract (TRU-1.6, ADR 0001). Every feature of Truing, the
// core ones included, is a module: a folder with a `module.ts` that declares
// the typed surface of each part, and one file per part:
//
//   module.ts   defineModule(...)                schemas only
//   probe.ts    defineProbe(module, setup)       runs in every app frame
//   panel.tsx   definePanel(module, sections)    a section in each dock it names
//   server.ts   defineServer(module, setup)      runs in Truing's Node process
//
// This file is imported from all three places, so it imports nothing but
// zod/mini and types. MODULES.md is the guide.
import type { ReactNode } from 'react';

import * as z from 'zod/mini';

import type { CommandSpec } from './commands';
import type { TruingConfig } from './config';
import type { Mode, View } from './protocol';

/** A zod/mini schema: the runtime bundle stays small. */
export type Schema = z.ZodMiniType;

/** A call with an answer: a probe command or a server op. */
export type CallSpec = { input: Schema; output: Schema };

/** The shell's two docks: the panels left and right of the canvas. */
export const DOCKS = ['left', 'right'] as const;
export type Dock = (typeof DOCKS)[number];

/** The left panel's tabs: Design holds the page's structure, Theme its tokens. */
export const LEFT_TABS = ['design', 'theme'] as const;
export type LeftTab = (typeof LEFT_TABS)[number];

/**
 * The right panel's views: Properties follows the selection, Claude is the chat
 * and Claude's configuration opens from it (TRU-5.2), and Settings is the project's
 * (TRU-10.3).
 */
export const RIGHT_VIEWS = [
  'properties',
  'claude',
  'claude-config',
  'settings',
] as const;
export type RightView = (typeof RIGHT_VIEWS)[number];

export type ModuleSpec = {
  /** Kebab-case and unique; also the name the config lists for a built-in module. */
  id: string;
  /** The section's heading in the shell. */
  title: string;
  probe?: {
    /** What the probe sends, by name. The panel and the server get the latest, per frame. */
    reports?: Record<string, Schema>;
    /**
     * Reports that only the server needs, so they never reach the shell: one
     * sent while the pointer moves would render every panel each time.
     */
    serverOnly?: readonly string[];
    /** What the server or the panel can ask a frame's probe, by name. */
    commands?: Record<string, CallSpec>;
  };
  panel?: {
    /** Which docks get a section: the left panel, the right panel, or both. */
    docks: readonly Dock[];
    /** A section's heading in one dock, when it isn't the module's title. */
    titles?: Partial<Record<Dock, string>>;
    /** Which of the left panel's tabs its left section sits in; Design unless it says. */
    tab?: LeftTab;
    /** Its right section is pinned to the panel's foot, under whichever view shows (TRU-3.10). */
    foot?: boolean;
    /** Which of the right panel's views its right section sits in; Properties unless it says (TRU-5.2). */
    view?: RightView;
    /**
     * Another module's reports this panel reads, by module id: its panel
     * renders when they change, and `props.peers` hands them over (TRU-5.2).
     */
    follows?: Readonly<Record<string, readonly string[]>>;
  };
  server?: {
    /** Calls the panel (and the module's Claude tools) make to the server. */
    ops?: Record<string, CallSpec>;
    /**
     * What the server part tells its panel without being asked, by name: the
     * latest of each, sent with `ctx.publish` and read as `props.state` (TRU-5.2).
     */
    state?: Record<string, Schema>;
    /**
     * Edits the module can write without a model. A staged change names one,
     * and Apply runs it (TRU-4.1); each returns an `ApplyResult`.
     */
    direct?: Record<string, { input: Schema }>;
  };
  claude?: {
    /** Tools Claude gets over Truing's MCP server (TRU-12.1), by tool name. */
    tools: Record<string, { description: string; input: Schema }>;
  };
  /**
   * The module's commands in Truing's one list (TRU-2.3): their keys, the
   * `?` sheet and, with `menu`, the context menu. `panel.tsx` runs them.
   */
  actions?: Record<string, ActionSpec>;
};

/**
 * A module's command: what the list shows, and the context menu's group it
 * sits in (`open`, `copy`, `select`), if the menu has it (TRU-2.4).
 */
export type ActionSpec = CommandSpec & { menu?: string };

export const MODULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const TOOL_NAME = /^[a-z][a-z0-9_]*$/;

/** Declares a module. The loader checks the rest (its files, unique names). */
export function defineModule<M extends ModuleSpec>(spec: M): M {
  if (!MODULE_ID.test(spec.id)) {
    throw new Error(`Module id "${spec.id}" must be kebab-case.`);
  }
  for (const name of Object.keys(spec.claude?.tools ?? {})) {
    if (!TOOL_NAME.test(name)) {
      throw new Error(
        `Tool "${name}" in module "${spec.id}" must be snake_case.`,
      );
    }
  }
  return spec;
}

// ---------------------------------------------------------------------------
// Staged changes: how every module puts an edit in the Changes tray.

// Version 2 (TRU-4.1): the element, the property, the before and after values,
// the viewport and scope, the edit the engine would write, and the route
// with its reason. TRU-12.2 reads the Claude ones; TRU-13.2 lists them in the PR.
// Version 3 (TRU-2.2): the reach, one use or the shared component, which moves
// the cva edit's `usages` to every shared change.
// Version 4 (TRU-4.2): a scope of one size only, and a Claude change may keep its
// edit, for its preview and for TRU-12.2 to read; a classes edit may add `className`
// to a component that passes it on.
// Version 5 (TRU-4.5): a change can reach every item a list draws, or follow another
// change onto an element like the one it was made on. `element.also` names the
// others its one edit changes, for the preview, and an edit may be `list`.
export const STAGED_CHANGE_VERSION = 5;

/**
 * The change set's schemas, made in one function the bundler may drop: the
 * runtime in every frame never parses a staged change, and a top-level
 * schema would ship in it anyway (its budget, bundles.test.ts).
 */
function changeSetSchemas() {
  /** A place in a source file: one-based line and column, columns in UTF-16 units, as TRU-1.1's positions are. */
  const sourceAt = z.object({
    file: z.string().check(z.minLength(1)),
    line: z.number().check(z.int(), z.positive()),
    column: z.number().check(z.int(), z.positive()),
  });

  // A name that can't leave the string or the attribute it is spliced into:
  // no quotes, backticks, braces, backslashes or spaces.
  const token = z.string().check(z.regex(/^[^\s"'`\\{}]+$/));
  const classList = z.array(token);

  /**
   * What the direct engine (`src/edits/`) would write.
   *
   * - `classes`: add and remove classes on the JSX element at `at`, in its
   *   `className` literal, its `cn(...)` call (a `tones[tone]` entry included),
   *   or the base of a cva call in the same file. Classes are written as given,
   *   breakpoint prefixes included (`md:px-500`).
   * - `cva`: one variant's classes inside the `cva()` config `component` uses,
   *   in `file`. Every instance changes: its reach is the component.
   * - `variant`: `name="value"` on the component at `at`, checked against the
   *   variants its cva config in `definition` declares.
   * - `text`: the JSX text of the element at `at`.
   */
  const editSchema = z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('classes'),
      at: sourceAt,
      /** The tag the JSX at `at` should have (`p`, `Button`): a stale position is refused. */
      tag: z.optional(z.string()),
      add: classList,
      remove: classList,
      /** The component at `at` passes a `className` on, so one can be added to it. */
      takesClassName: z.optional(z.boolean()),
      /** The designer chose every item: the JSX may sit in a `.map()`. */
      list: z.optional(z.boolean()),
    }),
    z.object({
      kind: z.literal('cva'),
      file: z.string().check(z.minLength(1)),
      component: z.string(),
      variant: z.string(),
      value: z.string(),
      add: classList,
      remove: classList,
    }),
    z.object({
      kind: z.literal('variant'),
      at: sourceAt,
      tag: z.optional(z.string()),
      definition: z.string().check(z.minLength(1)),
      component: z.string(),
      name: token,
      value: token,
      /** The designer chose every item: the JSX may sit in a `.map()`. */
      list: z.optional(z.boolean()),
    }),
    z.object({
      kind: z.literal('text'),
      at: sourceAt,
      tag: z.optional(z.string()),
      before: z.string(),
      after: z.string(),
    }),
  ]);

  /** A value before or after a change, with the token it reads where there is one. */
  const changeValue = z.object({
    value: z.string(),
    token: z.nullable(z.string()),
  });

  /** The element a change is made on, as the inspector saw it. */
  const changeElement = z.object({
    tag: z.string(),
    /** The page it was picked on. */
    href: z.string(),
    /** Finds it on the page now, for the preview. */
    selector: z.string(),
    /** Its classes when the change was staged. */
    classes: z.array(z.string()),
    /** Selectors of the other elements the one edit changes, for the preview (TRU-4.5). */
    also: z.optional(z.array(z.string())),
    /** Where the component is used, and the JSX that draws the element. */
    callSite: z.nullable(sourceAt),
    definition: z.nullable(sourceAt),
    component: z.nullable(
      z.object({
        name: z.string(),
        variants: z.array(z.object({ name: z.string(), value: z.string() })),
      }),
    ),
  });

  /** Every size, from a Tailwind breakpoint up (`md`, `lg`), or one size only (`Phone`). */
  const scope = z.union([
    z.literal('all'),
    z.object({ from: z.string().check(z.minLength(1)) }),
    z.object({ only: z.string().check(z.minLength(1)) }),
  ]);

  /**
   * Which code the change is for (TRU-2.2): this use of a component, or the
   * component itself, which changes every use. `usages` counts its uses in
   * the code, or is null when that isn't known. TRU-13.2's PR says which. TRU-4.5
   * adds `list`, one place in the code drawing `items` elements, and `similar`,
   * which follows the change `of` onto an element like the one it was made on.
   */
  const reach = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('use') }),
    z.object({
      kind: z.literal('component'),
      component: z.string().check(z.minLength(1)),
      usages: z.nullable(z.number().check(z.int(), z.nonnegative())),
    }),
    z.object({
      kind: z.literal('list'),
      items: z.number().check(z.int(), z.positive()),
    }),
    z.object({
      kind: z.literal('similar'),
      of: z.string().check(z.minLength(1)),
    }),
  ]);

  /** How it would be written without a model: by the engine, by one of the module's direct operations, or not at all. */
  const write = z.nullable(
    z.discriminatedUnion('by', [
      z.object({ by: z.literal('edit'), edit: editSchema }),
      z.object({ by: z.literal('op'), op: z.string(), input: z.unknown() }),
    ]),
  );

  /** Which path Apply takes, and why Claude, in plain words. */
  const route = z.discriminatedUnion('by', [
    z.object({ by: z.literal('direct') }),
    z.object({
      by: z.literal('claude'),
      /** "class is built at runtime", "you asked Claude to do this". */
      reason: z.string(),
      /** The designer chose "Let Claude do this". */
      requested: z.boolean(),
    }),
  ]);

  const stagedChangeSchema = z.object({
    version: z.literal(STAGED_CHANGE_VERSION),
    id: z.string(),
    module: z.string(),
    /** What the tray shows, e.g. "Padding 16 → 24 on Button". */
    label: z.string(),
    /** What the designer wants, in words, for Claude ("stack these two columns on Phone"). */
    intent: z.string(),
    /** The frame it was made in and its width; null for neither. */
    viewport: z.object({
      frame: z.nullable(z.string()),
      width: z.nullable(z.number()),
    }),
    scope,
    reach,
    element: z.nullable(changeElement),
    /** `padding-inline`, `text`, `variant size`. */
    property: z.string(),
    before: z.array(changeValue),
    after: z.array(changeValue),
    write,
    route,
    /** Each file the edit reads, with its SHA-256 when it was staged: a mismatch at Apply stops it. */
    files: z.array(z.object({ file: z.string(), hash: z.string() })),
  });

  return {
    sourceAt,
    edit: editSchema,
    changeValue,
    changeElement,
    scope,
    reach,
    write,
    route,
    stagedChange: stagedChangeSchema,
  };
}

export const changeSchemas = /* @__PURE__ */ changeSetSchemas();

export type SourceAt = z.infer<typeof changeSchemas.sourceAt>;
export type Edit = z.infer<typeof changeSchemas.edit>;
export type ChangeValue = z.infer<typeof changeSchemas.changeValue>;
export type ChangeElement = z.infer<typeof changeSchemas.changeElement>;
export type Scope = z.infer<typeof changeSchemas.scope>;
export type Reach = z.infer<typeof changeSchemas.reach>;
export type Route = z.infer<typeof changeSchemas.route>;
export type StagedChange = z.infer<typeof changeSchemas.stagedChange>;

/** What applying one change did (Cortex's three-way result). */
export type ApplyResult =
  | { status: 'applied' }
  | { status: 'needs-claude'; reason: string }
  | { status: 'failed'; message: string };

export const applyResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('applied') }),
  z.object({ status: z.literal('needs-claude'), reason: z.string() }),
  z.object({ status: z.literal('failed'), message: z.string() }),
]);

// ---------------------------------------------------------------------------
// What each part sees, typed from the module's declaration.

type Part<T, K extends PropertyKey> = T extends { [P in K]?: infer V }
  ? NonNullable<V>
  : never;
type Section<T, K extends PropertyKey> = [Part<T, K>] extends [never]
  ? Record<never, never>
  : Part<T, K>;

export type Reports<M extends ModuleSpec> = Section<
  Section<M, 'probe'>,
  'reports'
>;
export type Commands<M extends ModuleSpec> = Section<
  Section<M, 'probe'>,
  'commands'
>;
export type Ops<M extends ModuleSpec> = Section<Section<M, 'server'>, 'ops'>;
export type ServerState<M extends ModuleSpec> = Section<
  Section<M, 'server'>,
  'state'
>;
export type Direct<M extends ModuleSpec> = Section<
  Section<M, 'server'>,
  'direct'
>;
export type Tools<M extends ModuleSpec> = Section<
  Section<M, 'claude'>,
  'tools'
>;

type Name<T> = Extract<keyof T, string>;
/** What a handler receives: the input after parsing. */
type In<C> = C extends { input: infer S } ? z.infer<S> : never;
/** What a caller passes, before parsing. */
type Arg<C> = C extends { input: infer S } ? z.input<S> : never;
/** What a caller gets back: the output after parsing. */
type Out<C> = C extends { output: infer S } ? z.infer<S> : never;
/** What a handler returns, before Truing parses it. */
type Reply<C> = C extends { output: infer S } ? z.input<S> : never;
type Answer<T> = T | Promise<T>;

/** A handler for every name a module declared; nothing when it declared none. */
type HandlersFor<Key extends string, T, Handler> = [Name<T>] extends [never]
  ? { [P in Key]?: never }
  : { [P in Key]: Handler };

// ---------------------------------------------------------------------------
// The probe: runs in every app frame, before the page's own scripts.

export type ProbeContext<M extends ModuleSpec> = {
  /** The frame's id in the shell (main, phone, tablet, desktop). */
  frame: string;
  /** Select or Interact, as now. */
  mode: () => Mode;
  report: <K extends Name<Reports<M>>>(
    name: K,
    payload: z.input<Reports<M>[K]>,
  ) => void;
  onMode: (callback: (mode: Mode) => void) => void;
  /** How the shell shows the frames: the canvas's zoom and the Spacing toggle (TRU-2.5). */
  view: () => View;
  onView: (callback: (view: View) => void) => void;
  /** A click in Select mode. It never reaches the app. */
  onPick: (callback: (event: MouseEvent) => void) => void;
  /** A double-click in Select mode, after its two clicks' picks. It never reaches the app. */
  onDoubleClick: (callback: (event: MouseEvent) => void) => void;
  /**
   * A right-click in Select mode, before the shell opens its context menu
   * there. It never reaches the app.
   */
  onContextMenu: (callback: (event: MouseEvent) => void) => void;
  /**
   * Esc in Select mode, outside a field. The frame never takes focus in
   * Select mode, so the shell catches the key and hands it to every frame.
   * Return true if it used the key; if nothing did, Esc leaves Fill.
   */
  onEscape: (callback: () => unknown) => void;
  /** A window listener Truing removes if the module fails. */
  listen: <K extends keyof WindowEventMap>(
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => void;
  /**
   * Wraps any other callback (an observer, a timer): a throw inside it marks
   * the module failed instead of breaking the frame.
   */
  guard: <A extends unknown[]>(
    fn: (...args: A) => void,
  ) => (...args: A) => void;
};

export type ProbeHandlers<M extends ModuleSpec> = HandlersFor<
  'commands',
  Commands<M>,
  {
    [K in Name<Commands<M>>]: (
      input: In<Commands<M>[K]>,
    ) => Answer<Reply<Commands<M>[K]>>;
  }
>;

export type ProbeDefinition<M extends ModuleSpec = ModuleSpec> = {
  part: 'probe';
  module: M;
  setup: (context: ProbeContext<M>) => ProbeHandlers<M> | void;
};

export function defineProbe<M extends ModuleSpec>(
  module: M,
  setup: (context: ProbeContext<M>) => ProbeHandlers<M> | void,
): ProbeDefinition<M> {
  return { part: 'probe', module, setup };
}

// ---------------------------------------------------------------------------
// The panel: a section in one of the shell's docks.

export type PanelFrame = {
  id: string;
  /** Phone, Tablet, Desktop, a device name or Custom. */
  label: string;
  /** Where the frame is, once its runtime said hello. */
  href: string | null;
  connected: boolean;
  /** Its viewport, in CSS pixels. */
  width: number;
  height: number;
};

/**
 * What a panel may ask of another module. Answers are `unknown` on purpose: the
 * other module may not be listed, or may change, so the reader parses them.
 */
export type PanelPeers = {
  /** The latest report of a name `panel.follows` lists, by frame id. */
  reports: (module: string, name: string) => Readonly<Record<string, unknown>>;
  call: (module: string, op: string, input: unknown) => Promise<unknown>;
};

export type PanelProps<M extends ModuleSpec> = {
  /** The frames on the canvas, in display order. */
  frames: readonly PanelFrame[];
  activeFrame: string | null;
  /** The latest report of each name, by frame id. */
  reports: {
    [K in Name<Reports<M>>]: Readonly<Record<string, z.infer<Reports<M>[K]>>>;
  };
  /** The Changes tray (TRU-4.1), as the server last sent it. */
  changes: readonly StagedChange[];
  /** What the server part last published, by name; undefined until it has. */
  state: {
    [K in Name<ServerState<M>>]: z.infer<ServerState<M>[K]> | undefined;
  };
  /** The right panel's view now (TRU-5.2), and a way to show another. */
  rightView: RightView;
  showRightView: (view: RightView) => void;
  /** Other modules, for a panel that names them in `panel.follows` (TRU-5.2). */
  peers: PanelPeers;
  call: <K extends Name<Ops<M>>>(
    op: K,
    input: Arg<Ops<M>[K]>,
  ) => Promise<Out<Ops<M>[K]>>;
  command: <K extends Name<Commands<M>>>(
    frame: string,
    name: K,
    input: Arg<Commands<M>[K]>,
  ) => Promise<Out<Commands<M>[K]>>;
  /** Opens the context menu at a point on the screen, for a frame's pick. */
  openMenu: (at: { x: number; y: number; frame: string }) => void;
  /**
   * A short line the shell shows and screen readers announce ("Copied the
   * path"). It goes after a moment; with `stays`, a failure stays until the
   * next notice.
   */
  notify: (text: string, options?: { stays?: boolean }) => void;
  /**
   * Every module's sections for the properties panel, for the module that
   * draws the panel (TRU-3.8). Empty for the others, and in an action's props.
   */
  propertySections: readonly BoundPropertySection[];
};

// ---------------------------------------------------------------------------
// The properties panel's sections (TRU-3.8). Any module can add one; this list
// sets where it goes, so nothing in the shell changes for a new one.

/** Which sections show for what's picked, in their order. */
export const PROPERTY_SECTIONS = {
  element: [
    'selection',
    'layout',
    'flex',
    'grid',
    'spacing',
    'radius',
    'blending',
    'fill',
    'border',
    'outline',
    'icon',
    'text',
    'underline',
    'shadow',
    'inner-shadow',
    'filters',
    'interaction',
    'selection-colours',
    'code',
  ],
  text: [
    'selection',
    'layout',
    'spacing',
    'blending',
    'fill',
    'text',
    'underline',
    'stroke',
    'shadow',
    'filters',
    'interaction',
    'code',
  ],
  page: ['page', 'claude'],
} as const;
export type PropertyKind = keyof typeof PROPERTY_SECTIONS;
export type PropertySectionId =
  (typeof PROPERTY_SECTIONS)[PropertyKind][number];

/** What the panel is showing: the pick, or with nothing picked the page's body. */
export type PropertyPick = {
  kind: PropertyKind;
  frame: string;
  /** The element's id in the frame; null for the page. */
  id: number | null;
  classes: readonly string[];
  /** Its computed styles, and its parent's. */
  own: Readonly<Record<string, string>>;
  parent: Readonly<Record<string, string>>;
  /** The colour behind it, from its nearest ancestor with one; null when it can't be told. */
  backdrop: string | null;
  /** It holds only text, or its classes set type or a text colour. */
  setsText: boolean;
  /** Its measured box, in CSS pixels. */
  width: number;
  height: number;
  /** Its tag: an icon's and an image's sections follow it. */
  tag: string;
  /** An `<img>`'s image, to show it. */
  src: string | null;
};

export type PropertySection<M extends ModuleSpec> = {
  id: PropertySectionId;
  title: string;
  /** False leaves it out, for a section that only shows when set (Flex). */
  applies?: (pick: PropertyPick) => boolean;
  /** True draws the title alone, on one greyed line. */
  empty?: (pick: PropertyPick) => boolean;
  /** Starts closed, and remembers what the designer chose (Code). */
  closed?: boolean;
  Body: (props: PanelProps<M> & { pick: PropertyPick }) => ReactNode;
  /** An empty section's `+`. Without it, the `+` stays disabled. */
  Add?: (props: PanelProps<M> & { pick: PropertyPick }) => ReactNode;
  /** Its `Add` stays beside the title once it's set: another filter can go on. */
  addWhenSet?: boolean;
};

/** A section with the props of the module that added it. */
export type BoundPropertySection = {
  section: PropertySection<ModuleSpec>;
  props: PanelProps<ModuleSpec>;
};

/** The sections that go with a kind of pick, in the set order. */
export function propertySectionsFor<S extends { id: PropertySectionId }>(
  kind: PropertyKind,
  sections: readonly S[],
): S[] {
  const order: readonly PropertySectionId[] = PROPERTY_SECTIONS[kind];
  return order.flatMap((id) => sections.filter((entry) => entry.id === id));
}

type DocksOf<M extends ModuleSpec> = M extends {
  panel: { docks: readonly (infer D)[] };
}
  ? Extract<D, Dock>
  : never;

/** One section's component; it gets the same props in either dock. */
export type PanelComponent<M extends ModuleSpec> = (
  props: PanelProps<M>,
) => ReactNode;

/** Runs one of the module's actions, in the shell, with the panel's props. */
/**
 * Something a panel draws over the canvas (TRU-5.2), in screen pixels. `place`
 * turns a point in a frame's own pixels into where to put it; it pans with the
 * canvas by itself, and null means that frame isn't on the canvas.
 */
export type CanvasComponent<M extends ModuleSpec> = (
  props: PanelProps<M> & {
    place: (
      frame: string,
      point: { x: number; y: number },
    ) => { left: number; top: number } | null;
  },
) => ReactNode;

export type ActionHandler<M extends ModuleSpec> = {
  run: (props: PanelProps<M>) => void | Promise<void>;
  /**
   * Whether it applies now (there is a pick, the pick has a call site).
   * Leave it out when it always does. A key bound to it does nothing while
   * it's false, so Tab still moves focus. A promise is shown disabled in the
   * menu until it settles; return the same promise for the same reports.
   */
  enabled?: (props: PanelProps<M>) => boolean | Promise<boolean>;
};

export type Actions<M extends ModuleSpec> = Section<M, 'actions'>;

/** A handler for every action `module.ts` declares. */
export type ActionHandlers<M extends ModuleSpec> = {
  [K in Name<Actions<M>>]: ActionHandler<M>;
};

// ---------------------------------------------------------------------------
// The context menu: what a panel adds besides its actions (TRU-2.4). It is data;
// the shell draws it, places it and handles its keys.

/** The menu being shown: one per opening. */
export type MenuTarget = {
  /** A new one per opening, so a panel can keep one answer per menu. */
  id: number;
  frame: string;
  /** The right-click in the frame's own pixels; null when a tree row opened it. */
  point: { x: number; y: number } | null;
};

/** The menu's first row: what the pick is. */
export type MenuHeader = {
  /** `Button · <button>`. */
  title: string;
  /** `file:line`, or why there is none, in the inspector's words. */
  place: string;
  /** What the place is, for its button: `call site` reads "Open call site src/a.tsx:12 in your editor". */
  what?: string;
  /** Opens the place in the editor; absent when there is none. */
  open?: () => void | Promise<void>;
};

/** One row of a list. */
export type MenuItem = {
  id: number;
  label: string;
  /** Quieter text after the label (the component it is in). */
  detail?: string;
  /** Marks the pick among the items. */
  current?: boolean;
};

/** A row that opens a list beside the menu, at the end of its group. */
export type MenuList<M extends ModuleSpec> = {
  title: string;
  /** The group it sits in, as an action's `menu` names one. */
  group: string;
  /** Null leaves the row out; an empty list shows it disabled. Return the same promise for the same target. */
  items: (
    props: PanelProps<M>,
    target: MenuTarget,
  ) => readonly MenuItem[] | null | Promise<readonly MenuItem[] | null>;
  /** The item under the pointer or the focus, or null once there is none. */
  highlight?: (
    props: PanelProps<M>,
    target: MenuTarget,
    item: MenuItem | null,
  ) => void;
  /** An item chosen; the menu closes. */
  choose: (
    props: PanelProps<M>,
    target: MenuTarget,
    item: MenuItem,
  ) => void | Promise<void>;
};

export type MenuDefinition<M extends ModuleSpec> = {
  /** Return the same promise for the same target. */
  header?: (
    props: PanelProps<M>,
    target: MenuTarget,
  ) => MenuHeader | null | Promise<MenuHeader | null>;
  lists?: readonly MenuList<M>[];
};

/** The third argument of definePanel: required when the module declares actions. */
type ActionsArg<M extends ModuleSpec> = [Name<Actions<M>>] extends [never]
  ? [
      {
        menu?: NoInfer<MenuDefinition<M>>;
        properties?: NoInfer<readonly PropertySection<M>[]>;
        foot?: NoInfer<PanelComponent<M>>;
        canvas?: NoInfer<CanvasComponent<M>>;
      }?,
    ]
  : [
      {
        actions: NoInfer<ActionHandlers<M>>;
        menu?: NoInfer<MenuDefinition<M>>;
        properties?: NoInfer<readonly PropertySection<M>[]>;
        foot?: NoInfer<PanelComponent<M>>;
        canvas?: NoInfer<CanvasComponent<M>>;
      },
    ];

export type PanelDefinition<M extends ModuleSpec = ModuleSpec> = {
  part: 'panel';
  module: M;
  /** A component for each dock the module declares. */
  sections: Partial<Record<Dock, PanelComponent<M>>>;
  /** A handler for each action the module declares. */
  actions: Partial<Record<string, ActionHandler<M>>>;
  /** What the panel adds to the context menu besides its actions. */
  menu: MenuDefinition<M>;
  /** What it adds to the properties panel (TRU-3.8). */
  properties: readonly PropertySection<M>[];
  /** Pinned under the Changes summary while the module's view shows (TRU-5.2). */
  foot: PanelComponent<M> | null;
  /** Drawn over the canvas, moving with it (TRU-5.2). */
  canvas: CanvasComponent<M> | null;
};

/**
 * A section for each dock `module.ts` names: `{ left: Layers, right: Inspector }`,
 * a handler for each action it declares: `{ actions: { 'copy-path': … } }`,
 * what it adds to the context menu: `{ menu: { header, lists } }`, to the
 * properties panel: `{ properties: [{ id, title, Body }] }`, under its view:
 * `{ foot }`, and over the canvas: `{ canvas }`.
 */
export function definePanel<M extends ModuleSpec>(
  module: M,
  sections: NoInfer<{ [D in DocksOf<M>]: PanelComponent<M> }>,
  ...rest: ActionsArg<M>
): PanelDefinition<M> {
  const options: {
    actions?: Partial<Record<string, ActionHandler<M>>>;
    menu?: MenuDefinition<M>;
    properties?: readonly PropertySection<M>[];
    foot?: PanelComponent<M>;
    canvas?: CanvasComponent<M>;
  } = rest[0] ?? {};
  return {
    part: 'panel',
    module,
    sections,
    actions: options.actions ?? {},
    menu: options.menu ?? {},
    properties: options.properties ?? [],
    foot: options.foot ?? null,
    canvas: options.canvas ?? null,
  };
}

// ---------------------------------------------------------------------------
// The server part: runs in Truing's Node process.

/**
 * A change as a module describes it. Truing decides the route: an
 * `edit` goes through the engine's checks, an `op` is direct, and `null`
 * goes to Claude with `reason`. `claude: true` is "Let Claude do this".
 */
export type StageInput<M extends ModuleSpec> = {
  label: string;
  intent: string;
  viewport: StagedChange['viewport'];
  scope?: Scope;
  /** One use (the default), or the component; a `cva` edit is always the component. */
  reach?: Reach;
  element?: ChangeElement | null;
  property: string;
  before?: ChangeValue[];
  after?: ChangeValue[];
  write:
    | { by: 'edit'; edit: Edit }
    | {
        [K in Name<Direct<M>>]: {
          by: 'op';
          op: K;
          input: Arg<Direct<M>[K]>;
        };
      }[Name<Direct<M>>]
    | null;
  /**
   * Why it needs Claude ("layout change at Phone size needs restructuring"):
   * required when `write` is null. With an `edit`, it goes to Claude anyway, and
   * the edit stays for the preview and for TRU-12.2 to read.
   */
  reason?: string;
  claude?: boolean;
};

/** What one Apply did, change by change. */
export type ApplyOutcome = { id: string; result: ApplyResult };

/** A change still being made (a drag, the arrow keys): previewed, not staged. */
export type DraftChange = {
  element: Pick<ChangeElement, 'href' | 'selector' | 'classes'>;
  add: readonly string[];
  remove: readonly string[];
};

export type ChangesControl = {
  list: () => readonly StagedChange[];
  /** Called with the whole list after every change to it, or to the draft. */
  onChange: (callback: (changes: readonly StagedChange[]) => void) => void;
  /** Shows a change still being made, in place of the last; null clears it. */
  preview: (draft: DraftChange | null) => void;
  draft: () => DraftChange | null;
  /** Undoes one staged change. */
  remove: (id: string) => void;
  /** Drops every staged change. */
  discard: () => void;
  /** "Let Claude do this", or back to the direct path when there is one. */
  setClaude: (id: string, claude: boolean) => Promise<StagedChange>;
  /**
   * Writes every direct change, all or none; the Claude ones stay staged
   * until TRU-12.2 sends them.
   */
  apply: () => Promise<ApplyOutcome[]>;
};

export type ServerContext<M extends ModuleSpec> = {
  /** The project's root folder. */
  root: string;
  config: TruingConfig;
  log: (line: string) => void;
  /** The frames this module's probe runs in now. */
  frames: () => string[];
  /** The latest report of a name, by frame id. */
  reports: <K extends Name<Reports<M>>>(
    name: K,
  ) => Readonly<Record<string, z.infer<Reports<M>[K]>>>;
  /** Asks one frame's probe; rejects if the frame is gone or doesn't answer. */
  command: <K extends Name<Commands<M>>>(
    frame: string,
    name: K,
    input: Arg<Commands<M>[K]>,
  ) => Promise<Out<Commands<M>[K]>>;
  /** Puts a change in the Changes tray, routed Direct or Claude. */
  stage: (change: StageInput<M>) => Promise<StagedChange>;
  /** The Changes tray (TRU-4.1): its list, and the calls the `changes` module's panel makes. */
  changes: ChangesControl;
  /** Tells the panel something: it reads the latest as `props.state[name]` (TRU-5.2). */
  publish: <K extends Name<ServerState<M>>>(
    name: K,
    value: z.input<ServerState<M>[K]>,
  ) => void;
  /**
   * Runs one job that writes source, after the ones before it: Apply and a
   * Claude run never touch the same files at once (TRU-5.2).
   */
  exclusive: <T>(job: () => Promise<T>) => Promise<T>;
  /** Truing's browser, for what shows on the canvas (TRU-5.2). */
  screenshot: ScreenshotControl;
};

/**
 * A picture of what's on the canvas, cropped to what's in view: the page never
 * scrolls for it, and Truing's own marks stay out.
 */
export type ScreenshotControl = {
  /** One element, as PNG; null if it's gone or out of view. */
  element: (frame: string, selector: string) => Promise<Buffer | null>;
  /** A whole frame, as JPEG; null if it's out of view. */
  frame: (frame: string) => Promise<Buffer | null>;
};

export type ServerHandlers<M extends ModuleSpec> = HandlersFor<
  'ops',
  Ops<M>,
  {
    [K in Name<Ops<M>>]: (input: In<Ops<M>[K]>) => Answer<Reply<Ops<M>[K]>>;
  }
> &
  HandlersFor<
    'direct',
    Direct<M>,
    {
      [K in Name<Direct<M>>]: (input: In<Direct<M>[K]>) => Answer<ApplyResult>;
    }
  > &
  HandlersFor<
    'tools',
    Tools<M>,
    {
      /** The answer goes to Claude as JSON; a thrown Error's message is the error it reads. */
      [K in Name<Tools<M>>]: (input: In<Tools<M>[K]>) => Answer<unknown>;
    }
  > & {
    onReport?: <K extends Name<Reports<M>>>(
      name: K,
      payload: z.infer<Reports<M>[K]>,
      frame: string,
    ) => void;
    /** Truing is closing: stop what the part started (a process, a server). */
    onClose?: () => void | Promise<void>;
  };

export type ServerDefinition<M extends ModuleSpec = ModuleSpec> = {
  part: 'server';
  module: M;
  setup: (context: ServerContext<M>) => Answer<ServerHandlers<M>>;
};

export function defineServer<M extends ModuleSpec>(
  module: M,
  setup: (context: ServerContext<M>) => Answer<ServerHandlers<M>>,
): ServerDefinition<M> {
  return { part: 'server', module, setup };
}

/** An error's message for a person or for Claude; never a stack trace. */
export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
