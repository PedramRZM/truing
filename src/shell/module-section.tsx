import { Component, type ReactNode, useMemo } from 'react';

import { TriangleAlert } from 'lucide-react';

import {
  type BoundPropertySection,
  type Dock,
  messageOf,
  type ModuleSpec,
  type PanelDefinition,
  type PanelFrame,
  type PanelProps,
} from '../module';
import type { ModuleFailure } from '../protocol';

import { panelFrames, type ShellState, type ShellStore } from './store';

/** Another module's reports and ops, as `panel.follows` allows (TRU-5.2). */
function peersOf(module: ModuleSpec, state: ShellState, store: ShellStore) {
  return {
    reports: (id: string, name: string) =>
      module.panel?.follows?.[id]?.includes(name)
        ? (state.modules.reports[id]?.[name] ?? {})
        : {},
    call: (id: string, op: string, input: unknown) =>
      store.callOp(id, op, input),
  };
}

export type ShellModule = {
  module: ModuleSpec;
  panel: PanelDefinition | null;
};

type ModuleSectionProps = ShellModule & {
  dock: Dock;
  /** A module with sections in both docks shows what stopped in one of them. */
  showFailures: boolean;
  /** Every module's sections for the properties panel (TRU-3.8). */
  propertySections: readonly BoundPropertySection[];
  state: ShellState;
  store: ShellStore;
};

/**
 * One module's section in a dock: its panel, and whatever stopped. A panel
 * that throws is caught here, so the other sections keep working.
 */
export function ModuleSection({
  module,
  panel,
  dock,
  showFailures,
  propertySections,
  state,
  store,
}: ModuleSectionProps) {
  const frames = framesForPanels(state);
  const failures = showFailures
    ? groupFailures(
        state.modules.failures.filter(
          (failure) => failure.module === module.id,
        ),
      )
    : [];
  const headingId = `module-${module.id}-${dock}`;
  const panelMatches = panel?.part === 'panel' && panel.module.id === module.id;
  const Section = panelMatches ? panel.sections[dock] : undefined;
  const props = panelProps(module, state, store);
  // The same element while its props are the same: React leaves it alone.
  const body = useMemo(
    () =>
      Section ? (
        <PanelBoundary>
          <Section {...props} propertySections={propertySections} />
        </PanelBoundary>
      ) : null,
    [Section, props, propertySections],
  );

  return (
    <section className="module" aria-labelledby={headingId}>
      <h3 id={headingId} className="module-title">
        {module.panel?.titles?.[dock] ?? module.title}
      </h3>
      {failures.map((group) => (
        <Failure
          key={group.key}
          what={failureText(group, frames)}
          message={group.message}
          action={reloadAction(group, frames, store)}
        />
      ))}
      {panel && !panelMatches ? (
        <Failure
          what="This section stopped."
          message={`panel.tsx must export definePanel(module, …) for "${module.id}".`}
          action={RELOAD_TRUING}
        />
      ) : null}
      {body}
    </section>
  );
}

let lastFrames: PanelFrame[] = [];

/**
 * The frames as the panels see them: the same array until something in it
 * changes. While an edge is dragged they keep the size it started at, since
 * each new one would have the panels read the page again.
 */
function framesForPanels(state: ShellState): PanelFrame[] {
  if (state.resizing && lastFrames.length > 0) return lastFrames;
  const next = panelFrames(state);
  const same =
    next.length === lastFrames.length &&
    next.every((frame, index) => {
      const last = lastFrames[index];
      return (
        last &&
        frame.id === last.id &&
        frame.label === last.label &&
        frame.href === last.href &&
        frame.connected === last.connected &&
        frame.width === last.width &&
        frame.height === last.height
      );
    });
  if (same) return lastFrames;
  lastFrames = next;
  return next;
}

const lastProps = new WeakMap<
  ModuleSpec,
  { stored: unknown; followed: unknown[]; props: PanelProps<ModuleSpec> }
>();

/** The reports a panel follows, to tell when one of them is news. */
function followedBy(module: ModuleSpec, state: ShellState): unknown[] {
  return Object.entries(module.panel?.follows ?? {}).flatMap(([id, names]) =>
    names.map((name) => state.modules.reports[id]?.[name]),
  );
}

/**
 * What a module's panel, and its actions, get from the shell: the same object
 * until something in it changes, so a section renders only for its own news.
 */
