import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useState,
} from 'react';

import {
  ChevronRight,
  Columns3,
  Component as ComponentIcon,
  Eye,
  EyeOff,
  Frame,
  Image,
  LayoutGrid,
  Link,
  Lock,
  LockOpen,
  type LucideIcon,
  RectangleHorizontal,
  Rows3,
  Server,
  Shapes,
  SquareArrowOutUpRight,
  TextCursorInput,
  Type,
} from 'lucide-react';

import { messageOf } from '../../module';

import {
  type DesignIcon,
  designLayers,
  type DesignRow,
  type DesignTree,
  type LayersView,
  parseLayersView,
} from './design-layers';
import { childLevel, deepestLevel } from './layer-indent';
import { elementsOfRow, markedRows } from './layer-marks';
import { filterLayers } from './layers-filter';
import type { LayerNode, Location } from './module';
import { count, frameToShow, pathTo, type Props, STROKE } from './panel-shared';

/** A row of either view. */
type TreeRow = LayerNode | DesignRow;

type TreeState = {
  selected: number | null;
  /** Rows the designer opened or closed; the rest follow the defaults. */
  toggled: ReadonlyMap<number, boolean>;
  onSelectedPath: ReadonlySet<number>;
  /** While filtering, every row is open, and the match ↑ and ↓ are on is marked. */
  filtering: boolean;
  active: number | null;
  /** Alt+L: only the way to the selection stays open by default. */
  collapsed: boolean;
  hidden: ReadonlySet<number>;
  locked: ReadonlySet<number>;
  /** Hides or locks a row in the frame, or undoes it (TRU-3.7). */
  mark: (kind: 'hidden' | 'locked', id: number, on: boolean) => void;
  /** The current row's ref: it runs when a row becomes current, not on every render. */
  reveal: (row: HTMLElement | null) => void;
  toggle: (id: number, open: boolean) => void;
  select: (id: number) => void;
  highlight: (id: number | null) => void;
  menu: (id: number, at: { x: number; y: number }) => void;
  /** Where a row is in the code; the Design view shows it on hover. */
  source: ((id: number) => Promise<Location | null>) | null;
  open: (at: Location) => void;
};

/** How many levels of the tree start open. */
const OPEN_DEPTH = 3;

function isOpen(node: TreeRow, depth: number, tree: TreeState): boolean {
  if (tree.filtering) return true;
  const chosen = tree.toggled.get(node.id);
  if (chosen !== undefined) return chosen;
  if (tree.onSelectedPath.has(node.id)) return true;
  // Open near the top and through single-child rows, until Alt+L closes them.
  return !tree.collapsed && (depth < OPEN_DEPTH || node.children.length === 1);
}

const IMAGE_TAGS = new Set(['img', 'svg', 'picture', 'video', 'canvas']);

const DESIGN_ICONS = {
  row: Columns3,
  column: Rows3,
  grid: LayoutGrid,
  frame: Frame,
  text: Type,
  image: Image,
  icon: Shapes,
  button: RectangleHorizontal,
  input: TextCursorInput,
  link: Link,
  component: ComponentIcon,
} as const satisfies Record<DesignIcon, LucideIcon>;

/** What a row's icon says it is: a component, a Server Component, or an element by kind. */
function iconOf(node: TreeRow): { Icon: LucideIcon; kind: string } {
  if ('icon' in node) {
    return { Icon: DESIGN_ICONS[node.icon], kind: node.icon };
  }
  if (node.kind === 'client') return { Icon: ComponentIcon, kind: 'component' };
  if (node.kind === 'server') return { Icon: Server, kind: 'server' };
  if (node.name === 'a') return { Icon: Link, kind: 'link' };
  if (node.name === 'button') {
    return { Icon: RectangleHorizontal, kind: 'button' };
  }
  if (IMAGE_TAGS.has(node.name)) return { Icon: Image, kind: 'image' };
  if (node.text) return { Icon: Type, kind: 'text' };
  return { Icon: Frame, kind: 'element' };
}

/** A component by its name, a text row by its text, any other element by its tag. */
function nameOf(node: TreeRow, kind: string): string {
  if ('icon' in node || node.kind !== 'element') return node.name;
  if (kind === 'text' && node.text) return node.text;
  return `<${node.name}>`;
}

function rowId(id: number): string {
  return `layer-${id}`;
}

