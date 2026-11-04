import {
  type KeyboardEvent,
  type ReactNode,
  useSyncExternalStore,
} from 'react';

import { panels } from 'truing:panels';
import { Keyboard, PanelLeft, PanelRight, Scan } from 'lucide-react';

import { type CommandSpec, CORE_COMMANDS } from '../commands';
import {
  type BoundPropertySection,
  type Dock as Side,
  LEFT_TABS,
  type LeftTab,
  RIGHT_VIEWS,
  type RightView,
} from '../module';

import { KEYS, openSheet } from './commands';
import {
  ModuleSection,
  PanelBoundary,
  panelProps,
  type ShellModule,
} from './module-section';
import { failuresDock } from './panels';
import type { ShellState, ShellStore } from './store';

type DocksProps = {
  state: ShellState;
  store: ShellStore;
};

/**
 * The docks a module has a section in. A module without a panel shows in the
 * right panel only when something of it stopped.
 */
function docksOf({ module }: ShellModule, state: ShellState): readonly Side[] {
  if (module.panel) {
    return module.panel.docks;
  }
  const failed = state.modules.failures.some(
    (failure) => failure.module === module.id,
  );
  return failed ? ['right'] : [];
}

const LEFT_TAB_VIEW = {
  design: {
    label: 'Design',
    command: CORE_COMMANDS['tab-design'],
    empty: "The page's layers will show here.",
  },
  theme: {
    label: 'Theme',
    command: CORE_COMMANDS['tab-theme'],
    empty: "The project's tokens will show here.",
  },
} as const satisfies Record<
  LeftTab,
  { label: string; command: CommandSpec; empty: string }
>;

const NO_TOKENS =
  'No tokens found in this project. The panels show raw values instead.';

const RIGHT_VIEW_NAME = {
  properties: {
    label: 'Properties',
    empty: 'Press V, then pick an element in a frame to see its design.',
  },
  claude: { label: 'Claude', empty: "Claude's chat will show here." },
  'claude-config': {
    label: 'Claude',
    empty: 'What Claude loads will show here.',
  },
} as const satisfies Record<RightView, { label: string; empty: string }>;

/** The views a module asks for, after Properties, which is always there. */
const RIGHT_VIEW_LIST: readonly RightView[] = RIGHT_VIEWS.filter(
  (view) =>
    view === 'properties' ||
    panels.some(({ module }) => module.panel?.view === view),
);

/**
 * The switch's parts. Claude's configuration opens from the chat, so it's part of
 * the Claude tab, and has a tab of its own only when the chat isn't listed.
 */
const RIGHT_TABS = RIGHT_VIEW_LIST.filter(
  (view) => view !== 'claude-config' || !RIGHT_VIEW_LIST.includes('claude'),
);

/** The tab a view belongs to. */
function tabOfView(view: RightView): RightView {
  return view === 'claude-config' && RIGHT_VIEW_LIST.includes('claude')
    ? 'claude'
    : view;
}

let lastSections: BoundPropertySection[] = [];

/**
 * Each with its own module's props, for the panel that draws them (TRU-3.8): the
 * same list until one of those props changes.
 */
function boundSections(
  state: ShellState,
  store: ShellStore,
): BoundPropertySection[] {
  const next = panels.flatMap(({ module, panel }): BoundPropertySection[] => {
    if (!panel || panel.module.id !== module.id) return [];
    return panel.properties.map((section: BoundPropertySection['section']) => ({
      section,
      props: panelProps(module, state, store),
    }));
  });
  const same =
    next.length === lastSections.length &&
    next.every(
      ({ section, props }, index) =>
        section === lastSections[index]?.section &&
        props === lastSections[index]?.props,
    );
  if (same) return lastSections;
  lastSections = next;
  return next;
}

/**
 * The two panels beside the canvas (TRU-3.3). Open, the canvas takes the room
 * they leave; closed, each is a small floating pill. Their sections come from
 * the modules the config lists, in its order. The left panel's sections sit
 * in the tab they ask for (TRU-3.4).
 */
