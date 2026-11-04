import {
  Component,
  createContext,
  type ReactNode,
  Suspense,
  use,
  useDeferredValue,
  useEffect,
  useId,
  useState,
} from 'react';

import { Plus } from 'lucide-react';

import {
  type BoundPropertySection,
  messageOf,
  type PropertyPick,
  propertySectionsFor,
} from '../../module';
import { FoldSummary } from '../../shell/controls/fold';

import { holdPreview, previewHeld } from './preview-held';
import { COMPUTED_PROPERTIES, kindOfPick } from './design-values';
import { withStaged } from './layout-classes';
import type { Inspection, Selection, Style } from './module';
import {
  frameToShow,
  GONE,
  inspectionOf,
  type Props,
  READ_FAILED,
} from './panel-shared';
import {
  instancesOfPick,
  type Loaded,
  loaded,
  usagesOfPick,
} from './selection-section';
import { SimilarPrompt } from './similar-prompt';
import { setsText } from './style-classes';

type Computed = Awaited<ReturnType<typeof readComputed>>;

function readComputed(
  command: Props['command'],
  frame: string,
  id: number | null,
) {
  return command(frame, 'computed', {
    id,
    properties: [...COMPUTED_PROPERTIES],
  });
}

/** What makes a pick's computed styles worth reading again, besides a new report. */
type ReadWhen = {
  /** The frame's size: a resize changes what's laid out. */
  size: string;
  /** Each report of the page's layers: something on it changed. */
  layers: object | null;
  /** The pointer is on the pick, so what's read may be its `:hover` state. */
  hovering: boolean;
};

const computedLookups = new WeakMap<
  Selection,
  { when: ReadWhen; lookup: Promise<Loaded<Computed>> }
>();

/** The last read of each element, by its frame and id: only the current ones matter. */
const latestLookups = new Map<string, Promise<Loaded<Computed>>>();

function computedOfPick(
  command: Props['command'],
  frame: string,
  picked: Selection,
  when: ReadWhen,
): Promise<Loaded<Computed>> {
  const last = computedLookups.get(picked);
  // A change on the page can report the same element again as a new object.
  const element = `${frame}:${picked.id}`;
  const before = last?.lookup ?? latestLookups.get(element);
  if (before && previewHeld()) return before;
  if (
    last &&
    last.when.size === when.size &&
    last.when.layers === when.layers &&
    // Read again once the pointer has left, and keep that when it comes back.
    (!last.when.hovering || when.hovering)
  ) {
    return last.lookup;
  }
  const lookup = loaded(readComputed(command, frame, picked.id));
  computedLookups.set(picked, { when, lookup });
  latestLookups.set(element, lookup);
  return lookup;
}

type PageLook = { computed: Computed; styles: Style[] };

// One read per report of the page's layers.
const pageLookups = new WeakMap<object, Promise<Loaded<PageLook>>>();

function lookOfPage(
  { call, command }: Props,
  frame: string,
  layers: object,
): Promise<Loaded<PageLook>> {
  let lookup = pageLookups.get(layers);
  if (!lookup) {
    lookup = loaded(
      readComputed(command, frame, null).then(async (computed) => ({
        computed,
        styles: computed
          ? await call('styles', { classes: computed.classes })
          : [],
      })),
    );
    pageLookups.set(layers, lookup);
  }
  return lookup;
}

/** What the module's own sections read besides the pick: its report and its tokens. */
export type Design = {
  picked: Selection | null;
  inspection: Inspection | null;
  styles: readonly Style[];
  label: string;
  outlined: boolean;
  onOutlined: (outlined: boolean) => void;
};

export const DesignContext = createContext<Design | null>(null);

/** The context the panel provides; a section outside it is a bug, so it says so. */
export function useDesign(): Design {
  const design = use(DesignContext);
  if (!design) throw new Error('This section needs the properties panel.');
  return design;
}

type BoundaryProps = { what: string; children: ReactNode };
type BoundaryState = { error: string | null };

/** A lookup or a section that throws shows here, not over the whole panel. */
class SectionBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: messageOf(error) };
  }

  override render() {
    if (this.state.error !== null) {
      return (
        <div className="module-failed" role="status">
          <p>{this.props.what}</p>
          <p className="module-error">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const storageKey = (id: string): string => `truing:section:${id}`;

/** A section the designer opens: closed until they do, and remembered (Code). */
function ClosedSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(
    () => localStorage.getItem(storageKey(id)) === 'open',
  );
  return (
    <details
      className="design-section"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        localStorage.setItem(storageKey(id), next ? 'open' : 'closed');
      }}
    >
      <FoldSummary className="design-section-title">{title}</FoldSummary>
      {children}
    </details>
  );
}

