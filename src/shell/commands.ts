// The shell's half of the one list of commands (TRU-2.3): what each core
// command does, and every listed module's actions with the props its panel
// gets. The key handler, the `?` sheet, the rail and the context menu all
// read `shellCommands`.
import { panels } from 'truing:panels';

import {
  CORE_ENTRIES,
  type CoreCommandId,
  currentPlatform,
  keyFormat,
} from '../commands';
import type {
  ActionSpec,
  MenuDefinition,
  MenuHeader,
  MenuItem,
  MenuTarget,
  ModuleSpec,
} from '../module';
import { isCanvasShortcut } from '../protocol';

import { panelProps } from './module-section';
import { isFill, type ShellState, type ShellStore } from './store';

export const KEYS = keyFormat(currentPlatform());

export const SHEET_ID = 'shortcuts-sheet';

export type ShellCommand = {
  /** A core command's id, or `module:action`. */
  id: string;
  /** A core group, or the module's title. */
  group: string;
  spec: ActionSpec;
  run: () => void | Promise<void>;
  enabled: () => boolean | Promise<boolean>;
};

/** Opens the `?` sheet: a popover beside the canvas, so the page stays in view. */
export function openSheet(): void {
  const sheet = document.getElementById(SHEET_ID);
  if (sheet instanceof HTMLDialogElement && !sheet.open) sheet.show();
}

/** Something the browser closes on Esc by itself: a menu, the sheet. */
function layerOpen(): boolean {
  return (
    document.querySelector(':popover-open:not(.context-menu), dialog[open]') !==
    null
  );
}

function runCore(id: CoreCommandId, state: ShellState, store: ShellStore) {
  if (isCanvasShortcut(id)) {
    store.runShortcut(id);
    return;
  }
  switch (id) {
    case 'mode-select':
      store.setMode('select');
      return;
    case 'mode-interact':
      store.setMode('interact');
      return;
    case 'toggle-left':
      store.toggleDock('left');
      return;
    case 'toggle-right':
      store.toggleDock('right');
      return;
    case 'shortcuts':
      openSheet();
      return;
    case 'escape':
      // One layer per press: an edge drag, the context menu, the pick in
      // every frame, then Fill. The sheet and the viewport menu close themselves
      // first (see `enabled`), and a focused field, the layers filter, takes
      // its own Esc.
      if (state.resizing) {
        store.endResize(true);
        return;
      }
      if (state.menu) {
        store.closeMenu();
        return;
      }
      store.escape();
      return;
  }
}

function coreEnabled(id: CoreCommandId, state: ShellState): boolean {
  if (id !== 'escape') return true;
  if (layerOpen()) return false;
  return (
    state.resizing ||
    state.menu !== null ||
    state.mode === 'select' ||
    isFill(state)
  );
}

/** Every command, core first, then each listed module's in the config's order. */
export function shellCommands(
  state: ShellState,
  store: ShellStore,
): ShellCommand[] {
  const core = CORE_ENTRIES.map(([id, spec]): ShellCommand => ({
    id,
    group: spec.group,
    spec,
    run: () => runCore(id, state, store),
    enabled: () => coreEnabled(id, state),
  }));
  const modules = panels.flatMap(({ module, panel }): ShellCommand[] => {
    const declared: Record<string, ActionSpec> = module.actions ?? {};
    if (!panel || panel.module.id !== module.id) return [];
    return Object.entries(declared).flatMap(([name, spec]): ShellCommand[] => {
      const handler = panel.actions[name];
      if (!handler) return [];
      const props = () => panelProps(module, state, store);
      return [
        {
          id: `${module.id}:${name}`,
          group: module.title,
          spec,
          run: () => handler.run(props()),
          enabled: () => handler.enabled?.(props()) ?? true,
        },
      ];
    });
  });
  return [...core, ...modules];
}

/** A module's list in the context menu (TRU-2.4), bound to its panel's props. */
export type ShellMenuList = {
  /** `module:index`, unique in the menu. */
  id: string;
  group: string;
  title: string;
  items: () => readonly MenuItem[] | null | Promise<readonly MenuItem[] | null>;
  highlight: (item: MenuItem | null) => void;
  choose: (item: MenuItem) => void | Promise<void>;
};

/** What each listed module adds to the context menu besides its actions. */
export function shellMenus(
  state: ShellState,
  store: ShellStore,
  target: MenuTarget,
): {
  headers: {
    id: string;
    read: () => MenuHeader | null | Promise<MenuHeader | null>;
  }[];
  lists: ShellMenuList[];
} {
  const added = panels.flatMap(
    ({
      module,
      panel,
    }): { module: ModuleSpec; menu: MenuDefinition<ModuleSpec> }[] =>
      panel && panel.module.id === module.id
        ? [{ module, menu: panel.menu }]
        : [],
  );
  const props = (module: ModuleSpec) => panelProps(module, state, store);
  return {
    headers: added.flatMap(({ module, menu }) => {
      const { header } = menu;
      if (!header) return [];
      return [{ id: module.id, read: () => header(props(module), target) }];
    }),
    lists: added.flatMap(({ module, menu }) =>
      (menu.lists ?? []).map((list, index): ShellMenuList => ({
        id: `${module.id}:${index}`,
        group: list.group,
        title: list.title,
        items: () => list.items(props(module), target),
        highlight: (item) => list.highlight?.(props(module), target, item),
        choose: (item) => list.choose(props(module), target, item),
      })),
    ),
  };
}