export function Docks({ state, store }: DocksProps) {
  const propertySections = boundSections(state, store);
  const sections = (
    side: Side,
    tab?: LeftTab,
    foot = false,
    view?: RightView,
  ): ReactNode[] =>
    panels.flatMap((entry) => {
      const docks = docksOf(entry, state);
      if (!docks.includes(side)) return [];
      const moduleTab = entry.module.panel?.tab ?? 'design';
      if (tab && moduleTab !== tab) return [];
      // A left section isn't at the foot, whatever the module's right one does.
      if (side === 'right' && Boolean(entry.module.panel?.foot) !== foot) {
        return [];
      }
      if (view && (entry.module.panel?.view ?? 'properties') !== view) {
        return [];
      }
      return [
        <ModuleSection
          key={entry.module.id}
          {...entry}
          dock={side}
          // A module's failures show once.
          showFailures={failuresDock(docks, moduleTab, state.leftTab) === side}
          propertySections={propertySections}
          state={state}
          store={store}
        />,
      ];
    });

  return (
    <>
      <Dock
        side="left"
        name={state.projectName}
        open={state.docks.left}
        command={CORE_COMMANDS['toggle-left']}
        onToggle={() => store.toggleDock('left')}
      >
        <LeftTabs current={state.leftTab} store={store} />
        {LEFT_TABS.map((tab) => (
          <div
            key={tab}
            id={panelId(tab)}
            className="dock-tab"
            role="tabpanel"
            aria-labelledby={tabId(tab)}
            hidden={tab !== state.leftTab}
            // Theme's empty state has nothing else to stop on.
            tabIndex={0}
          >
            <DockBody
              empty={
                tab === 'theme' && !state.hasTokens
                  ? NO_TOKENS
                  : LEFT_TAB_VIEW[tab].empty
              }
            >
              {sections('left', tab)}
            </DockBody>
          </div>
        ))}
      </Dock>
      <Dock
        side="right"
        open={state.docks.right}
        command={CORE_COMMANDS['toggle-right']}
        onToggle={() => store.toggleDock('right')}
        actions={<RightPanelActions store={store} />}
      >
        {RIGHT_VIEW_LIST.length > 1 ? (
          <RightViews current={state.rightView} store={store} />
        ) : null}
        {RIGHT_VIEW_LIST.map((view) => (
          <div
            key={view}
            id={viewPanelId(view)}
            className="dock-tab"
            role={RIGHT_VIEW_LIST.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={
              RIGHT_VIEW_LIST.length > 1
                ? viewTabId(tabOfView(view))
                : undefined
            }
            hidden={view !== state.rightView}
            data-only={RIGHT_VIEW_LIST.length === 1 || undefined}
          >
            <DockBody empty={RIGHT_VIEW_NAME[view].empty}>
              {sections('right', undefined, false, view)}
            </DockBody>
          </div>
        ))}
        <div className="dock-foot">
          {sections('right', undefined, true)}
          <ViewFeet state={state} store={store} />
        </div>
      </Dock>
    </>
  );
}

/**
 * What a module pins under the Changes summary while its view shows (TRU-5.2).
 * Hidden rather than gone, so a half-written message survives a switch.
 */
function ViewFeet({ state, store }: DocksProps) {
  return panels.flatMap(({ module, panel }) => {
    const Foot = panel?.foot;
    if (!Foot || panel.module.id !== module.id) return [];
    const view = module.panel?.view ?? 'properties';
    return [
      <div key={module.id} hidden={view !== state.rightView}>
        <PanelBoundary>
          <Foot {...panelProps(module, state, store)} />
        </PanelBoundary>
      </div>,
    ];
  });
}

function viewTabId(view: RightView): string {
  return `right-tab-${view}`;
}

function viewPanelId(view: RightView): string {
  return `right-panel-${view}`;
}

/** Properties | Claude: the same control as the left panel's tabs (TRU-5.2). */
function RightViews({
  current,
  store,
}: {
  current: RightView;
  store: ShellStore;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : RIGHT_TABS.length - 1;
    const next =
      RIGHT_TABS[
        (RIGHT_TABS.indexOf(tabOfView(current)) + step) % RIGHT_TABS.length
      ] ?? current;
    store.showRightView(next);
    document.getElementById(viewTabId(next))?.focus();
  }

  return (
    <div
      className="segmented dock-tabs"
      role="tablist"
      aria-label="Right panel view"
      onKeyDown={onKeyDown}
    >
      {RIGHT_TABS.map((view) => {
        const selected = view === tabOfView(current);
        return (
          <button
            key={view}
            id={viewTabId(view)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={viewPanelId(view)}
            tabIndex={selected ? 0 : -1}
            onClick={() => store.showRightView(view)}
          >
            {RIGHT_VIEW_NAME[view].label}
          </button>
        );
      })}
    </div>
  );
}

function tabId(tab: LeftTab): string {
  return `left-tab-${tab}`;
}

function panelId(tab: LeftTab): string {
  return `left-panel-${tab}`;
}

/** The right panel's top row (TRU-3.5): it stays in the pill when the panel closes. */
function RightPanelActions({ store }: Pick<DocksProps, 'store'>) {
  const scale = useSyncExternalStore(store.subscribeScale, store.getScale);

  return (
    <div className="dock-actions">
      <button
        type="button"
        className="tool"
        aria-label={CORE_COMMANDS.fit.title}
        aria-keyshortcuts={KEYS.aria(CORE_COMMANDS.fit.keys)}
        title={KEYS.tooltip(CORE_COMMANDS.fit)}
        onClick={() => store.fit()}
      >
        <Scan aria-hidden size={16} />
      </button>
      <button
        type="button"
        className="zoom"
        aria-label={CORE_COMMANDS['zoom-reset'].title}
        aria-keyshortcuts={KEYS.aria(CORE_COMMANDS['zoom-reset'].keys)}
        title={KEYS.tooltip(CORE_COMMANDS['zoom-reset'])}
        onClick={() => store.zoomTo(1)}
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        type="button"
        className="tool dock-shortcuts"
        aria-label={CORE_COMMANDS.shortcuts.title}
        aria-keyshortcuts={KEYS.aria(CORE_COMMANDS.shortcuts.keys)}
        title={KEYS.tooltip(CORE_COMMANDS.shortcuts)}
        aria-haspopup="dialog"
        onClick={() => openSheet()}
      >
        <Keyboard aria-hidden size={16} />
      </button>
    </div>
  );
}

/** The left panel's tabs: arrow keys move between them, as a tablist's do. */
function LeftTabs({ current, store }: { current: LeftTab; store: ShellStore }) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    // Alt and an arrow is the browser's back and forward.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : LEFT_TABS.length - 1;
    const next =
      LEFT_TABS[(LEFT_TABS.indexOf(current) + step) % LEFT_TABS.length] ??
      current;
    store.showLeftTab(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <div
      className="segmented dock-tabs"
      role="tablist"
      aria-label="Panel view"
      onKeyDown={onKeyDown}
    >
      {LEFT_TABS.map((tab) => {
        const { label, command } = LEFT_TAB_VIEW[tab];
        const selected = tab === current;
        return (
          <button
            key={tab}
            id={tabId(tab)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(tab)}
            aria-keyshortcuts={KEYS.aria(command.keys)}
            tabIndex={selected ? 0 : -1}
            title={KEYS.tooltip(command)}
            onClick={() => store.showLeftTab(tab)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

type DockProps = {
  side: Side;
  /** What the header shows; a panel without one has only its actions and toggle there. */
  name?: string;
  actions?: ReactNode;
  open: boolean;
  command: CommandSpec;
  onToggle: () => void;
  children: ReactNode;
};

function Dock({
  side,
  name,
  actions,
  open,
  command,
  onToggle,
  children,
}: DockProps) {
  const Icon = side === 'left' ? PanelLeft : PanelRight;
  const label = side === 'left' ? 'Left panel' : 'Right panel';

  return (
    <aside
      className="dock"
      data-side={side}
      data-open={open}
      aria-label={label}
    >
      <header className="dock-header">
        {name ? (
          <h2 title={name}>{name}</h2>
        ) : (
          // Sections' h3s still need a heading above them.
          <h2 className="visually-hidden">{label}</h2>
        )}
        {actions}
        <button
          type="button"
          className="tool"
          aria-expanded={open}
          aria-keyshortcuts={KEYS.aria(command.keys)}
          aria-label={`${open ? 'Close' : 'Open'} ${side} panel`}
          title={[
            command,
            CORE_COMMANDS['collapse-panels'],
            CORE_COMMANDS['hide-ui'],
          ]
            .map(KEYS.tooltip)
            .join('\n')}
          onClick={onToggle}
        >
          <Icon aria-hidden size={16} />
        </button>
      </header>
      {open ? children : null}
    </aside>
  );
}

function DockBody({
  empty,
  children,
}: {
  empty: string;
  children: ReactNode[];
}) {
  if (children.length === 0) {
    return <p className="dock-empty">{empty}</p>;
  }
  return <div className="dock-body">{children}</div>;
}