function SectionView({
  bound: { section, props },
  pick,
}: {
  bound: BoundPropertySection;
  pick: PropertyPick;
}) {
  const headingId = useId();
  const { picked } = useDesign();
  const { title, Body, Add, addWhenSet } = section;
  if (section.applies?.(pick) === false) return null;
  // What's staged counts: a fill just added opens its section at once.
  const width =
    props.frames.find((frame) => frame.id === pick.frame)?.width ??
    picked?.width ??
    0;
  const asStaged = picked
    ? { ...pick, own: withStaged(pick.own, props.changes, picked, width) }
    : pick;
  if (section.empty?.(asStaged)) {
    return (
      <div
        className="design-section"
        data-empty="true"
        role="group"
        aria-labelledby={headingId}
      >
        <h4 id={headingId} className="design-section-title">
          {title}
        </h4>
        {Add ? (
          <Add {...props} pick={pick} />
        ) : (
          // A section with nothing to add yet says so by being off.
          <button
            type="button"
            className="tool"
            aria-label={`Add ${title.toLowerCase()}`}
            disabled
          >
            <Plus aria-hidden size={16} />
          </button>
        )}
      </div>
    );
  }

  if (section.closed) {
    return (
      <ClosedSection id={section.id} title={title}>
        <Body {...props} pick={pick} />
      </ClosedSection>
    );
  }
  return (
    <div className="design-section" role="group" aria-labelledby={headingId}>
      <div className="design-section-head">
        <h4 id={headingId} className="design-section-title">
          {title}
        </h4>
        {Add && addWhenSet ? <Add {...props} pick={pick} /> : null}
      </div>
      <Body {...props} pick={pick} />
    </div>
  );
}

/** The sections for what's picked, in the set order, from whichever module added them. */
function Sections({
  pick,
  sections,
}: {
  pick: PropertyPick;
  sections: readonly BoundPropertySection[];
}) {
  const ordered = propertySectionsFor(
    pick.kind,
    sections.map((bound) => ({ id: bound.section.id, bound })),
  );
  // Two modules may add to one slot, and each section fails alone.
  return ordered.map(({ id, bound }, index) => (
    <SectionBoundary
      key={`${id}-${index}`}
      what={`The ${bound.section.title} section stopped. Pick another element to try again.`}
    >
      {/* One that waits for something keeps the others on screen. */}
      <Suspense fallback={null}>
        <SectionView bound={bound} pick={pick} />
      </Suspense>
    </SectionBoundary>
  ));
}

/** The sections that don't need the page's values, for when they can't be read. */
const WITHOUT_VALUES = new Set(['selection', 'code']);

/** Which frame and tag, while there's nothing else to show: Code holds it otherwise. */
function PickedTitle({ label, tag }: { label: string; tag: string }) {
  return (
    <p className="inspect-title properties-hint">
      <span>{label}</span>
      <code>{`<${tag}>`}</code>
    </p>
  );
}

function PickView({
  frame,
  label,
  picked,
  when,
  outlined,
  onOutlined,
  props,
}: {
  frame: string;
  label: string;
  picked: Selection;
  when: ReadWhen;
  outlined: boolean;
  onOutlined: (outlined: boolean) => void;
  props: Props;
}) {
  // Everything starts together, not one after the other.
  instancesOfPick(props.call, frame, picked);
  usagesOfPick(props.call, frame, picked);
  const computedLookup = computedOfPick(props.command, frame, picked, when);
  const inspected = use(inspectionOf(props.call, frame, picked));
  const computed = use(computedLookup);
  const title = <PickedTitle label={label} tag={picked.tag} />;
  if (inspected.status === 'gone') {
    return (
      <>
        {title}
        <p className="module-empty properties-hint">{GONE}</p>
      </>
    );
  }
  if (inspected.status === 'failed') {
    return (
      <>
        {title}
        <div className="module-failed" role="status">
          <p>{READ_FAILED}</p>
          <p className="module-error">{inspected.message}</p>
        </div>
      </>
    );
  }
  if (computed.status === 'ready' && !computed.value) {
    return (
      <>
        {title}
        <p className="module-empty properties-hint">{GONE}</p>
      </>
    );
  }

  const { inspection } = inspected;
  const values = computed.status === 'ready' ? computed.value : null;
  const pick: PropertyPick = {
    kind: values ? kindOfPick(picked.text, values.own) : 'element',
    frame,
    id: picked.id,
    classes: values?.classes ?? picked.classes,
    own: values?.own ?? {},
    parent: values?.parent ?? {},
    backdrop: values?.backdrop ?? null,
    // An icon's colour has its own section, without the type around it.
    setsText: picked.tag !== 'svg' && setsText(picked.text, inspection.styles),
    width: values?.width ?? 0,
    height: values?.height ?? 0,
    tag: picked.tag,
    src: values?.src ?? null,
  };
  return (
    <DesignContext
      value={{
        picked,
        inspection,
        styles: inspection.styles,
        label,
        outlined,
        onOutlined,
      }}
    >
      {computed.status === 'failed' ? (
        // What the code says doesn't depend on reading the page.
        <div className="module-failed" role="status">
          <p>{READ_FAILED}</p>
          <p className="module-error">{computed.message}</p>
        </div>
      ) : null}
      <SimilarPrompt
        frame={frame}
        picked={picked}
        call={props.call}
        command={props.command}
        changes={props.changes}
        notify={props.notify}
      />
      <Sections
        pick={pick}
        sections={
          values
            ? props.propertySections
            : props.propertySections.filter(({ section }) =>
                WITHOUT_VALUES.has(section.id),
              )
        }
      />
    </DesignContext>
  );
}