function treeId(frame: string): string {
  return `layers-${frame}`;
}

function scrollToRow(row: HTMLElement | null): void {
  row?.scrollIntoView({ block: 'nearest' });
}

function LayerRow({
  node,
  depth,
  level,
  band,
  faded,
  tree,
}: {
  node: TreeRow;
  depth: number;
  /** How far the row is indented, in steps. */
  level: number;
  /** It's inside the selection. */
  band: boolean;
  /** It's inside a hidden row. */
  faded: boolean;
  tree: TreeState;
}) {
  // Asked on each hover, so a hot reload's new lines show.
  const [source, setSource] = useState<Location | null>(null);
  const findSource = (): void => {
    tree
      .source?.(node.id)
      .then(setSource)
      .catch(() => setSource(null));
  };
  const open = node.children.length > 0 && isOpen(node, depth, tree);
  const current = node.id === tree.selected;
  const active = node.id === tree.active;
  const { Icon, kind } = iconOf(node);
  const name = nameOf(node, kind);
  const hidden = tree.hidden.has(node.id);
  const locked = tree.locked.has(node.id);

  return (
    <li>
      <div
        className="layer-row"
        data-kind={'icon' in node ? undefined : node.kind}
        data-active={active || undefined}
        aria-current={current || undefined}
        data-band={band || undefined}
        data-faded={faded || hidden || undefined}
        data-marked={hidden || locked || undefined}
        style={{ '--level': level } as CSSProperties}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            className="layer-toggle"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
            onClick={() => tree.toggle(node.id, !open)}
          >
            <ChevronRight
              aria-hidden
              size={12}
              absoluteStrokeWidth
              strokeWidth={STROKE}
            />
          </button>
        ) : (
          <span className="layer-toggle" aria-hidden />
        )}
        <button
          type="button"
          id={rowId(node.id)}
          className="layer-name"
          data-icon={kind}
          title={source ? `${name}\n${source.file}:${source.line}` : name}
          ref={current || active ? tree.reveal : undefined}
          onClick={() => tree.select(node.id)}
          onContextMenu={(event) => {
            event.preventDefault();
            tree.menu(node.id, { x: event.clientX, y: event.clientY });
          }}
          onPointerEnter={() => {
            tree.highlight(node.id);
            findSource();
          }}
          onPointerLeave={() => tree.highlight(null)}
          onFocus={findSource}
        >
          <Icon
            aria-hidden
            className="layer-icon"
            size={12}
            absoluteStrokeWidth
            strokeWidth={STROKE}
          />
          {/* A row reads in the direction of its own words, whatever the panel's. */}
          <span
            className="layer-label"
            dir={'icon' in node ? 'auto' : undefined}
          >
            {name}
          </span>
          {'kind' in node && node.kind === 'server' ? (
            <>
              {' '}
              <span className="layer-server">Server</span>
            </>
          ) : null}
        </button>
        <span className="layer-actions">
          {source ? (
            <button
              type="button"
              className="layer-action"
              data-slot="open"
              aria-label={`Open ${name} in your editor`}
              title="Open in your editor"
              onClick={() => tree.open(source)}
            >
              <SquareArrowOutUpRight
                aria-hidden
                size={16}
                absoluteStrokeWidth
                strokeWidth={STROKE}
              />
            </button>
          ) : null}
          <button
            type="button"
            className="layer-action"
            data-on={locked || undefined}
            aria-label={`${locked ? 'Unlock' : 'Lock'} ${name}`}
            title={locked ? 'Unlock' : 'Lock'}
            onClick={() => tree.mark('locked', node.id, !locked)}
          >
            {locked ? (
              <Lock
                aria-hidden
                size={16}
                absoluteStrokeWidth
                strokeWidth={STROKE}
              />
            ) : (
              <LockOpen
                aria-hidden
                size={16}
                absoluteStrokeWidth
                strokeWidth={STROKE}
              />
            )}
          </button>
          <button
            type="button"
            className="layer-action"
            data-on={hidden || undefined}
            aria-label={`${hidden ? 'Show' : 'Hide'} ${name}`}
            title={hidden ? 'Show' : 'Hide'}
            onClick={() => tree.mark('hidden', node.id, !hidden)}
          >
            {hidden ? (
              <EyeOff
                aria-hidden
                size={16}
                absoluteStrokeWidth
                strokeWidth={STROKE}
              />
            ) : (
              <Eye
                aria-hidden
                size={16}
                absoluteStrokeWidth
                strokeWidth={STROKE}
              />
            )}
          </button>
        </span>
      </div>
      {open ? (
        <LayerList
          nodes={node.children}
          depth={depth + 1}
          level={childLevel(level, node.children.length)}
          band={band || current}
          faded={faded || hidden}
          tree={tree}
        />
      ) : null}
    </li>
  );
}

