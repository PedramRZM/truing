import * as z from 'zod/mini';

import { defineModule } from '../../module';
import type { TokenRow } from '../../shell/controls/token-rows';

import type { StyleTokens } from './style-classes';

/**
 * Select and inspect (TRU-2.1). In Select mode the element under the pointer
 * is outlined with its tag and component, and a click picks it. The right
 * panel shows the picked element's component, variant, both source
 * locations and its styles as tokens; the left panel shows the page's
 * components and elements. Each frame has its own pick.
 */

/** Set only in the frame's bundle (build.ts), which drops the server's schemas. */
declare const __TRUING_RUNTIME__: boolean | undefined;

// Shared, as every byte of this file ships in each frame (bundles.test.ts).
const strings = z.array(z.string());
const css = z.record(z.string(), z.string());
const done = z.boolean();
const none = z.object({});
const byId = z.object({ id: z.number() });
/** Where Next says a frame's code is, still named as Next names it. */
const sourceFrame = z.object({
  file: z.string(),
  line: z.number(),
  column: z.number(),
  /** In Next's ignore list: inside node_modules or Next itself. */
  ignored: z.boolean(),
});

const propValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({ kind: z.string() }),
]);

const propsView = z.union([
  z.object({
    status: z.enum(['live', 'snapshot']),
    values: z.record(z.string(), propValue),
  }),
  z.object({ status: z.literal('none') }),
]);
export type PropsViewPayload = z.infer<typeof propsView>;

/** One step of the owner chain, from the element up. */
const link = z.object({
  name: z.string(),
  kind: z.enum(['host', 'client', 'server']),
  env: z.nullable(z.string()),
  /** Where its JSX was written; null if React kept no stack or Next couldn't map it. */
  at: z.nullable(sourceFrame),
  /** React kept a stack, but Next couldn't map it. */
  unmapped: z.boolean(),
  /** Past React's 10,000-element stack cap. */
  capped: z.boolean(),
  props: propsView,
});
export type Link = z.infer<typeof link>;

/** The same element across a hot reload, when React may have replaced the node. */
export const identity = z.object({
  tag: z.string(),
  owners: strings,
  index: z.number(),
});

const selection = z.object({
  /** The element's id in this frame's page, shared with the layers tree. */
  id: z.number(),
  /** The page it was picked on, without the hash. */
  href: z.string(),
  identity: z.nullable(identity),
  tag: z.string(),
  classes: strings,
  /** A CSS selector that finds only this element on the page now, for Copy selector. */
  selector: z.string(),
  /** False for an element React didn't render (a script's, or before hydration). */
  react: z.boolean(),
  /** Its text, when it holds only text: what the inspector's Text field edits (TRU-4.1). */
  text: z.nullable(z.string()),
  /** The frame's width when it was picked: the viewport a change is made in. */
  width: z.number(),
  chain: z.array(link),
});
export type Selection = z.infer<typeof selection>;

/** What the Design view needs that only the page knows, measured (TRU-3.6). */
const layerLook = z.object({
  /** Takes up room on the screen; left false on a plain wrapper, where it decides nothing. */
  drawn: z.boolean(),
  /** A background, border, padding, gap or shadow of its own. */
  box: z.boolean(),
  layout: z.optional(z.enum(['row', 'column', 'grid'])),
  /** The words it holds itself, shortened, with any inline children's. */
  text: z.optional(z.string()),
  /** Its image's alt or its accessible name, shortened. */
  label: z.optional(z.string()),
  role: z.optional(z.string()),
});
export type LayerLook = z.infer<typeof layerLook>;

/** A node of the layers tree: a component or an element. */
export type LayerNode = {
  id: number;
  name: string;
  kind: 'element' | 'client' | 'server';
  /** An element that holds only text: its text, shortened, which names its row. */
  text?: string;
  /** The row of the nearest project component whose JSX wrote this one. */
  owner?: number | undefined;
  /** An element's measured look; a component draws nothing itself. */
  look?: LayerLook | undefined;
  children: LayerNode[];
};
const layerNode: z.ZodMiniType<LayerNode> = z.object({
  id: z.number(),
  name: z.string(),
  kind: z.enum(['element', 'client', 'server']),
  text: z.optional(z.string()),
  owner: z.optional(z.number()),
  look: z.optional(layerLook),
  get children() {
    return z.array(layerNode);
  },
});