/** With nothing picked, the panel is about the page. */
function PageView({
  frame,
  label,
  layers,
  props,
}: {
  frame: string;
  label: string;
  layers: object;
  props: Props;
}) {
  const look = use(lookOfPage(props, frame, layers));
  if (look.status === 'failed') {
    return (
      <div className="module-failed" role="status">
        <p>{READ_FAILED}</p>
        <p className="module-error">{look.message}</p>
      </div>
    );
  }
  const { computed, styles } = look.value;
  if (!computed) return null;
  const { own, parent, backdrop, width, height, classes } = computed;
  const pick: PropertyPick = {
    kind: 'page',
    frame,
    id: null,
    classes,
    own,
    parent,
    backdrop,
    setsText: false,
    width,
    height,
    tag: 'body',
    src: null,
  };
  return (
    <DesignContext
      value={{
        picked: null,
        inspection: null,
        styles,
        label,
        outlined: false,
        onOutlined: () => {},
      }}
    >
      <Sections pick={pick} sections={props.propertySections} />
    </DesignContext>
  );
}

/**
 * The right panel's Properties view: sections that follow the selection
 * (TRU-3.8). It's one view in the dock's body, so TRU-5.2's Claude can sit beside it.
 */
export function Inspector(props: Props) {
  const shown = frameToShow(props, props.reports.selected);
  const frame = props.frames.find(({ id }) => id === shown?.id);
  const view = shown && {
    ...shown,
    when: {
      size: `${frame?.width}x${frame?.height}`,
      layers: props.reports.layers[shown.id] ?? null,
      hovering: props.reports.overPick[shown.id] === shown.value.id,
    },
  };
  // While the next lookup runs, the last one stays on screen.
  const deferred = useDeferredValue(view);
  // Outlining instances stays on from one pick to the next.
  const [outlined, setOutlined] = useState(false);
  const page = frameToShow(props, props.reports.layers);

  // A pick in a frame doesn't blur a field, and leaving a field commits what's
  // in it (TRU-4.2). The last pick's sections are still on screen here, as the
  // deferred value above moves on after this commit.
  const pickKey = shown ? `${shown.id}:${shown.value.id}` : null;
  useEffect(() => {
    holdPreview(false);
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      focused.closest('.properties .field')
    ) {
      focused.blur();
    }
  }, [pickKey]);

  if (!deferred) {
    return (
      <div className="inspect properties">
        <p className="module-empty properties-hint">
          Press V, then pick an element in a frame to see its design.
        </p>
        {page ? (
          // A new route starts again, so a section that stopped gets another go.
          <SectionBoundary
            key={`${page.id}:${page.value.href}`}
            what={READ_FAILED}
          >
            <Suspense fallback={null}>
              <PageView
                frame={page.id}
                label={page.label}
                layers={page.value}
                props={props}
              />
            </Suspense>
          </SectionBoundary>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inspect properties" data-stale={deferred !== view}>
      <SectionBoundary
        key={`${deferred.id}:${deferred.value.id}`}
        what={READ_FAILED}
      >
        <Suspense
          fallback={
            <>
              <PickedTitle label={deferred.label} tag={deferred.value.tag} />
              <p className="module-empty properties-hint">
                Reading the element…
              </p>
            </>
          }
        >
          <PickView
            frame={deferred.id}
            label={deferred.label}
            picked={deferred.value}
            when={deferred.when}
            outlined={outlined}
            onOutlined={setOutlined}
            props={props}
          />
        </Suspense>
      </SectionBoundary>
    </div>
  );
}
