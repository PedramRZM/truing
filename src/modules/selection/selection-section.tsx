import { Suspense, use, useEffect, useState } from 'react';

import { messageOf } from '../../module';
import { ChoiceMenu } from '../../shell/controls/choice-menu';
import { FoldSummary } from '../../shell/controls/fold';

import type {
  Inspection,
  InstancesView,
  Selection,
  UsagesView,
} from './module';
import { count, pathOf, type Props, SourceActions } from './panel-shared';

/** The value a staged change gives this element's property, if one is staged. */
function stagedValue(
  changes: Props['changes'],
  picked: Selection,
  property: string,
): string | null {
  const staged = changes.findLast(
    (change) =>
      change.module === 'selection' &&
      change.property === property &&
      change.element?.selector === picked.selector &&
      change.element.href === picked.href,
  );
  return staged?.after[0]?.value ?? null;
}

// ---------------------------------------------------------------------------
// Instances (TRU-2.2): the pick's component on this page and in the code.

export type Loaded<T> =
  { status: 'ready'; value: T } | { status: 'failed'; message: string };

export function loaded<T>(promise: Promise<T>): Promise<Loaded<T>> {
  return promise.then(
    (value): Loaded<T> => ({ status: 'ready', value }),
    (error: unknown): Loaded<T> => ({
      status: 'failed',
      message: messageOf(error),
    }),
  );
}

// One lookup per report, as for the inspection.
const instanceLookups = new WeakMap<
  Selection,
  Promise<Loaded<InstancesView | null>>
>();
const usageLookups = new WeakMap<
  Selection,
  Promise<Loaded<UsagesView | null>>
>();

export function instancesOfPick(
  call: Props['call'],
  frame: string,
  picked: Selection,
): Promise<Loaded<InstancesView | null>> {
  let lookup = instanceLookups.get(picked);
  if (!lookup) {
    lookup = loaded(call('instances', { frame, id: picked.id }));
    instanceLookups.set(picked, lookup);
  }
  return lookup;
}

export function usagesOfPick(
  call: Props['call'],
  frame: string,
  picked: Selection,
): Promise<Loaded<UsagesView | null>> {
  let lookup = usageLookups.get(picked);
  if (!lookup) {
    lookup = loaded(call('usages', { frame, id: picked.id }));
    usageLookups.set(picked, lookup);
  }
  return lookup;
}

const plural = new Intl.PluralRules('en');
const uses = (n: number): string =>
  `${count.format(n)} ${plural.select(n) === 'one' ? 'use' : 'uses'}`;

type Values = Readonly<Record<string, string | null>>;

/** The pick's own variant values, when every one is known. */
function pickedValues(view: InstancesView): Values | null {
  const own = view.groups
    .flatMap((group) => group.instances)
    .find((instance) => instance.picked);
  if (!own || view.variants.length === 0) return null;
  return view.variants.every((name) => own.props[name] != null)
    ? own.props
    : null;
}

function sameVariant(
  names: readonly string[],
  values: Values,
  other: Values,
): boolean {
  return names.every((name) => other[name] === values[name]);
}