/** Why a location is absent, in words the inspector shows. */
export const ABSENT_REASONS = [
  // the element is drawn inside a package (a lucide icon, next/link's <a>)
  'library',
  // its JSX is written straight in a route file: Next renders it, no call site
  'route',
  // past React's 10,000-element stack cap on this page
  'cap',
  // React kept a stack, but Next's dev server couldn't map it
  'unmapped',
  // React didn't render this element
  'not-react',
] as const;
export type AbsentReason = (typeof ABSENT_REASONS)[number];

/** One instance of the pick's component on the page (TRU-2.2). */
const instance = z.object({
  /** Its outermost elements, by the page's ids. */
  elements: z.array(z.number()),
  /** The probe: the props asked for, as set. The server: each variant, the default filled in. */
  props: z.record(z.string(), z.nullable(z.string())),
  /** The pick is drawn by this one. */
  picked: z.boolean(),
});

/** The instances whose JSX was written at one place: a `.map()` draws many from one. */
const callSiteGroup = z.object({
  at: z.nullable(sourceFrame),
  instances: z.array(instance),
});

/**
 * What only Truing's process reads, made in one function the bundler may
 * drop: a top-level schema would ship in every frame anyway (bundles.test.ts).
 */
function serverSchemas() {
  const picked = z.object({ frame: z.string(), id: z.number() });

  const location = z.object({
    file: z.string(),
    line: z.number(),
    column: z.number(),
  });

  const place = z.union([
    z.object({ status: z.literal('found'), at: location }),
    z.object({ status: z.literal('absent'), reason: z.enum(ABSENT_REASONS) }),
  ]);

  const style = z.union([
    z.object({
      status: z.literal('token'),
      className: z.string(),
      /** CSS properties the class sets (`padding-inline`). */
      properties: strings,
      /** `hover`, `md`, as written. */
      variants: strings,
      /** `spacing-400`, without the leading dashes. */
      token: z.string(),
      /** The tokens and variables it resolves through, in order (`primary`, `brand-1-600`). */
      through: strings,
      /** The final value in light mode, and in dark if it differs. */
      light: z.string(),
      dark: z.nullable(z.string()),
    }),
    z.object({
      status: z.enum(['value', 'unknown']),
      className: z.string(),
      properties: strings,
      variants: strings,
    }),
  ]);

  const inspection = z.object({
    tag: z.string(),
    /** The component the designer wrote (`Button`), if one owns the element. */
    component: z.nullable(
      z.object({
        name: z.string(),
        kind: z.enum(['client', 'server']),
        /** The primitive its variants are of, when it isn't the component itself. */
        primitive: z.nullable(z.string()),
        variants: z.array(
          z.object({
            name: z.string(),
            value: z.string(),
            from: z.enum(['prop', 'default']),
            /** Every value its cva config declares, for the switch (TRU-4.1). */
            options: strings,
          }),
        ),
        props: propsView,
      }),
    ),
    /** Where the component is used: the feature's JSX. */
    callSite: place,
    /** The primitive's JSX that draws the element. */
    definition: place,
    /** The owners above the call site, nearest first. */
    owners: z.array(
      z.object({
        name: z.string(),
        kind: z.enum(['host', 'client', 'server']),
        at: z.nullable(location),
      }),
    ),
    styles: z.array(style),
  });

  /** Every instance of the pick's component on the page, by call site. */
  const instancesView = z.object({
    component: z.string(),
    /** The variants an instance can differ by: none when a wrapper sets them inside. */
    variants: strings,
    groups: z.array(
      z.object({
        /** Where the instances' JSX is, in the project; null in a package or unmapped. */
        at: z.nullable(location),
        instances: z.array(instance),
      }),
    ),
  });

  /** Every use of the pick's component in the code, from a static search (TRU-2.2). */
  const usagesView = z.object({
    component: z.string(),
    uses: z.array(
      z.object({
        file: z.string(),
        line: z.number(),
        column: z.number(),
        /** Each variant as written, the default when it isn't; null when code sets it. */
        variants: z.record(z.string(), z.nullable(z.string())),
        /** In a `.map()`: one use drawn once per item. */
        inList: z.boolean(),
      }),
    ),
  });

  /**
   * Which code an edit is for (TRU-2.2): this use of the component, or the
   * component itself, which changes every use.
   */
  const reach = z.enum(['use', 'component']);

  return {
    inspection,
    instancesView,
    location,
    picked,
    place,
    reach,
    style,
    usagesView,
  };
}

