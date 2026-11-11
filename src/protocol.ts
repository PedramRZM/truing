// zod/mini, not zod: this module is bundled into the runtime, an init script
// that runs in every frame, and zod's full build is half a megabyte.
import * as z from 'zod/mini';

import { changeSchemas } from './module';

/**
 * Messages on Truing's one bus. The shell and every frame's runtime
 * connect to Truing server's WebSocket; the server relays between them.
 * Every message is parsed on arrival, on both ends.
 */

export const MODES = { select: 'select', interact: 'interact' } as const;
export type Mode = (typeof MODES)[keyof typeof MODES];
const modeSchema = z.enum([MODES.select, MODES.interact]);

/**
 * How the shell shows the frames, which the probes draw for (TRU-2.5): the
 * canvas's zoom, so labels stay at screen size, and the Spacing and Outlines
 * toggles.
 */
export const viewSchema = z.object({
  /** The camera's scale: a frame's CSS pixel is this many screen pixels. */
  scale: z.number(),
  /** Spacing is on: hovering shows the box model and distances without Alt. */
  spacing: z.boolean(),
  /** #80: Outlines is on: the hover, the pick, its parent and instances show their outlines and labels. */
  outlines: z.boolean(),
});
export type View = z.infer<typeof viewSchema>;
// #80: the outlines start hidden, so they don't cover the page while it is edited.
export const DEFAULT_VIEW: View = { scale: 1, spacing: false, outlines: false };

/** What the init script compiles into the runtime's closure, per session. */
export type Session = {
  token: string;
  wsUrl: string;
  appOrigin: string;
  shellOrigin: string;
};

/** The iframe `name` the shell gives each frame; the runtime reads it as `window.name`. */
export const FRAME_NAME_PREFIX = 'truing-frame:';