function LayerList({
  nodes,
  depth,
  level,
  band,
  faded,
  tree,
}: {
  nodes: readonly TreeRow[];
  depth: number;
  level: number;
  band: boolean;
  faded: boolean;
  tree: TreeState;
}) {
  return (
    <ul className="layer-list">
      {nodes.map((node) => (
        <LayerRow
          key={node.id}
          node={node}
          depth={depth}
          level={level}
          band={band}
          faded={faded}
          tree={tree}
        />
      ))}
    </ul>
  );
}

/** The filter's own keys: ↑ and ↓ through the matches, Enter picks, Esc clears. */
function filterKeys(
  event: KeyboardEvent<HTMLInputElement>,
  filter: {
    query: string;
    matches: readonly number[];
    index: number;
    active: number | null;
    clear: () => void;
    step: (index: number) => void;
    select: (id: number) => void;
  },
): void {
  const { key } = event;
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();
    const total = filter.matches.length;
    if (total === 0) return;
    const by = key === 'ArrowDown' ? 1 : -1;
    filter.step((filter.index + by + total) % total);
    return;
  }
  if (key === 'Enter' && filter.active !== null) {
    event.preventDefault();
    filter.select(filter.active);
    return;
  }
  if (key === 'Escape') {
    // The filter is the first layer Esc closes: clear it, then leave it.
    event.preventDefault();
    if (filter.query) filter.clear();
    else event.currentTarget.blur();
  }
}

const VIEW_STORAGE_KEY = 'truing:layers-view';

// Alt+L runs in the shell's key handler, with the panel's props and not its state.
export const layerEvents = new EventTarget();

// One Design tree per report of the layers, however often the panel renders.
const designTrees = new WeakMap<readonly LayerNode[], DesignTree>();

export function designTreeOf(nodes: readonly LayerNode[]): DesignTree {
  let tree = designTrees.get(nodes);
  if (!tree) {
    tree = designLayers(nodes);
    designTrees.set(nodes, tree);
  }
  return tree;
}

