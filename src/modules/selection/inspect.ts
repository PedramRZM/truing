// What a picked element is, in the project's terms: the rule that picks the
// primitive's JSX and the feature's call site out of the owner chain (TRU-1.1),
// why one is absent, and the element's classes as tokens. Runs in the
// truing's Node process; everything it needs comes in as arguments.
import { existsSync } from 'node:fs';
import path from 'node:path';

import postcss from 'postcss';

import type { ClassLookup, Token } from '../../tokens/table';

import type {
  AbsentReason,
  Inspection,
  Link,
  Location,
  Selection,
  Style,
} from './module';

export type Paths = {
  /** The project's root, absolute. */
  root: string;
  /** Next's app folder, absolute: Next names files relative to it. */
  appDir: string;
  /** The primitives folder, relative to the root, with a trailing slash. */
  primitives: string;
};

/**
 * A file as Next names it, made relative to the project root: Turbopack's
 * `[project]/…` and `file://` URLs, webpack's `webpack-internal:///(layer)/./…`
 * and its `(layer)/` prefixes, absolute paths, and paths relative to the app.
 */
export function projectPath(file: string, paths: Paths): string {
  let name = file.startsWith('file://') ? file.slice(7) : file;
  // Turbopack's maps percent-encode route groups: (main) is %28main%29.
  try {
    name = decodeURIComponent(name);
  } catch {
    // Not encoded after all; keep it as it is.
  }
  name = name
    .replace(/^webpack-internal:\/\/\/?/, '')
    .replace(/^\([^)]+\)\//, '')
    .replace(/^\[project\]\//, '');
  const absolute = path.isAbsolute(name) ? name : fromApp(name, paths.appDir);
  return path.relative(paths.root, absolute).split(path.sep).join('/');
}

/**
 * Next names a file from its app folder, and Turbopack in a monorepo from the
 * workspace root above it. Then the path leads with the end of the app's own
 * path (`apps/web/app/page.tsx`). Only the disk tells that from a folder that's
 * merely named the same, so a path that exists as given wins.
 */
function fromApp(name: string, appDir: string): string {
  const direct = path.resolve(appDir, name);
  if (existsSync(direct)) return direct;
  const parts = name.split('/');
  for (let lead = parts.length - 1; lead > 0; lead--) {
    if (appDir.endsWith(path.sep + parts.slice(0, lead).join(path.sep))) {
      return path.resolve(appDir, parts.slice(lead).join('/'));
    }
  }
  return direct;
}

/** A frame Next mapped, as a place in the project; null in a package or in Next. */
export function inProject(
  at: NonNullable<Link['at']>,
  paths: Paths,
): Location | null {
  if (at.ignored) return null;
  const file = projectPath(at.file, paths);
  if (file.startsWith('..') || file.split('/').includes('node_modules')) {
    return null;
  }
  return { file, line: at.line, column: at.column };
}

/** A link's place in the project, or null for one in a package or in Next. */
type Placed = { link: Link; index: number; at: Location };

function placed(chain: readonly Link[], paths: Paths): Placed[] {
  return chain.flatMap((link, index): Placed[] => {
    const at = link.at ? inProject(link.at, paths) : null;
    return at ? [{ link, index, at }] : [];
  });
}

/** Next's route files: JSX written there has no call site but Next's own. */
const ROUTE_FILE =
  /(^|\/)app\/(.*\/)?(page|layout|template|default|loading|error|not-found|global-error)\.[jt]sx?$/;

export function isRouteFile(file: string): boolean {
  return ROUTE_FILE.test(file);
}

type Place = Inspection['definition'];

const found = (at: Location): Place => ({ status: 'found', at });
const absent = (reason: AbsentReason): Place => ({ status: 'absent', reason });

/** Why the element's own JSX has no project location. */
function elementAbsence(first: Link | undefined): AbsentReason {
  if (!first) return 'not-react';
  if (first.capped) return 'cap';
  if (first.unmapped) return 'unmapped';
  return 'library';
}

/** The composite right above a link: the component whose render wrote that JSX. */
function ownerOf(
  chain: readonly Link[],
  index: number | undefined,
): Link | null {
  if (index === undefined) return null;
  const owner = chain[index + 1];
  return owner && owner.kind !== 'host' ? owner : null;
}

/**
 * The tag as written at a JSX location (`<SheetContent`), which names the
 * component the way the designer sees it in the code. React's display name
 * can differ: shadcn copies Radix's onto its wrappers (`DialogContent`).
 */
export function tagAt(
  source: string,
  line: number,
  column: number,
): string | null {
  const text = source.split('\n')[line - 1];
  if (text === undefined) return null;
  const match = /^<([A-Za-z_$][\w$.]*)/.exec(text.slice(column - 1));
  return match?.[1] ?? null;
}

export type Rule = {
  /** The JSX that draws the element: in the primitives folder if a primitive does. */
  definition: Place;
  /** Where the component is used, outside the primitives folder. */
  callSite: Place;
  /** The link whose JSX is the call site: what it created is the component. */
  component: Link | null;
  /**
   * The component whose JSX is the definition (`Button` around its `<Comp>`):
   * its props carry the variant, even when another component wraps it.
   */
  primitive: Link | null;
  /** The project's owners above the call site, nearest first. */
  owners: Inspection['owners'];
};

/**
 * TRU-1.1's rule. Drop the links in packages and in Next. The definition is the
 * first link in the primitives folder, else the element's own JSX if it is in
 * the project. The call site is the next link outside the primitives folder.
 */
export function applyRule(
  selection: Pick<Selection, 'chain' | 'react'>,
  paths: Paths,
): Rule {
  const { chain } = selection;
  const project = placed(chain, paths);
  const inPrimitives = (entry: Placed): boolean =>
    entry.at.file.startsWith(paths.primitives);

  const firstPrimitive = project.find(inPrimitives);
  const elementOwn = project[0]?.index === 0 ? project[0] : undefined;
  const definition = firstPrimitive ?? elementOwn;
  const after = definition
    ? project.filter((entry) => entry.index > definition.index)
    : project;
  const callSite = after.find((entry) => !inPrimitives(entry));

  const owners = callSite
    ? project
        .filter((entry) => entry.index > callSite.index)
        .map((entry) => ({
          name: entry.link.name,
          kind: entry.link.kind,
          at: entry.at,
        }))
    : [];

  if (!selection.react) {
    return {
      definition: absent('not-react'),
      callSite: absent('not-react'),
      component: null,
      primitive: null,
      owners,
    };
  }

  const definitionPlace = definition
    ? found(definition.at)
    : absent(elementAbsence(chain[0]));

  let callSitePlace: Place;
  if (callSite) {
    callSitePlace = found(callSite.at);
  } else {
    const last = definition ?? project.at(-1);
    if (last && isRouteFile(last.at.file)) callSitePlace = absent('route');
    else if (chain[0]?.capped) callSitePlace = absent('cap');
    else if (project.length === 0) callSitePlace = absent('library');
    else callSitePlace = absent('unmapped');
  }

  return {
    definition: definitionPlace,
    callSite: callSitePlace,
    component: callSite?.link.kind === 'host' ? null : (callSite?.link ?? null),
    primitive: ownerOf(chain, definition?.index),
    owners,
  };
}

/** The CSS properties a class sets, without Tailwind's own `--tw-*` variables. */
export function propertiesOf(css: string | null): string[] {
  if (!css) return [];
  const properties = new Set<string>();
  postcss.parse(css).walkDecls((decl) => {
    // `@property` describes Tailwind's own variable; it sets nothing on the element.
    const parent = decl.parent;
    if (
      parent?.type === 'atrule' &&
      'name' in parent &&
      parent.name === 'property'
    ) {
      return;
    }
    if (!decl.prop.startsWith('--')) properties.add(decl.prop);
  });
  return [...properties];
}

function display(value: Token['light']): string {
  if (value.hex) return value.hex;
  if (value.px !== undefined && !/^-?\d*\.?\d+px$/.test(value.value)) {
    return `${value.value} (${value.px}px)`;
  }
  return value.value;
}

const bare = (key: string): string => key.replace(/^--/, '');

export type Classes = {
  lookup: (className: string) => ClassLookup;
  css: (className: string) => string | null;
};

/** Each class as the token it reads, the token's chain and its final value. */
export function stylesOf(classes: readonly string[], table: Classes): Style[] {
  return classes.map((className): Style => {
    const lookup = table.lookup(className);
    const properties = propertiesOf(table.css(className));
    if (lookup.status === 'unknown') {
      return { status: 'unknown', className, properties, variants: [] };
    }
    if (lookup.status === 'compiles') {
      return { status: 'value', className, properties, variants: [] };
    }
    const { token } = lookup;
    const light = display(token.light);
    const dark = display(token.dark);
    return {
      status: 'token',
      className,
      properties,
      variants: lookup.variants,
      token: bare(token.key),
      through: token.chain.light.map(bare),
      light,
      dark: dark === light ? null : dark,
    };
  });
}
