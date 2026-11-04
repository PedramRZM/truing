import {
  definePanel,
  type MenuHeader,
  type MenuItem,
  type MenuList,
  type MenuTarget,
  messageOf,
} from '../../module';

import { Inspector } from './design-panel';
import { DESIGN_SECTIONS } from './design-sections';
import { layerEvents, Layers } from './layers-panel';
import selection, { type Location, type Selection } from './module';
import {
  ABSENT,
  copy,
  frameToShow,
  GONE,
  inspectionOf,
  pathOf,
  pathTo,
  type Props,
  READ_FAILED,
} from './panel-shared';

// ---------------------------------------------------------------------------
// The pick's actions: keys, the ? sheet and the context menu (TRU-2.3).

/** The pick the actions work on: the one the panel shows. */
function pickOf(props: Props): { frame: string; picked: Selection } | null {
  const shown = frameToShow(props, props.reports.selected);
  return shown ? { frame: shown.id, picked: shown.value } : null;
}

type PlaceKind = 'callSite' | 'definition' | 'path';

// One answer per pick and question, so the menu reads the same promise
// while it waits (see ActionHandler.enabled).
const answers = new WeakMap<Selection, Map<string, Promise<unknown>>>();

function answer<T>(
  picked: Selection,
  name: string,
  make: () => Promise<T>,
): Promise<T> {
  let byName = answers.get(picked);
  if (!byName) {
    byName = new Map();
    answers.set(picked, byName);
  }
  const known = byName.get(name) as Promise<T> | undefined;
  if (known) return known;
  const made = make();
  byName.set(name, made);
  return made;
}

/** The pick's call site or definition, once the server has read it; Copy path takes the call site, else the definition. */
function placeOf(
  call: Props['call'],
  pick: { frame: string; picked: Selection },
  kind: PlaceKind,
): Promise<Location | null> {
  return answer(pick.picked, kind, () =>
    inspectionOf(call, pick.frame, pick.picked).then((inspected) => {
      if (inspected.status !== 'ready') return null;
      const { callSite, definition } = inspected.inspection;
      const place =
        kind === 'definition' ||
        (kind === 'path' && callSite.status !== 'found')
          ? definition
          : callSite;
      return place.status === 'found' ? place.at : null;
    }),
  );
}

function hasPlace(props: Props, kind: PlaceKind): boolean | Promise<boolean> {
  const pick = pickOf(props);
  if (!pick) return false;
  return answer(pick.picked, `has-${kind}`, () =>
    placeOf(props.call, pick, kind).then(Boolean),
  );
}

async function openPlace(props: Props, kind: PlaceKind): Promise<void> {
  const pick = pickOf(props);
  const at = pick ? await placeOf(props.call, pick, kind) : null;
  if (!at) return;
  await props.call('open', at).catch((error: unknown) => {
    props.notify(messageOf(error));
  });
}