export function InstancesSection({
  frame,
  picked,
  call,
  command,
  outlined,
  onOutlined,
}: {
  frame: string;
  picked: Selection;
  call: Props['call'];
  command: Props['command'];
  outlined: boolean;
  onOutlined: (outlined: boolean) => void;
}) {
  // Both lookups start before either is read.
  const instancesLookup = instancesOfPick(call, frame, picked);
  const usagesLookup = usagesOfPick(call, frame, picked);
  const instances = use(instancesLookup);
  const usages = use(usagesLookup);
  const [onlyVariant, setOnlyVariant] = useState(false);

  const view = instances.status === 'ready' ? instances.value : null;
  const values = view ? pickedValues(view) : null;
  const filtering = onlyVariant && values !== null && view !== null;
  const groups = (view?.groups ?? [])
    .map((group) => ({
      ...group,
      instances: filtering
        ? group.instances.filter((instance) =>
            sameVariant(view.variants, values, instance.props),
          )
        : group.instances,
    }))
    .filter((group) => group.instances.length > 0);
  const shown = groups.flatMap((group) => group.instances);
  const ids = shown.flatMap((instance) => instance.elements);
  const idsKey = ids.join(',');

  // The outlines are drawn in the frame, a system outside React.
  useEffect(() => {
    if (!outlined || idsKey === '') return;
    const wanted = idsKey.split(',').map(Number);
    command(frame, 'outline', { ids: wanted }).catch(() => {});
    return () => {
      command(frame, 'outline', { ids: [] }).catch(() => {});
    };
  }, [outlined, idsKey, frame, command]);

  const outline = (subset: readonly number[] | null): void => {
    if (!outlined && subset === null) {
      command(frame, 'outline', { ids: [] }).catch(() => {});
      return;
    }
    command(frame, 'outline', { ids: [...(subset ?? ids)] }).catch(() => {});
  };

  if (instances.status === 'failed') {
    return (
      <section aria-label="Instances">
        <h4 className="inspect-heading">Instances</h4>
        <p className="module-error">{instances.message}</p>
      </section>
    );
  }
  if (!view) return null;

  const variantName =
    values && view.variants.map((name) => values[name]).join(' · ');
  const code =
    usages.status === 'ready' && usages.value
      ? usages.value.uses.filter(
          (use) =>
            !filtering || sameVariant(view.variants, values, use.variants),
        )
      : null;

  return (
    <section aria-label="Instances" className="inspect-instances">
      <h4 className="inspect-heading">Instances</h4>
      <div className="instances-bar">
        <button
          type="button"
          className="instances-toggle"
          aria-pressed={outlined}
          onClick={() => onOutlined(!outlined)}
        >
          Outline
        </button>
        <span role="status">{count.format(shown.length)} on this page</span>
      </div>
      {variantName ? (
        <div
          className="segmented instances-filter"
          role="group"
          aria-label="Which instances"
        >
          <button
            type="button"
            aria-pressed={!onlyVariant}
            onClick={() => setOnlyVariant(false)}
          >
            All variants
          </button>
          <button
            type="button"
            aria-pressed={onlyVariant}
            onClick={() => setOnlyVariant(true)}
          >
            {view.component} · {variantName}
          </button>
        </div>
      ) : null}
      <details className="instances-code">
        <FoldSummary>On this page · {uses(groups.length)}</FoldSummary>
        <ul className="instances-sites" aria-label="Uses on this page">
          {groups.map((group, index) => {
            const elements = group.instances.flatMap(
              (instance) => instance.elements,
            );
            const first = elements[0];
            const where = group.at ? pathOf(group.at) : null;
            const here = group.instances.some((instance) => instance.picked);
            return (
              <li key={group.at ? where : `unplaced-${index}`}>
                <button
                  type="button"
                  className="instances-site"
                  aria-label={
                    where
                      ? `Pick ${view.component} at ${where}`
                      : `Pick ${view.component}, place not known`
                  }
                  disabled={first === undefined}
                  onPointerEnter={() => outline(elements)}
                  onPointerLeave={() => outline(null)}
                  onFocus={() => outline(elements)}
                  onBlur={() => outline(null)}
                  onClick={() => {
                    if (first === undefined) return;
                    command(frame, 'select', { id: first }).catch(() => {});
                  }}
                >
                  {where ? (
                    <code className="truncated-path" title={where}>
                      <bdi>{where}</bdi>
                    </code>
                  ) : (
                    'Place not known'
                  )}
                </button>
                <span className="instances-count">
                  {group.instances.length > 1
                    ? `×${count.format(group.instances.length)}`
                    : null}
                  {here ? ' · this use' : null}
                </span>
              </li>
            );
          })}
        </ul>
      </details>
      {usages.status === 'failed' ? (
        <p className="module-error">{usages.message}</p>
      ) : code ? (
        <details className="instances-code">
          <FoldSummary>In the code · {uses(code.length)}</FoldSummary>
          <ol aria-label="Uses in the code">
            {code.map((use) => (
              <li key={`${use.file}:${use.line}:${use.column}`}>
                <code className="truncated-path" title={pathOf(use)}>
                  <bdi>{pathOf(use)}</bdi>
                </code>
                {use.inList ? (
                  <span className="instances-count"> · in a list</span>
                ) : null}
                <SourceActions at={use} call={call} />
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

/** "This use" or "Every Button · N uses": what the next edits are for (TRU-2.2). */
function ReachPicker({
  frame,
  picked,
  component,
  call,
  notify,
}: {
  frame: string;
  picked: Selection;
  component: string;
  call: Props['call'];
  notify: Props['notify'];
}) {
  const usages = use(usagesOfPick(call, frame, picked));
  const [reach, setReach] = useState<'use' | 'component'>('use');
  const total =
    usages.status === 'ready' && usages.value ? usages.value.uses.length : null;
  // One use: this use is the component, so there is nothing to choose.
  if (total !== null && total <= 1) return null;

  const choose = (next: 'use' | 'component'): void => {
    call('reach', { frame, id: picked.id, reach: next }).then(
      () => setReach(next),
      (error: unknown) => notify(messageOf(error), { stays: true }),
    );
  };
  return (
    <div
      className="segmented inspect-reach"
      role="group"
      aria-label="Which uses to edit"
    >
      <button
        type="button"
        aria-pressed={reach === 'use'}
        onClick={() => choose('use')}
      >
        This use
      </button>
      <button
        type="button"
        aria-pressed={reach === 'component'}
        onClick={() => choose('component')}
      >
        Every {component}
        {total !== null ? ` · ${uses(total)}` : null}
      </button>
    </div>
  );
}

/**
 * What can be changed on the pick's component: which uses, and its variants
 * (TRU-4.1, TRU-2.2). Each change goes to the Changes tray; nothing is written yet.
 * Each option shows on the page while it's pointed at.
 */
export function ComponentControls({
  frame,
  picked,
  inspection,
  call,
  notify,
  changes,
}: {
  frame: string;
  picked: Selection;
  inspection: Inspection;
  call: Props['call'];
  notify: Props['notify'];
  changes: Props['changes'];
}) {
  const { component } = inspection;
  if (!component) return null;
  const variants = component.variants.filter(
    (variant) => variant.options.length > 1,
  );
  const clear = (): void => {
    call('preview-classes', {
      frame,
      id: picked.id,
      add: [],
      remove: [],
    }).catch(() => {});
  };

  return (
    <section aria-label="Component" className="inspect-edit">
      <Suspense fallback={null}>
        <ReachPicker
          frame={frame}
          picked={picked}
          component={component.name}
          call={call}
          notify={notify}
        />
      </Suspense>
      {variants.map((variant) => {
        const shown =
          stagedValue(changes, picked, `variant ${variant.name}`) ??
          variant.value;
        return (
          <div key={variant.name} className="inspect-field">
            <span>{variant.name}</span>
            <ChoiceMenu
              name={variant.name}
              value={shown}
              choices={variant.options.map((option) => ({
                label: option,
                checked: option === shown,
                onPreview: (on) => {
                  if (on === null || option === shown) {
                    clear();
                    return;
                  }
                  call('preview-variant', {
                    frame,
                    id: picked.id,
                    name: variant.name,
                    value: option,
                  }).catch(() => {});
                },
                onChange: () => {
                  if (option === shown) {
                    clear();
                    return;
                  }
                  call('stage-variant', {
                    frame,
                    id: picked.id,
                    name: variant.name,
                    value: option,
                  }).catch((error: unknown) =>
                    notify(messageOf(error), { stays: true }),
                  );
                },
              }))}
            />
          </div>
        );
      })}
    </section>
  );
}

/** The words of an element that holds only text. The change goes to the tray (TRU-4.1). */
export function TextField({
  frame,
  picked,
  call,
  notify,
  changes,
}: {
  frame: string;
  picked: Selection;
  call: Props['call'];
  notify: Props['notify'];
  changes: Props['changes'];
}) {
  const { text } = picked;
  if (text === null) return null;
  const stage = (staging: Promise<unknown>): void => {
    staging.catch((error: unknown) =>
      notify(messageOf(error), { stays: true }),
    );
  };
  const stagedText = stagedValue(changes, picked, 'text');
  return (
    <label className="inspect-field">
      <span>Text</span>
      <textarea
        // A new page text (after Apply's hot reload) or a new staged one starts it afresh.
        key={`${picked.id}:${text}:${stagedText ?? ''}`}
        rows={2}
        defaultValue={stagedText ?? text}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          event.currentTarget.blur();
        }}
        onBlur={(event) => {
          const next = event.currentTarget.value;
          if (next === (stagedText ?? text)) return;
          stage(call('stage-text', { frame, id: picked.id, text: next }));
        }}
      />
    </label>
  );
}
