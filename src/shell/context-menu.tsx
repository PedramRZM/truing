// The context menu (TRU-2.3, TRU-2.4): the pick's header, then the module actions
// marked `menu` and the modules' lists, in groups. Modules give data; this
// draws it, places it in the window and handles its keys.
import {
  Fragment,
  type KeyboardEvent,
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

import { Check, ChevronRight } from 'lucide-react';

import type { MenuHeader, MenuItem } from '../module';

import {
  KEYS,
  type ShellCommand,
  shellCommands,
  type ShellMenuList,
  shellMenus,
} from './commands';
import { groupRows, placeAtPoint, placeBeside } from './menu-layout';
import type { ContextMenu as MenuState, ShellState, ShellStore } from './store';

type ViewProps = { state: ShellState; store: ShellStore };

/** The 12 px icons in the menu draw the rail's 1.33 px stroke. */
const STROKE = 4 / 3;

/** How long the pointer must rest on another row before it replaces the open list. */
const CROSSING_MS = 150;

/** The list open beside the menu, and whether its first item takes focus. */
type OpenList = { id: string; focus: boolean } | null;

type RowProps = {
  command: ShellCommand;
  store: ShellStore;
  onPointerEnter: () => void;
};

function MenuRow({
  command,
  enabled,
  store,
  onPointerEnter,
}: RowProps & { enabled: boolean }) {
  const first = command.spec.keys?.[0];
  return (
    <button
      type="button"
      role="menuitem"
      className="menu-row context-row"
      disabled={!enabled}
      aria-keyshortcuts={KEYS.aria(command.spec.keys)}
      onPointerEnter={onPointerEnter}
      onClick={() => {
        store.closeMenu();
        void command.run();
      }}
    >
      <span>{command.spec.title}</span>
      {first ? <kbd className="key">{KEYS.chord(first)}</kbd> : null}
    </button>
  );
}

/** An item whose answer is still coming: disabled until it settles. */
function PendingRow({
  pending,
  ...props
}: RowProps & { pending: Promise<boolean> }) {
  return <MenuRow {...props} enabled={use(pending)} />;
}

function ActionRow(props: RowProps) {
  const enabled = props.command.enabled();
  if (typeof enabled === 'boolean') {
    return <MenuRow {...props} enabled={enabled} />;
  }
  return (
    <Suspense fallback={<MenuRow {...props} enabled={false} />}>
      <PendingRow {...props} pending={enabled} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// The header: what the pick is, and where its code is.

function HeaderView({
  header,
  store,
}: {
  header: MenuHeader | null;
  store: ShellStore;
}) {
  if (!header) return null;
  return (
    <div role="group" className="context-header" aria-label={header.title}>
      <p className="context-title">{header.title}</p>
      {header.open ? (
        <button
          type="button"
          role="menuitem"
          className="menu-row context-place"
          aria-label={`Open ${header.what ? `${header.what} ` : ''}${header.place} in your editor`}
          title={`Open ${header.what ? `${header.what} ` : ''}in your editor`}
          onClick={() => {
            store.closeMenu();
            void header.open?.();
          }}
        >
          <code>{header.place}</code>
        </button>
      ) : (
        <p className="context-absent">{header.place}</p>
      )}
    </div>
  );
}

function PendingHeader({
  pending,
  store,
}: {
  pending: Promise<MenuHeader | null>;
  store: ShellStore;
}) {
  return <HeaderView header={use(pending)} store={store} />;
}

function Header({
  read,
  store,
}: {
  read: () => MenuHeader | null | Promise<MenuHeader | null>;
  store: ShellStore;
}) {
  const header = read();
  if (!(header instanceof Promise)) {
    return <HeaderView header={header} store={store} />;
  }
  return (
    <Suspense
      fallback={
        <div role="group" className="context-header">
          <p className="context-absent">Reading the element…</p>
        </div>
      }
    >
      <PendingHeader pending={header} store={store} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Lists: a row that opens one beside the menu.

type ListProps = {
  list: ShellMenuList;
  open: OpenList;
  setOpen: (open: OpenList) => void;
  /** The pointer asks for a list, or for none: it may be on its way to the open one. */
  point: (open: OpenList) => void;
  /** The pointer reached the open list: what it crossed on the way doesn't count. */
  arrived: () => void;
  store: ShellStore;
};

function ListRowView({
  list,
  items,
  open,
  setOpen,
  point,
  arrived,
  store,
}: ListProps & { items: readonly MenuItem[] | null }) {
  if (!items) return null;
  const expanded = open?.id === list.id;
  return (
    <>
      <button
        type="button"
        role="menuitem"
        className="menu-row context-row"
        aria-haspopup="menu"
        aria-expanded={expanded}
        data-list={list.id}
        disabled={items.length === 0}
        // On any move over it: a row enabled under the pointer opens when it next moves.
        onPointerMove={() => {
          if (!expanded) point({ id: list.id, focus: false });
        }}
        onClick={() => setOpen({ id: list.id, focus: true })}
      >
        <span>{list.title}</span>
        <ChevronRight
          aria-hidden
          className="context-chevron"
          size={12}
          absoluteStrokeWidth
          strokeWidth={STROKE}
        />
      </button>
      {expanded ? (
        <ListMenu
          list={list}
          items={items}
          focus={open.focus}
          store={store}
          arrived={arrived}
        />
      ) : null}
    </>
  );
}

function PendingListRow({
  pending,
  ...props
}: ListProps & { pending: Promise<readonly MenuItem[] | null> }) {
  return <ListRowView {...props} items={use(pending)} />;
}

function ListRow(props: ListProps) {
  const items = props.list.items();
  if (!(items instanceof Promise)) {
    return <ListRowView {...props} items={items} />;
  }
  return (
    <Suspense fallback={<ListRowView {...props} items={[]} />}>
      <PendingListRow {...props} pending={items} />
    </Suspense>
  );
}

/** The open list: hovering or focusing an item outlines it in the frame. */
function ListMenu({
  list,
  items,
  focus,
  store,
  arrived,
}: {
  list: ShellMenuList;
  items: readonly MenuItem[];
  focus: boolean;
  store: ShellStore;
  arrived: () => void;
}) {
  // A list that marks one item is a set of radio items: one is checked.
  const radio = items.some((item) => item.current !== undefined);
  // The frame's outline goes with the list, however it closes.
  const clear = useEffectEvent(() => list.highlight(null));
  useEffect(() => () => clear(), []);

  return (
    <div
      ref={(node) => {
        if (!node) return;
        // The row before it opened it; the menu holds both.
        const row = node.previousElementSibling;
        const menu = node.parentElement;
        if (!row || !menu) return;
        const place = (): void => {
          const at = placeBeside(
            row.getBoundingClientRect(),
            menu.getBoundingClientRect(),
            node.getBoundingClientRect(),
            { width: innerWidth, height: innerHeight },
          );
          node.style.left = `${at.left}px`;
          node.style.top = `${at.top}px`;
        };
        if (!node.matches(':popover-open')) {
          node.showPopover();
          place();
          // From the keys, focus goes to the checked item, else the first.
          if (focus) {
            (
              node.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
              node.querySelector<HTMLButtonElement>(':enabled')
            )?.focus();
          }
        }
        const resized = new ResizeObserver(place);
        resized.observe(node);
        return () => resized.disconnect();
      }}
      className="menu context-menu context-list"
      popover="manual"
      role="menu"
      aria-label={list.title}
      data-list={list.id}
      onPointerEnter={arrived}
      onPointerLeave={() => list.highlight(null)}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role={radio ? 'menuitemradio' : 'menuitem'}
          className="menu-row context-item"
          aria-checked={radio ? Boolean(item.current) : undefined}
          onPointerEnter={(event) => event.currentTarget.focus()}
          onFocus={() => list.highlight(item)}
          onClick={() => {
            store.closeMenu();
            void list.choose(item);
          }}
        >
          <span className="context-mark" aria-hidden>
            {item.current ? (
              <Check size={12} absoluteStrokeWidth strokeWidth={STROKE} />
            ) : null}
          </span>
          <span className="context-label">{item.label}</span>
          {item.detail ? (
            <span className="context-detail">{item.detail}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keys and the menu itself.

/** The items of the menu an element is in, and not of a list inside it. */
function itemsOf(menu: Element): HTMLButtonElement[] {
  return [
    ...menu.querySelectorAll<HTMLButtonElement>(
      '[role^="menuitem"]:not(:disabled)',
    ),
  ].filter((item) => item.closest('[role="menu"]') === menu);
}

/**
 * ↑ and ↓ move through the rows of the menu or list that has focus, → (or
 * Enter) opens a list, ← and Esc close it and go back to its row. True when
 * the key was the menu's.
 */
function menuKeys(
  event: KeyboardEvent<HTMLDivElement>,
  setOpen: (open: OpenList) => void,
): boolean {
  const { key } = event;
  const target = event.target as HTMLElement;
  const menu = target.closest<HTMLElement>('[role="menu"]');
  if (!menu) return false;
  const inList = menu !== event.currentTarget;

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    const items = itemsOf(menu);
    const at = items.indexOf(target as HTMLButtonElement);
    const step = key === 'ArrowDown' ? 1 : -1;
    // From the menu itself (as it opens), ↓ goes to the first row and ↑ to the last.
    const next = at === -1 ? (step === 1 ? 0 : -1) : at + step;
    items.at(next % items.length)?.focus();
    return true;
  }
  // The menu itself has focus as it opens: Enter isn't the shell's there.
  if (target === menu && (key === 'Enter' || key === ' ')) return true;
  if (key === 'ArrowRight') {
    const list = target.getAttribute('aria-haspopup')
      ? target.dataset.list
      : undefined;
    if (list && !(target as HTMLButtonElement).disabled) {
      setOpen({ id: list, focus: true });
    }
    return true;
  }
  if (inList && (key === 'ArrowLeft' || key === 'Escape')) {
    setOpen(null);
    event.currentTarget
      .querySelector<HTMLButtonElement>(
        `[aria-haspopup][data-list="${menu.dataset.list}"]`,
      )
      ?.focus();
    return true;
  }
  return key === 'ArrowLeft';
}

function MenuView({ state, store, menu }: ViewProps & { menu: MenuState }) {
  const [open, setOpen] = useState<OpenList>(null);
  // The pointer's way to an open list may cross other rows: while a list is
  // open, what it crosses takes effect only if it stays there a moment.
  const crossing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const added = shellMenus(state, store, menu);
  const groups = groupRows([
    ...shellCommands(state, store).flatMap((command) =>
      command.spec.menu
        ? [{ group: command.spec.menu, kind: 'action' as const, command }]
        : [],
    ),
    ...added.lists.map((list) => ({
      group: list.group,
      kind: 'list' as const,
      list,
    })),
  ]);
  if (groups.length === 0 && added.headers.length === 0) return null;
  const arrived = (): void => {
    if (crossing.current) clearTimeout(crossing.current);
    crossing.current = null;
  };
  const point = (next: OpenList): void => {
    arrived();
    if (!open) {
      setOpen(next);
      return;
    }
    if (next?.id === open.id) return;
    crossing.current = setTimeout(() => setOpen(next), CROSSING_MS);
  };
  const closeList = (): void => point(null);

  return (
    <div
      // Manual, not auto: on Linux the right button's release comes after the
      // menu opens, and an auto popover takes it for a click outside. Esc is
      // the shell's (commands.ts); a press outside closes it here.
      ref={(node) => {
        if (!node) return;
        // At the pointer, flipped and kept inside the window as it grows.
        const place = (): void => {
          const at = placeAtPoint(menu, node.getBoundingClientRect(), {
            width: innerWidth,
            height: innerHeight,
          });
          node.style.left = `${at.left}px`;
          node.style.top = `${at.top}px`;
        };
        if (!node.matches(':popover-open')) {
          node.showPopover();
          place();
          // The menu itself, not a row: its rows may still be loading.
          node.focus();
        }
        const resized = new ResizeObserver(place);
        resized.observe(node);
        const outside = (event: PointerEvent): void => {
          if (!node.contains(event.target as Node)) store.closeMenu();
        };
        document.addEventListener('pointerdown', outside, { capture: true });
        return () => {
          resized.disconnect();
          document.removeEventListener('pointerdown', outside, {
            capture: true,
          });
        };
      }}
      className="menu context-menu"
      popover="manual"
      role="menu"
      aria-label="Element"
      tabIndex={-1}
      onKeyDown={(event) => {
        // Tab leaves the menu, as in any menu: it closes, and focus goes back.
        if (event.key === 'Tab') {
          event.preventDefault();
          store.closeMenu();
          return;
        }
        // Space presses the focused row, so the shell's Space (pan) never sees it.
        if (event.key === ' ' && event.target !== event.currentTarget) {
          event.stopPropagation();
          return;
        }
        if (menuKeys(event, setOpen)) {
          event.preventDefault();
          // Not the shell's keys as well: Esc in a list closes only the list.
          event.stopPropagation();
        }
      }}
    >
      {added.headers.map((header) => (
        <Header key={header.id} read={header.read} store={store} />
      ))}
      {groups.map(({ group, rows }, index) => (
        <Fragment key={group}>
          {index > 0 || added.headers.length > 0 ? (
            <div role="separator" className="context-separator" />
          ) : null}
          {rows.map((row) =>
            row.kind === 'action' ? (
              <ActionRow
                key={row.command.id}
                command={row.command}
                store={store}
                onPointerEnter={closeList}
              />
            ) : (
              <ListRow
                key={row.list.id}
                list={row.list}
                open={open}
                setOpen={setOpen}
                point={point}
                arrived={arrived}
                store={store}
              />
            ),
          )}
        </Fragment>
      ))}
    </div>
  );
}

export function ContextMenu({ state, store }: ViewProps) {
  const { menu } = state;
  if (!menu) return null;
  // A new menu per opening, so it opens where this right-click was.
  return <MenuView key={menu.id} state={state} store={store} menu={menu} />;
}