/** A page's route on the app (path, query and hash), or null when it is on another site. */
export function routeOf(href: string, appOrigin: string): string | null {
  try {
    const url = new URL(href);
    if (url.origin !== appOrigin) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export const CANVAS_SHORTCUTS = [
  'zoom-in',
  'zoom-out',
  'zoom-reset',
  'fit',
  'hand-tool',
  'spacing',
  'outlines',
  'collapse-panels',
  'hide-ui',
  'tab-design',
  'tab-theme',
  'view-claude',
  // Not a key of its own: a frame's Esc that nothing in the frame used.
  'leave-fill',
] as const;
export type CanvasShortcut = (typeof CANVAS_SHORTCUTS)[number];

export function isCanvasShortcut(id: string): id is CanvasShortcut {
  return (CANVAS_SHORTCUTS as readonly string[]).includes(id);
}

/** A canvas shortcut pressed with focus inside a frame; the runtime hands it to the shell. */
const shortcutMessage = z.object({
  type: z.literal('shortcut'),
  action: z.enum(CANVAS_SHORTCUTS),
});

/** Ctrl or ⌘ and the wheel (or a pinch) over a frame, at a point in the frame's own pixels. */
const wheelZoomMessage = z.object({
  type: z.literal('wheel-zoom'),
  frame: z.string().check(z.minLength(1)),
  deltaY: z.number(),
  x: z.number(),
  y: z.number(),
});

/** A right-click over a frame in Select mode, at a point in the frame's own pixels: the shell opens its menu there. */
const contextMenuMessage = z.object({
  type: z.literal('context-menu'),
  frame: z.string().check(z.minLength(1)),
  x: z.number(),
  y: z.number(),
  /** TRU-14.2: the link under the pointer, when there is one. */
  link: z.optional(z.string()),
});

/** Space held or released inside a frame in Select mode: the canvas pans while it is held. */
const panKeyMessage = z.object({
  type: z.literal('pan-key'),
  down: z.boolean(),
});

/** A middle-button drag that started over a frame: the movement, in screen pixels. */
const panDragMessage = z.object({
  type: z.literal('pan-drag'),
  dx: z.number(),
  dy: z.number(),
});

// Module traffic (TRU-1.6). Payloads are checked against the module's own
// schemas by Truing server, which knows them; the bus only carries them.
const id = z.string().check(z.minLength(1));

/** A probe's report, from a frame; the server stamps the frame. */
const moduleReport = z.object({
  type: z.literal('module-report'),
  module: id,
  name: id,
  payload: z.unknown(),
});

/** The answer to a probe command or a server op. `error` is set when it failed. */
const moduleResult = z.object({
  type: z.literal('module-result'),
  id: z.number(),
  value: z.unknown(),
  error: z.optional(z.string()),
});

export const runtimeMessageSchema = z.discriminatedUnion('type', [
  /** TRU-14.2: a link Cmd/Ctrl-clicked in Select mode, to open in a frame of its own. */
  z.object({
    type: z.literal('open-in-frame'),
    frame: z.string().check(z.minLength(1)),
    href: z.string(),
  }),
  z.object({
    type: z.literal('hello'),
    frame: z.string().check(z.minLength(1)),
    href: z.string(),
    title: z.string(),
    runtime: z.string(),
    /** The modules whose probe runs in this frame. */
    probes: z.array(z.string()),
  }),
  z.object({ type: z.literal('pong'), id: z.number() }),
  z.object({
    type: z.literal('location'),
    frame: z.string().check(z.minLength(1)),
    href: z.string(),
    title: z.string(),
  }),
  z.object({ type: z.literal('mode-request'), mode: modeSchema }),
  /** The designer clicked or typed in this frame: it leads navigation. */
  z.object({
    type: z.literal('interaction'),
    frame: z.string().check(z.minLength(1)),
  }),
  shortcutMessage,
  wheelZoomMessage,
  contextMenuMessage,
  panKeyMessage,
  panDragMessage,
  moduleReport,
  moduleResult,
  /** A probe threw: it is stopped in this frame. */
  z.object({
    type: z.literal('module-failed'),
    module: id,
    message: z.string(),
  }),
]);
export type RuntimeMessage = z.infer<typeof runtimeMessageSchema>;

/** A frame's device, as the shell's `Viewport` (src/shell/viewports.ts). */
const viewportSchema = z.union([
  z.object({
    kind: z.literal('preset'),
    preset: z.enum(['phone', 'tablet', 'desktop']),
  }),
  z.object({
    kind: z.literal('custom'),
    width: z.number(),
    height: z.number(),
  }),
  z.object({ kind: z.literal('fill') }),
]);

const sizeSchema = z.object({ width: z.number(), height: z.number() });

/** TRU-14.1 measured 12 frames of a heavy page at about 620 MB: the default cap. */
export const FRAME_CAP = 12;

/**
 * A path on the app. Never `//host` or `@host`: a frame's address is the app's
 * origin and this, so anything else could load another site in the frame.
 */
const routeSchema = z.string().check(z.regex(/^\/(?!\/)/));

/**
 * TRU-14.2: the board as it is saved per project, outside the repository, and
 * handed back when Truing starts again: the layout's own view, and each record
 * frame as the person or Claude set it (not what it reports while running).
 */
export const boardSchema = z.object({
  version: z.literal(1),
  layout: z.enum(['single', 'side-by-side']),
  viewport: viewportSchema,
  route: routeSchema,
  frames: z
    .array(
      z.object({
        id: z.string().check(z.minLength(1)),
        route: routeSchema,
        viewport: z.optional(viewportSchema),
        alone: z.optional(viewportSchema),
        group: z.optional(z.string()),
        name: z.optional(z.string()),
        by: z.optional(z.enum(['person', 'claude'])),
        size: z.optional(sizeSchema),
        offset: z.optional(z.object({ x: z.number(), y: z.number() })),
      }),
    )
    .check(z.maxLength(FRAME_CAP)),
});
export type Board = z.infer<typeof boardSchema>;
export type BoardViewport = z.infer<typeof viewportSchema>;

export const shellMessageSchema = z.discriminatedUnion('type', [
  /** The board changed: the server saves it for the next start (TRU-14.2). */
  z.object({ type: z.literal('save-board'), board: boardSchema }),
  z.object({ type: z.literal('hello') }),
  z.object({ type: z.literal('set-mode'), mode: modeSchema }),
  /** The zoom or the Spacing toggle changed: every frame gets it. */
  z.object({ type: z.literal('set-view'), view: viewSchema }),
  z.object({ type: z.literal('reload'), frames: z.array(z.string()) }),
  /** Esc in Select mode, caught by the shell: every frame's probes get it. */
  z.object({ type: z.literal('escape') }),
  /** A panel calls one of its module's server ops. */
  z.object({
    type: z.literal('module-call'),
    id: z.number(),
    module: id,
    op: id,
    input: z.unknown(),
  }),
  /** A panel asks one frame's probe. */
  z.object({
    type: z.literal('module-command'),
    id: z.number(),
    module: id,
    frame: id,
    name: id,
    input: z.unknown(),
  }),
]);
export type ShellMessage = z.infer<typeof shellMessageSchema>;

export const toRuntimeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    mode: modeSchema,
    view: viewSchema,
  }),
  z.object({ type: z.literal('ping'), id: z.number() }),
  z.object({ type: z.literal('mode'), mode: modeSchema }),
  z.object({ type: z.literal('view'), view: viewSchema }),
  z.object({ type: z.literal('reload') }),
  z.object({ type: z.literal('escape') }),
  z.object({
    type: z.literal('module-command'),
    id: z.number(),
    module: id,
    name: id,
    input: z.unknown(),
  }),
]);
export type ToRuntime = z.infer<typeof toRuntimeSchema>;

export const MODULE_PARTS = ['probe', 'panel', 'server'] as const;
export type ModulePart = (typeof MODULE_PARTS)[number];

const reportEntry = z.object({
  module: z.string(),
  frame: z.string(),
  name: z.string(),
  payload: z.unknown(),
});
export type ReportEntry = z.infer<typeof reportEntry>;