export function panelProps(
  module: ModuleSpec,
  state: ShellState,
  store: ShellStore,
): PanelProps<ModuleSpec> {
  const frames = framesForPanels(state);
  const stored = state.modules.reports[module.id];
  const followed = followedBy(module, state);
  const last = lastProps.get(module);
  const published = state.modules.state[module.id];
  if (
    last &&
    last.stored === stored &&
    last.followed.every((value, index) => value === followed[index]) &&
    last.props.frames === frames &&
    last.props.activeFrame === state.activeFrame &&
    last.props.changes === state.modules.changes &&
    last.props.state === (published ?? NO_STATE) &&
    last.props.rightView === state.rightView
  ) {
    return last.props;
  }
  const props: PanelProps<ModuleSpec> = {
    frames,
    activeFrame: state.activeFrame,
    reports: reportsFor(module, state),
    changes: state.modules.changes,
    state: published ?? NO_STATE,
    rightView: state.rightView,
    showRightView: (view) => store.showRightView(view),
    peers: peersOf(module, state, store),
    call: (op, input) => store.callOp(module.id, op, input),
    command: (frame, name, input) =>
      store.command(module.id, frame, name, input),
    openMenu: (at) => store.openMenu(at),
    notify: (text, options) => store.notify(text, options),
    propertySections: [],
  };
  lastProps.set(module, { stored, followed, props });
  return props;
}

/** The same empty state each time, so it never looks like news. */
const NO_STATE = {};

/** Every report the module declares, by frame; empty until its probe sends one. */
function reportsFor(
  module: ModuleSpec,
  state: ShellState,
): Record<string, Record<string, unknown>> {
  const stored = state.modules.reports[module.id] ?? {};
  return Object.fromEntries(
    Object.keys(module.probe?.reports ?? {}).map((name) => [
      name,
      stored[name] ?? {},
    ]),
  );
}

/** Failures of one part with the same message: one probe failing in every frame shows once. */
export type FailureGroup = {
  key: string;
  part: ModuleFailure['part'];
  message: string;
  /** The frames a probe stopped in, in the order they failed. */
  frames: string[];
};

export function groupFailures(
  failures: readonly ModuleFailure[],
): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();
  for (const failure of failures) {
    const key = `${failure.part}:${failure.message}`;
    const group = groups.get(key) ?? {
      key,
      part: failure.part,
      message: failure.message,
      frames: [],
    };
    if (failure.frame !== null) group.frames.push(failure.frame);
    groups.set(key, group);
  }
  return [...groups.values()];
}

// en-GB: "Phone, Tablet and Desktop", without the serial comma, as Truing writes.
const frameList = new Intl.ListFormat('en-GB', {
  style: 'long',
  type: 'conjunction',
});

function failureText(
  group: FailureGroup,
  frames: readonly PanelFrame[],
): string {
  if (group.part === 'server') {
    return "Didn't start. Run truing again.";
  }
  const labels = group.frames.flatMap((id) => {
    const label = frames.find((frame) => frame.id === id)?.label;
    return label ? [label] : [];
  });
  if (labels.length === 0) {
    return 'Stopped in a frame.';
  }
  if (labels.length === 1) {
    return `Stopped in the ${labels[0]} frame.`;
  }
  return `Stopped in the ${frameList.format(labels)} frames.`;
}

type FailureAction = { label: string; run: () => void };

const RELOAD_TRUING: FailureAction = {
  label: 'Reload truing',
  run: () => location.reload(),
};

/** A probe that stopped starts again when its frame reloads; a server part needs a restart. */
function reloadAction(
  group: FailureGroup,
  frames: readonly PanelFrame[],
  store: ShellStore,
): FailureAction | null {
  if (group.part === 'server') return null;
  if (group.part === 'panel') return RELOAD_TRUING;
  const onCanvas = group.frames.filter((id) =>
    frames.some((frame) => frame.id === id),
  );
  const targets = onCanvas.length > 0 ? onCanvas : undefined;
  return {
    label: onCanvas.length === 1 ? 'Reload frame' : 'Reload frames',
    run: () => store.reload(targets),
  };
}

function Failure({
  what,
  message,
  action,
}: {
  what: string;
  message: string;
  action: FailureAction | null;
}) {
  return (
    <div className="module-failed" role="status">
      <TriangleAlert aria-hidden size={16} className="module-failed-icon" />
      <p>{what}</p>
      <p className="module-error">{message}</p>
      {action ? (
        <button type="button" className="module-action" onClick={action.run}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

type BoundaryState = { error: string | null };

/** React catches a render error only in a class component's boundary. */
export class PanelBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: messageOf(error) };
  }

  override render() {
    if (this.state.error !== null) {
      return (
        <Failure
          what="This section stopped."
          message={this.state.error}
          action={RELOAD_TRUING}
        />
      );
    }
    return this.props.children;
  }
}