export function Layers(props: Props) {
  const [view, setView] = useState<LayersView>(() =>
    parseLayersView(localStorage.getItem(VIEW_STORAGE_KEY)),
  );
  const [toggled, setToggled] = useState<ReadonlyMap<number, boolean>>(
    new Map(),
  );
  const [query, setQuery] = useState('');
  const [step, setStep] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [revealed, setRevealed] = useState<number | null>(null);
  // A new function makes React call it again on the current row.
  const [reveal, setReveal] = useState(() => scrollToRow);
  const shown = frameToShow(props, props.reports.layers);

  useEffect(() => {
    const collapse = (): void => {
      setToggled(new Map());
      setCollapsed(true);
      // The way to the pick opens again below, and stays after it's cleared.
      setRevealed(null);
      // The rows above it go, so the selected row may leave the view.
      setReveal(() => (row: HTMLElement | null) => scrollToRow(row));
    };
    layerEvents.addEventListener('collapse', collapse);
    return () => layerEvents.removeEventListener('collapse', collapse);
  }, []);

  if (!shown) {
    return <p className="module-empty">Layers show once a frame loads.</p>;
  }

  const design = view === 'design' ? designTreeOf(shown.value.nodes) : null;
  const rows: readonly TreeRow[] = design?.nodes ?? shown.value.nodes;
  const picked = props.reports.selected[shown.id] ?? null;
  // A pick the Design view removed shows on its nearest row.
  const selected = picked && (design?.shownAs.get(picked.id) ?? picked.id);
  const selectedRows = selected === null ? null : pathTo(rows, selected);
  const selectedPath = (selectedRows ?? []).slice(0, -1).map((node) => node.id);
  // A new pick opens its way there, even through a row closed by hand, and
  // the way stays open after the pick moves on. Closing a row on the way to
  // the same pick stays closed. A pick whose row isn't reported yet waits for it.
  if (selected !== revealed && (selected === null || selectedRows)) {
    setRevealed(selected);
    setToggled((before) => {
      const next = new Map(before);
      for (const id of selectedPath) next.set(id, true);
      return next;
    });
  }
  const filtering = query.trim() !== '';
  const filtered = filterLayers(rows, query);
  const { matches } = filtered;
  // The match ↑ and ↓ are on; it stays in range as the tree changes.
  const index = matches.length === 0 ? -1 : step % matches.length;
  const active = matches[index] ?? null;

  /** The element a row picks: its own, or for a component's row in Design, its first. */
  const pickOfRow = (id: number): number => design?.picks.get(id) ?? id;
  const select = (id: number): void => {
    props.command(shown.id, 'select', { id: pickOfRow(id) }).catch(() => {});
  };
  const marks = props.reports.marks[shown.id];
  const tree: TreeState = {
    selected,
    toggled,
    onSelectedPath: new Set(selectedPath),
    filtering,
    active: filtering ? active : null,
    collapsed,
    reveal,
    hidden: markedRows(shown.value.nodes, marks?.hidden ?? []),
    locked: markedRows(shown.value.nodes, marks?.locked ?? []),
    mark: (kind, id, on) => {
      const ids = elementsOfRow(shown.value.nodes, id);
      if (ids.length === 0) return;
      props.command(shown.id, 'mark', { kind, ids, on }).catch(() => {});
    },
    toggle: (id, open) => setToggled((before) => new Map(before).set(id, open)),
    select,
    highlight: (id) => {
      props
        .command(shown.id, 'highlight', {
          id: id === null ? null : pickOfRow(id),
        })
        .catch(() => {});
    },
    menu: (id, at) => {
      select(id);
      props.openMenu({ ...at, frame: shown.id });
    },
    source: design
      ? (id) => props.call('source', { frame: shown.id, id })
      : null,
    open: (at) => {
      props.call('open', at).catch((error: unknown) => {
        props.notify(messageOf(error));
      });
    },
  };

  const choose = (next: LayersView): void => {
    setView(next);
    // Closed rows are forgotten, so the pick's path opens in the new view.
    setToggled(new Map());
    setCollapsed(false);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  return (
    <nav className="layers" aria-label={`Layers of the ${shown.label} frame`}>
      <div className="layers-head">
        <p className="inspect-title">
          <span>{shown.label}</span>
        </p>
        <div className="segmented" role="group" aria-label="Layers view">
          <button
            type="button"
            aria-pressed={view === 'design'}
            onClick={() => choose('design')}
          >
            Design
          </button>
          <button
            type="button"
            aria-pressed={view === 'code'}
            onClick={() => choose('code')}
          >
            Code
          </button>
        </div>
      </div>
      <div className="layers-filter">
        <input
          type="search"
          aria-label="Filter layers"
          placeholder="Filter layers"
          aria-activedescendant={
            filtering && active !== null ? rowId(active) : undefined
          }
          aria-controls={treeId(shown.id)}
          spellCheck={false}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setStep(0);
          }}
          onKeyDown={(event) =>
            filterKeys(event, {
              query,
              matches,
              index,
              active,
              clear: () => {
                setQuery('');
                setStep(0);
              },
              step: setStep,
              select,
            })
          }
        />
        {filtering && matches.length > 0 ? (
          <span className="layers-count" role="status">
            <span className="visually-hidden">Match </span>
            {count.format(index + 1)} of {count.format(matches.length)}
          </span>
        ) : null}
      </div>
      {filtering && matches.length === 0 ? (
        <p className="module-empty" role="status">
          No layers match “{query.trim()}”.
        </p>
      ) : design && rows.length === 0 ? (
        <p className="module-empty">
          Nothing is drawn on this page yet. Switch to Code to see its elements.
        </p>
      ) : (
        <div
          id={treeId(shown.id)}
          className="layer-tree"
          data-view={view}
          style={
            {
              // Never 0: the CSS divides by it.
              '--deepest': Math.max(
                1,
                deepestLevel(filtered.nodes, (node, depth) =>
                  isOpen(node, depth, tree),
                ),
              ),
            } as CSSProperties
          }
        >
          <LayerList
            nodes={filtered.nodes}
            depth={0}
            level={0}
            band={false}
            faded={false}
            tree={tree}
          />
        </div>
      )}
    </nav>
  );
}