function move(to: 'child' | 'parent' | 'next' | 'previous') {
  return {
    enabled: (props: Props) => pickOf(props) !== null,
    run: (props: Props) => {
      const pick = pickOf(props);
      if (!pick) return;
      props.command(pick.frame, 'navigate', { to }).catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// The context menu's header and lists (TRU-2.4).

/** The pick in the frame the menu was opened for, as last reported. */
function pickIn(props: Props, target: MenuTarget): Selection | null {
  return props.reports.selected[target.frame] ?? null;
}

// The menu's answers, kept per menu and by what they were made from (the
// pick's report, the layers tree), so it reads the same promise until one
// of those changes.
type Kept = Map<unknown, Kept | Promise<unknown>>;
const kept = new WeakMap<MenuTarget, Kept>();

function keep<T>(
  target: MenuTarget,
  keys: readonly unknown[],
  make: () => Promise<T>,
): Promise<T> {
  let level: Kept = kept.get(target) ?? new Map();
  kept.set(target, level);
  for (const key of keys.slice(0, -1)) {
    const next = level.get(key);
    const inner: Kept = next instanceof Map ? next : new Map();
    level.set(key, inner);
    level = inner;
  }
  const last = keys.at(-1);
  const known = level.get(last);
  if (known instanceof Promise) return known as Promise<T>;
  const made = make();
  level.set(last, made);
  return made;
}

/** A promise that never settles: the menu waits until a newer report replaces it. */
const WAITING = new Promise<never>(() => {});

/**
 * The pick's report, once it is this menu's. The menu opens before the
 * frame reports what the right-click picked, so it asks the frame which
 * element that is (a command, answered after the pick) and waits for that
 * report rather than show the last pick's.
 */
function pickFor(props: Props, target: MenuTarget): Promise<Selection | null> {
  const picked = pickIn(props, target);
  return keep(target, ['pick', picked], () =>
    keep(target, ['current'], () =>
      props
        .command(target.frame, 'current', {})
        // A frame that can't say: the last report is the best there is.
        .catch(() => undefined),
    ).then((id) =>
      id === undefined || id === (picked?.id ?? null) ? picked : WAITING,
    ),
  );
}

/** `Component · <tag>`, and the call site that opens in the editor or why there is none. */
function headerOf(
  props: Props,
  target: MenuTarget,
): Promise<MenuHeader | null> {
  return keep(target, ['header', pickIn(props, target)], () =>
    pickFor(props, target).then((picked) => {
      if (!picked) return null;
      return inspectionOf(props.call, target.frame, picked).then(
        (inspected): MenuHeader => {
          if (inspected.status === 'gone') {
            return { title: `<${picked.tag}>`, place: GONE };
          }
          if (inspected.status === 'failed') {
            return { title: `<${picked.tag}>`, place: READ_FAILED };
          }
          const { component, callSite, tag } = inspected.inspection;
          const element = `<${tag}>`;
          const title = component ? `${component.name} · ${element}` : element;
          if (callSite.status !== 'found') {
            return { title, place: ABSENT[callSite.reason].callSite };
          }
          const { at } = callSite;
          return {
            title,
            place: pathOf(at),
            what: 'call site',
            open: () =>
              props.call('open', at).then(
                () => {},
                (error: unknown) => props.notify(messageOf(error)),
              ),
          };
        },
      );
    }),
  );
}

/** The components from the pick up to the page, nearest first, as the Layers tree has them. */
function componentsOf(props: Props, target: MenuTarget): Promise<MenuItem[]> {
  const tree = props.reports.layers[target.frame];
  return keep(target, ['components', pickIn(props, target), tree], () =>
    pickFor(props, target).then((picked) => {
      if (!picked || !tree) return [];
      return (pathTo(tree.nodes, picked.id) ?? [])
        .filter((node) => node.kind !== 'element')
        .reverse()
        .map((node) => ({
          id: node.id,
          label: node.name,
          ...(node.kind === 'server' ? { detail: 'Server' } : {}),
        }));
    }),
  );
}

type Drawn = { id: number; tag: string; text: string | null };

/** Every element drawn under the right-click, top first, the pick marked. */
function layersOf(
  props: Props,
  target: MenuTarget,
): Promise<MenuItem[]> | null {
  const { point } = target;
  if (!point) return null;
  const tree = props.reports.layers[target.frame];
  const stack = keep(target, ['stack'], () =>
    props.command(target.frame, 'stackAt', point).catch((): Drawn[] => []),
  );
  return keep(target, ['layers', pickIn(props, target), tree], () =>
    Promise.all([stack, pickFor(props, target)]).then(([drawn, picked]) =>
      drawn.map((element): MenuItem => {
        const component = (
          pathTo(tree?.nodes ?? [], element.id) ?? []
        ).findLast((node) => node.kind !== 'element');
        return {
          id: element.id,
          label: element.text ?? `<${element.tag}>`,
          ...(component ? { detail: component.name } : {}),
          current: element.id === picked?.id,
        };
      }),
    ),
  );
}

/** A list's item outlined in the frame while it is hovered, and picked when chosen. */
function picks(title: string, items: MenuList<typeof selection>['items']) {
  return {
    title,
    group: 'select',
    items,
    highlight: (props: Props, target: MenuTarget, item: MenuItem | null) => {
      props
        .command(target.frame, 'highlight', { id: item?.id ?? null })
        .catch(() => {});
    },
    choose: (props: Props, target: MenuTarget, item: MenuItem) => {
      props.command(target.frame, 'select', { id: item.id }).catch(() => {});
    },
  };
}

export default definePanel(
  selection,
  { left: Layers, right: Inspector },
  {
    properties: DESIGN_SECTIONS,
    menu: {
      header: headerOf,
      lists: [
        picks('Select component', componentsOf),
        picks('Select layer', layersOf),
      ],
    },
    actions: {
      'select-child': move('child'),
      'select-parent': move('parent'),
      'select-next': move('next'),
      'select-previous': move('previous'),
      'collapse-layers': {
        run: () => {
          layerEvents.dispatchEvent(new Event('collapse'));
        },
      },
      'clear-marks': {
        enabled: (props) =>
          Object.values(props.reports.marks).some(
            ({ hidden, locked }) => hidden.length > 0 || locked.length > 0,
          ),
        run: async (props) => {
          await Promise.all(
            props.frames.map(({ id }) =>
              props.command(id, 'clear-marks', {}).catch(() => false),
            ),
          );
        },
      },
      'open-call-site': {
        enabled: (props) => hasPlace(props, 'callSite'),
        run: (props) => openPlace(props, 'callSite'),
      },
      'open-definition': {
        enabled: (props) => hasPlace(props, 'definition'),
        run: (props) => openPlace(props, 'definition'),
      },
      'copy-path': {
        enabled: (props) => hasPlace(props, 'path'),
        run: async (props) => {
          const pick = pickOf(props);
          const at = pick ? await placeOf(props.call, pick, 'path') : null;
          if (!at) return;
          copy(pathOf(at), props.notify, {
            done: 'Copied the path',
            failed: "Couldn't copy. Select the path and copy it.",
          });
        },
      },
      'copy-classes': {
        enabled: (props) => (pickOf(props)?.picked.classes.length ?? 0) > 0,
        run: (props) => {
          const classes = pickOf(props)?.picked.classes ?? [];
          if (classes.length === 0) return;
          copy(classes.join(' '), props.notify, {
            done: 'Copied the classes',
            failed: "Couldn't copy the classes. Try again.",
          });
        },
      },
      'copy-selector': {
        enabled: (props) => pickOf(props) !== null,
        run: (props) => {
          const pick = pickOf(props);
          if (!pick) return;
          copy(pick.picked.selector, props.notify, {
            done: 'Copied the selector',
            failed: "Couldn't copy the selector. Try again.",
          });
        },
      },
    },
  },
);