const schemas = /* @__PURE__ */ serverSchemas();

export type Location = z.infer<typeof schemas.location>;
export type Style = z.infer<typeof schemas.style>;
export type Inspection = z.infer<typeof schemas.inspection>;
export type InstancesView = z.infer<typeof schemas.instancesView>;
export type UsagesView = z.infer<typeof schemas.usagesView>;

export default defineModule({
  id: 'selection',
  title: 'Selection',
  probe: {
    serverOnly: ['hovered'],
    reports: {
      /** The element picked in the frame, or null once nothing is. */
      selected: z.nullable(selection),
      /** The element under the pointer in Select mode, once its chain is mapped. */
      hovered: z.object({
        id: z.number(),
        chain: z.array(link),
        /** Its classes, so the server can name its spacing tokens (TRU-2.5). */
        classes: strings,
      }),
      /** The pick's id while the pointer is on it, else null: what it reads may be its `:hover` state. */
      overPick: z.nullable(z.number()),
      /** Text the designer typed in place, after a double-click (TRU-4.1): the server stages it. */
      edited: z.object({
        id: z.number(),
        text: z.string(),
        /** What it said before, which a refresh while typing can't overwrite. */
        before: z.string(),
      }),
      /** The page's components and elements, after each change to it (throttled). */
      layers: z.object({ href: z.string(), nodes: z.array(layerNode) }),
      /** The elements hidden or locked in the frame (TRU-3.7). Stays in the frame: never staged. */
      marks: z.object({
        hidden: z.array(z.number()),
        locked: z.array(z.number()),
      }),
    },
    commands: {
      /** Picks an element by its id (from the layers tree); false if it is gone. */
      select: { input: byId, output: done },
      deselect: { input: none, output: done },
      /** Picks the element an identity names, after a reload; false if it is gone. */
      restore: { input: identity, output: done },
      /** The component the hover and pick labels name, as the server names it for the inspector. */
      label: {
        input: z.object({ id: z.number(), component: z.nullable(z.string()) }),
        output: done,
      },
      /**
       * An element's classes that read a spacing token, with the token in
       * pixels, so its spacing labels can name them (TRU-2.5).
       */
      spacing: {
        input: z.object({
          id: z.number(),
          classes: z.array(
            z.object({
              className: z.string(),
              root: z.string(),
              px: z.number(),
            }),
          ),
        }),
        output: done,
      },
      /**
       * The computed styles the panel names, for an element (or, with a null
       * id, the page's body) and its parent, with its measured box and
       * classes (TRU-3.8); null when it is gone.
       */
      computed: {
        input: z.object({
          id: z.nullable(z.number()),
          properties: strings,
        }),
        output: z.nullable(
          z.object({
            own: css,
            parent: css,
            backdrop: z.nullable(z.string()),
            width: z.number(),
            height: z.number(),
            classes: strings,
            /** An `<img>`'s image. */
            src: z.nullable(z.string()),
          }),
        ),
      },
      /** The elements like this one on the page (TRU-4.5); null when it is gone. */
      similar: { input: byId, output: z.nullable(z.array(selection)) },
      /** A row's owner chain, mapped, for its source on hover (TRU-3.6); null when it is gone. */
      chain: {
        input: byId,
        output: z.nullable(z.array(link)),
      },
      /** Hides or locks elements in this frame only, or undoes it (TRU-3.7). */
      mark: {
        input: z.object({
          kind: z.enum(['hidden', 'locked']),
          ids: z.array(z.number()),
          on: z.boolean(),
        }),
        output: done,
      },
      /** Shows and unlocks everything on the page (TRU-3.7). */
      'clear-marks': { input: none, output: done },
      /** Moves the pick to its first child, parent, or next or previous sibling; false if there is none. */
      navigate: {
        input: z.object({
          to: z.enum(['child', 'parent', 'next', 'previous']),
        }),
        output: done,
      },
      /**
       * Every instance on the page of the component at `link` in the
       * element's owner chain, by call site, with the props named; null
       * when the element is gone (TRU-2.2).
       */
      instances: {
        input: z.object({
          id: z.number(),
          link: z.number(),
          props: strings,
        }),
        output: z.nullable(z.array(callSiteGroup)),
      },
      /** Outlines these elements as instances; an empty list clears them. Answers how many are drawn. */
      outline: {
        input: z.object({ ids: z.array(z.number()) }),
        output: z.number(),
      },
      /** Outlines an element while the tree's row is hovered; null clears it. */
      highlight: {
        input: z.object({ id: z.nullable(z.number()) }),
        output: done,
      },
      /**
       * The picked element's id now, before its report arrives: the context
       * menu waits for that report rather than show the last pick's (TRU-2.4).
       */
      current: { input: none, output: z.nullable(z.number()) },
      /**
       * Every element drawn at a point in the frame, top first, for the
       * context menu's Select layer (TRU-2.4).
       */
      stackAt: {
        input: z.object({ x: z.number(), y: z.number() }),
        output: z.array(
          z.object({
            id: z.number(),
            tag: z.string(),
            /** An element that holds only text: its text, shortened. */
            text: z.nullable(z.string()),
          }),
        ),
      },
    },
  },
  // The tree on the left is the page's; the inspector on the right is the pick's.
  panel: { docks: ['left', 'right'], titles: { left: 'Page' } },
  // The pick's commands (TRU-2.3): keys, the ? sheet, and the context menu's groups (TRU-2.4).
  actions: {
    'open-call-site': {
      title: 'Open call site',
      keys: [{ key: 'o' }],
      menu: 'open',
    },
    'open-definition': {
      title: 'Open definition',
      keys: [{ key: 'o', shift: true }],
      menu: 'open',
    },
    'copy-path': { title: 'Copy path', keys: [{ key: 'c' }], menu: 'copy' },
    'copy-classes': { title: 'Copy classes', menu: 'copy' },
    'copy-selector': { title: 'Copy selector', menu: 'copy' },
    'select-child': {
      title: 'Select the first child',
      keys: [{ key: 'Enter' }],
    },
    'select-parent': {
      title: 'Select the parent',
      keys: [{ key: 'Enter', shift: true }],
      menu: 'select',
    },
    'select-next': {
      title: 'Select the next sibling',
      keys: [{ key: 'Tab', repeat: true }],
    },
    'select-previous': {
      title: 'Select the previous sibling',
      keys: [{ key: 'Tab', shift: true, repeat: true }],
    },
    'collapse-layers': {
      title: 'Collapse all layers',
      keys: [{ codes: ['KeyL'], alt: true, label: 'L' }],
    },
    'clear-marks': {
      title: 'Show and unlock all layers',
      keys: [{ codes: ['KeyL'], alt: true, shift: true, label: 'L' }],
      menu: 'layers',
    },
  },
  // Only Truing's own process reads these, so a frame's bundle leaves them out.
  server:
    typeof __TRUING_RUNTIME__ === 'undefined'
      ? {
          ops: {
            /** What the picked element in a frame is, in the project's terms. */
            inspect: {
              input: schemas.picked,
              output: z.nullable(schemas.inspection),
            },
            /** Classes read as tokens, for the Page section's background (TRU-3.8). */
            styles: {
              input: z.object({ classes: strings }),
              output: z.array(schemas.style),
            },
            /** Every instance of the pick's component on the page (TRU-2.2). */
            instances: {
              input: schemas.picked,
              output: z.nullable(schemas.instancesView),
            },
            /** Every use of the pick's component in the code (TRU-2.2). */
            usages: {
              input: schemas.picked,
              output: z.nullable(schemas.usagesView),
            },
            /**
             * What the frame's next edits are for: this use, or the component.
             * A new pick starts again at this use, so a shared change is always
             * chosen for the element it is made on.
             */
            reach: {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                reach: schemas.reach,
              }),
              output: z.object({ reach: schemas.reach }),
            },
            /** Where a row of the tree is in the code: its call site, else its definition (TRU-3.6). */
            source: {
              input: schemas.picked,
              output: z.nullable(schemas.location),
            },
            /** Opens a location in the developer's editor, through Next. */
            open: {
              input: schemas.location,
              output: z.object({ opened: z.boolean() }),
            },
            /** Stages a variant switch on the pick's component in the Changes tray (TRU-4.1). */
            'stage-variant': {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                name: z.string(),
                value: z.string(),
              }),
              /** Null when the value is the page's own: any staged switch is undone. */
              output: z.object({ id: z.nullable(z.string()) }),
            },
            /** Stages new text for the pick, an element that holds only text (TRU-4.1). */
            'stage-text': {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                text: z.string(),
              }),
              /** Null when the text is the page's own: any staged edit is undone. */
              output: z.object({ id: z.nullable(z.string()) }),
            },
            /** The project's spacing tokens, for the layout controls' menus and steps (TRU-4.2). */
            'layout-tokens': {
              input: none,
              output: z.object({ spacing: z.custom<TokenRow[]>() }),
            },
            'style-tokens': {
              input: none,
              output: z.custom<StyleTokens>(),
            },
            /** Shows a change still being made on the pick; nothing to add or remove clears it (TRU-4.2). */
            'preview-classes': {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                add: strings,
                remove: strings,
              }),
              output: done,
            },
            /** Shows another of a variant's values on the pick, while it's pointed at. */
            'preview-variant': {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                name: z.string(),
                value: z.string(),
              }),
              output: done,
            },
            /** What a change on the pick could also change: every element like it on the page (TRU-4.5). */
            similar: {
              input: schemas.picked,
              output: z.object({ ids: z.array(z.number()) }),
            },
            /** Shows the pick's staged changes on every element like it, while Change all is pointed at. */
            'preview-similar': {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                on: z.boolean(),
              }),
              output: done,
            },
            /**
             * Answers "change all like this" for the pick's staged changes: all
             * of them, or this one alone. Answers with the changes it settled.
             */
            'spread-similar': {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                to: z.enum(['all', 'only']),
              }),
              output: z.object({ settled: strings }),
            },
            /** Stages what only Claude can do on the pick: an image to find, a text stroke (TRU-4.5). */
            'stage-intent': {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                property: z.string(),
                label: z.string(),
                intent: z.string(),
                reason: z.string(),
                after: z.object({
                  value: z.string(),
                  token: z.nullable(z.string()),
                }),
              }),
              output: z.object({ id: z.string() }),
            },
            /** Stages a change to the pick's classes (TRU-4.2). */
            'stage-classes': {
              input: z.object({
                frame: z.string(),
                id: z.number(),
                property: z.string(),
                label: z.string(),
                intent: z.string(),
                add: strings,
                remove: strings,
                /** Other staged properties this one takes over: a text style's size and weight. */
                replaces: z.optional(strings),
                /** What takes a value away at a use, where its class is in the component: `shadow-none`. */
                clearWith: z.optional(z.string()),
                scope: z.union([
                  z.literal('all'),
                  z.object({ from: z.string() }),
                  z.object({ only: z.string() }),
                ]),
                before: z.object({
                  value: z.string(),
                  token: z.nullable(z.string()),
                }),
                after: z.object({
                  value: z.string(),
                  token: z.nullable(z.string()),
                }),
              }),
              /** Null when the value is the page's own: any staged change is undone. */
              output: z.object({ id: z.nullable(z.string()) }),
            },
          },
        }
      : (undefined as never),
});