/** What a module's server part last told its panel (TRU-5.2). */
const stateEntry = z.object({
  module: z.string(),
  name: z.string(),
  value: z.unknown(),
});
export type StateEntry = z.infer<typeof stateEntry>;

/** A module that stopped: in one frame (its probe) or on the server. */
const moduleFailure = z.object({
  module: z.string(),
  part: z.enum(MODULE_PARTS),
  frame: z.nullable(z.string()),
  message: z.string(),
});
export type ModuleFailure = z.infer<typeof moduleFailure>;

// Built only where it is read (the shell, the tests): the runtime in every
// frame never parses a message to the shell, and /* @__PURE__ */ lets the
// bundler leave it, and the change set it carries, out of the runtime.
export const toShellSchema = /* @__PURE__ */ (() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('welcome'),
      mode: modeSchema,
      appOrigin: z.string(),
      /** The config's `name`, shown at the top of the left panel. */
      projectName: z.string(),
      hasTokens: z.boolean(),
      startRoute: z.string(),
      /** The board saved last time, or null for a first start (TRU-14.2). */
      board: z.nullable(boardSchema),
      frames: z.array(
        z.object({
          frame: z.string(),
          href: z.string(),
          title: z.string(),
        }),
      ),
      modules: z.object({
        reports: z.array(reportEntry),
        failures: z.array(moduleFailure),
        changes: z.array(changeSchemas.stagedChange),
        state: z.array(stateEntry),
      }),
    }),
    z.object({ type: z.literal('mode'), mode: modeSchema }),
    z.object({
      type: z.literal('runtime-hello'),
      frame: z.string(),
      href: z.string(),
      title: z.string(),
    }),
    z.object({
      type: z.literal('runtime-ping'),
      frame: z.string(),
      ms: z.number(),
    }),
    z.object({
      type: z.literal('location'),
      frame: z.string(),
      href: z.string(),
      title: z.string(),
    }),
    z.object({ type: z.literal('runtime-gone'), frame: z.string() }),
    z.object({ type: z.literal('interaction'), frame: z.string() }),
    shortcutMessage,
    wheelZoomMessage,
    contextMenuMessage,
    panKeyMessage,
    panDragMessage,
    z.object({ type: z.literal('shell-reload') }),
    z.object({
      type: z.literal('module-frame-reset'),
      /** The frame reloaded or closed: what its probes reported is gone with it. */
      frame: z.string(),
    }),
    z.object({
      type: z.literal('module-report'),
      module: z.string(),
      frame: z.string(),
      name: z.string(),
      payload: z.unknown(),
    }),
    moduleResult,
    z.object({ type: z.literal('module-failed'), failure: moduleFailure }),
    z.object({
      type: z.literal('module-state'),
      module: z.string(),
      name: z.string(),
      value: z.unknown(),
    }),
    /** A short line for whoever is looking, from the server side (TRU-5.2). */
    z.object({ type: z.literal('notice'), text: z.string() }),
    /**
     * TRU-10.9: the page a frame was sent to on another site, shown in a window of
     * its own, came back to the app at `route`. That frame loads it; the others
     * reload where they are, as a sign-in changes them too.
     */
    z.object({
      type: z.literal('frame-back'),
      frame: z.string(),
      route: z.string(),
    }),
    /**
     * TRU-18.2: a change to the board from Truing's side (Claude's tools), shown on
     * the canvas as it happens. `open` names the frame, so the tool can wait for it.
     */
    z.object({
      type: z.literal('frame-op'),
      op: z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('open'),
          id: z.string().check(z.minLength(1)),
          route: routeSchema,
          viewport: z.optional(viewportSchema),
          name: z.optional(z.string()),
        }),
        z.object({
          kind: z.literal('navigate'),
          frame: z.string(),
          route: routeSchema,
        }),
        z.object({
          kind: z.literal('resize'),
          frame: z.string(),
          viewport: viewportSchema,
        }),
        z.object({
          kind: z.literal('move'),
          frame: z.string(),
          x: z.number(),
          y: z.number(),
        }),
        z.object({ kind: z.literal('close'), frame: z.string() }),
      ]),
    }),
    /** TRU-10.9: frames left blank while a window of another site was open, back where they were. */
    z.object({ type: z.literal('reload-frames'), frames: z.array(z.string()) }),
    /**
     * TRU-14.6, TRU-14.2: a page of the app to open as a frame of its own: a new
     * tab the app opened, or a link Cmd/Ctrl-clicked in a frame (`from`).
     */
    z.object({
      type: z.literal('open-frame'),
      route: z.string(),
      from: z.optional(z.string()),
    }),
    /** The whole change set, after any change to it. */
    z.object({
      type: z.literal('changes'),
      changes: z.array(changeSchemas.stagedChange),
    }),
  ]))();
export type ToShell = z.infer<typeof toShellSchema>;

/** Parses one WebSocket payload with a schema; `null` for anything else. */
export function parseMessage<T>(
  schema: z.ZodMiniType<T>,
  raw: unknown,
): T | null {
  if (typeof raw !== 'string') {
    return null;
  }

  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
