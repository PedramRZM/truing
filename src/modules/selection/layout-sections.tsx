import { type ReactNode, use, useState, useSyncExternalStore } from 'react';

import {
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartHorizontal,
  ArrowDown,
  ArrowRight,
  Ellipsis,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Monitor,
  RotateCw,
  Smartphone,
  Square,
  StretchHorizontal,
  Tablet,
  UnfoldHorizontal,
  UnfoldVertical,
  WrapText,
} from 'lucide-react';

import { messageOf, type PropertyPick, type StagedChange } from '../../module';
import {
  type Alignment,
  AlignmentPad,
  type PadValue,
} from '../../shell/controls/alignment-pad';
import { ChoiceMenu } from '../../shell/controls/choice-menu';
import { ScaleField } from '../../shell/controls/field';
import { ICON_STROKE } from '../../shell/controls/marks';
import {
  findStep,
  formatValue,
  nearestStep,
  type Step,
} from '../../shell/controls/scale';
import { SliderField } from '../../shell/controls/slider';
import { IconToggle, Segmented } from '../../shell/controls/toggles';
import { stepsOf, type TokenRow } from '../../shell/controls/token-rows';

import { useDesign } from './design-panel';
import { Row, Rows } from './design-rows';
import { sizingMode, trackCount } from './design-values';
import {
  activeClass,
  AXIS_CSS,
  axisOf,
  type ClassChange,
  classChange,
  degrees,
  type FamilyName,
  type FamilyRef,
  type FrameSize,
  fromWords,
  hideChange,
  isFlipped,
  ORDER_STEPS,
  pixels,
  ROTATE_STEPS,
  rotateClass,
  type ScopeChoice,
  SCOPES,
  SIZE_STEPS,
  SIZE_WORDS,
  type SizeChoice,
  sizeClass,
  sizeOfWidth,
  type SizeWord,
  sizeWordCss,
  spacingClass,
  stagedFor,
  stagedSizeChoice,
  type Target,
  targetOf,
  withNegatives,
  withStaged,
} from './layout-classes';
import type { Selection } from './module';
import type { Props } from './panel-shared';
import { holdPreview } from './preview-held';

export type BodyProps = Props & { pick: PropertyPick };

export const icon = {
  size: 14,
  absoluteStrokeWidth: true,
  strokeWidth: ICON_STROKE,
};

// ---------------------------------------------------------------------------
// The scope: one choice per kind of frame, for every section and pick.

const SCOPE_WORDS: Readonly<Record<ScopeChoice, string>> = {
  all: 'All sizes',
  up: 'From this size up',
  only: 'This size only',
};

const scopeChoices = new Map<FrameSize, ScopeChoice>();
const scopeListeners = new Set<() => void>();
let scopeVersion = 0;

function chooseScope(size: FrameSize, choice: ScopeChoice): void {
  scopeChoices.set(size, choice);
  scopeVersion += 1;
  for (const listener of scopeListeners) listener();
}

function subscribeScope(listener: () => void): () => void {
  scopeListeners.add(listener);
  return () => scopeListeners.delete(listener);
}

function useScope(size: FrameSize): ScopeChoice {
  useSyncExternalStore(subscribeScope, () => scopeVersion);
  const chosen = scopeChoices.get(size) ?? 'all';
  return SCOPES[size].includes(chosen) ? chosen : 'all';
}

// ---------------------------------------------------------------------------
// The project's spacing tokens, read once.

let spacingLookup: Promise<readonly TokenRow[]> | null = null;

export function spacingOf(call: Props['call']): Promise<readonly TokenRow[]> {
  spacingLookup ??= call('layout-tokens', {}).then(
    ({ spacing }) => spacing,
    (error: unknown) => {
      // The next pick tries again.
      spacingLookup = null;
      throw error;
    },
  );
  return spacingLookup;
}

// ---------------------------------------------------------------------------
// What every control needs: the pick as it stands, and how to change it.

export type Staging = {
  property: string;
  label: string;
  /** What the designer wants, for Claude: the scope's words follow. */
  intent: string;
  change: ClassChange;
  before: { value: string; token: string | null };
  after: { value: string; token: string | null };
  /** Other staged properties this one takes over. */
  replaces?: string[];
  /** What takes the value away at a use, where its class is in the component. */
  clearWith?: string;
};

export type Editor = {
  picked: Selection;
  classes: readonly string[];
  /** Computed styles, with what's staged laid over them. */
  own: Readonly<Record<string, string>>;
  parent: Readonly<Record<string, string>>;
  /** The frame's width: which classes hold, and what a scope means. */
  width: number;
  /** The element's measured box. */
  box: { width: number; height: number };
  target: Target;
  changes: Props['changes'];
  notify: Props['notify'];
  preview: (change: ClassChange | null) => void;
  stage: (staging: Staging) => Promise<void>;
};

export function useEditor(
  props: BodyProps,
  /** What a staged change sets besides its one property. */
  sets?: (change: StagedChange) => Readonly<Record<string, string>> | null,
): Editor | null {
  const { pick, frames, changes, call, notify } = props;
  const { picked } = useDesign();
  const width =
    frames.find((frame) => frame.id === pick.frame)?.width ??
    picked?.width ??
    0;
  const size = sizeOfWidth(width);
  const choice = useScope(size);
  if (!picked) return null;
  const { frame } = pick;
  const { id } = picked;
  const target = targetOf(size, choice);
  return {
    picked,
    classes: pick.classes,
    own: withStaged(pick.own, changes, picked, width, sets),
    parent: pick.parent,
    width,
    box: { width: pick.width, height: pick.height },
    target,
    changes,
    notify,
    preview: (change) => {
      holdPreview(
        Boolean(change && (change.add.length > 0 || change.remove.length > 0)),
      );
      call('preview-classes', {
        frame,
        id,
        add: change?.add ?? [],
        remove: change?.remove ?? [],
      }).catch(() => {
        // Only a preview: staging says if Truing can't be reached.
      });
    },
    stage: async ({ change, intent, ...staging }) => {
      holdPreview(false);
      try {
        await call('stage-classes', {
          frame,
          id,
          scope: target.scope,
          intent: `${intent} ${target.words}.`,
          add: change.add,
          remove: change.remove,
          ...staging,
        });
      } catch (error) {
        // Nothing was staged, so the page shouldn't go on showing it.
        call('preview-classes', { frame, id, add: [], remove: [] }).catch(
          () => {},
        );
        notify(messageOf(error), { stays: true });
        throw error;
      }
    },
  };
}

/** A control that changes a word, not a number: staged at once. */
export function stageWord(
  editor: Editor,
  {
    property,
    name,
    family,
    className,
    from,
    to,
    css,
    fromCss,
    intent,
    change,
    clearWith,
    replaces,
  }: {
    property: string;
    name: string;
    family: FamilyRef;
    /** Null only takes the family's classes away. */
    className: string | null;
    /** When it's more than one class for another (Hide). */
    change?: ClassChange;
    from: string;
    to: string;
    css: string;
    fromCss: string;
    intent: string;
    clearWith?: string;
    replaces?: string[];
  },
): void {
  editor
    .stage({
      property,
      label: `${name}: ${from} → ${to}`,
      intent,
      change:
        change ?? classChange(editor.classes, family, className, editor.target),
      before: { value: fromCss, token: null },
      after: { value: css, token: null },
      clearWith,
      replaces,
    })
    .catch(() => {
      // Already told, in the panel's notice.
    });
}

const FROM_ICON: Readonly<Record<FrameSize, typeof Tablet>> = {
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

/** A mark for where a value comes from: the size's icon, its words on hover. */
function fromMark(from: string): { words: string; mark: ReactNode } {
  const { words, size } = fromWords(from);
  const Icon = FROM_ICON[size];
  return { words, mark: <Icon aria-hidden {...icon} size={12} /> };
}

/** What sets a word control's value at a breakpoint, marked beside it. */
export function FromMarks({
  editor,
  families,
}: {
  editor: Editor;
  families: readonly FamilyRef[];
}) {
  const froms = new Set(
    families.flatMap((family) => {
      const from = activeClass(editor.classes, family, editor.width)?.from;
      return from ? [from] : [];
    }),
  );
  return [...froms].map((from) => {
    const { words, mark } = fromMark(from);
    return (
      <span
        key={from}
        className="field-from"
        role="img"
        aria-label={words}
        title={words}
      >
        {mark}
      </span>
    );
  });
}

/** Shows what an option would write while the pointer is on it; nothing is staged. */
export function peek(
  editor: Editor,
  family: FamilyRef,
  className: string | null | undefined,
): void {
  editor.preview(
    className === undefined
      ? null
      : classChange(editor.classes, family, className, editor.target),
  );
}

// ---------------------------------------------------------------------------
// A number on a scale, written as a class.

export function ClassField({
  editor,
  name,
  label,
  property,
  family,
  classOf,
  change,
  slider = false,
  steps,
  rows,
  value,
  unit,
  zeroText,
  measured = false,
  words,
  css = (next) => `${formatValue(next)}px`,
}: {
  editor: Editor;
  name: string;
  label: ReactNode;
  property: string;
  family: FamilyRef;
  classOf: (step: Step) => string;
  /** When a step writes more than its class: a size that keeps a style's weight. */
  change?: (step: Step) => ClassChange;
  /** A slider beside the number. */
  slider?: boolean;
  steps: readonly Step[];
  rows?: readonly TokenRow[];
  value: number;
  unit?: string;
  zeroText?: string;
  /** What the page lays out, not what a class says: it's off the scale only by hand. */
  measured?: boolean;
  /** A word from its menu: shown on the page, or chosen. */
  words?: (word: SizeWord, commit: boolean) => void;
  css?: (next: number) => string;
}) {
  // What was just committed, until the tray's next list says it.
  const [pending, setPending] = useState<{
    value: number;
    changes: Props['changes'];
  } | null>(null);
  const shown = pending?.changes === editor.changes ? pending.value : value;
  const stepAt = (at: number): Step =>
    findStep(steps, at) ?? { value: at, token: null };
  const changeTo = (next: number): ClassChange =>
    change?.(stepAt(next)) ??
    classChange(editor.classes, family, classOf(stepAt(next)), editor.target);
  const read = (at: number): string =>
    `${at === 0 && zeroText ? zeroText : formatValue(at)}${unit ?? ''}`;
  const active = activeClass(editor.classes, family, editor.width);
  const staged = stagedFor(
    editor.changes,
    editor.picked,
    editor.width,
    property,
  );
  let from = active?.from ?? null;
  if (staged && staged.scope !== 'all') {
    from =
      'from' in staged.scope
        ? staged.scope.from
        : staged.scope.only === 'Phone'
          ? 'max-md'
          : 'md:max-lg';
  } else if (staged) {
    from = null;
  }

  const Field = slider ? SliderField : ScaleField;
  return (
    <Field
      name={name}
      label={label}
      value={shown}
      steps={steps}
      unit={unit}
      zeroText={zeroText}
      from={from ? fromMark(from) : null}
      rows={rows}
      onWord={
        words ? (word, commit) => words(word as SizeWord, commit) : undefined
      }
      // A class by hand is off the scale even when its number is on it.
      off={active?.arbitrary ? true : measured ? false : undefined}
      notify={editor.notify}
      onPreview={(next) =>
        editor.preview(next === shown ? null : changeTo(next))
      }
      onCommit={(next) => {
        setPending({ value: next, changes: editor.changes });
        editor
          .stage({
            property,
            label: `${name}: ${read(shown)} → ${read(next)}`,
            intent: `Set ${name.toLowerCase()} to ${read(next).toLowerCase()}`,
            change: changeTo(next),
            before: { value: css(shown), token: stepAt(shown).token },
            after: { value: css(next), token: stepAt(next).token },
          })
          .catch(() => setPending(null));
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// The scope's row.

function ScopeRow({ editor }: { editor: Editor }) {
  const size = sizeOfWidth(editor.width);
  const choice = useScope(size);
  return (
    <div className="layout-fill">
      <Segmented
        name="Sizes a change applies to"
        value={choice}
        options={SCOPES[size].map((value) => ({
          value,
          label: SCOPE_WORDS[value],
        }))}
        onChange={(next) => chooseScope(size, next)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout: align in the parent, place, size, rotate, show.

type SelfValue = 'start' | 'center' | 'end' | 'stretch' | 'none';

const SELF_NAMES: Readonly<Record<Exclude<SelfValue, 'none'>, string>> = {
  start: 'Align to the start',
  center: 'Align to the centre',
  end: 'Align to the end',
  stretch: 'Stretch',
};

const SELF_WORDS: Readonly<Record<SelfValue, string>> = {
  start: 'Start',
  center: 'Centre',
  end: 'End',
  stretch: 'Stretch',
  none: 'As its parent says',
};

function selfOf(value: string | undefined): SelfValue {
  if (value === 'stretch') return 'stretch';
  if (value === 'center') return 'center';
  if (value === 'start' || value === 'flex-start') return 'start';
  return value === 'end' || value === 'flex-end' ? 'end' : 'none';
}

const inFlow = (parent: Readonly<Record<string, string>>): boolean =>
  /(?:flex|grid)$/.test(parent.display ?? '');

function SelfRow({ editor }: { editor: Editor }) {
  const now = selfOf(editor.own['align-self']);
  return (
    <div className="layout-row">
      <Segmented<SelfValue>
        name="Align in its parent"
        value={now}
        options={[
          {
            value: 'start',
            label: SELF_NAMES.start,
            icon: <AlignStartHorizontal aria-hidden {...icon} />,
          },
          {
            value: 'center',
            label: SELF_NAMES.center,
            icon: <AlignCenterHorizontal aria-hidden {...icon} />,
          },
          {
            value: 'end',
            label: SELF_NAMES.end,
            icon: <AlignEndHorizontal aria-hidden {...icon} />,
          },
          {
            value: 'stretch',
            label: SELF_NAMES.stretch,
            icon: <StretchHorizontal aria-hidden {...icon} />,
          },
        ]}
        onPreview={(next) =>
          peek(
            editor,
            'self',
            next === null || next === 'none' || next === now
              ? undefined
              : `self-${next}`,
          )
        }
        onChange={(next) => {
          if (next === 'none' || next === now) return;
          stageWord(editor, {
            property: 'align-self',
            name: 'Align in its parent',
            family: 'self',
            className: `self-${next}`,
            from: SELF_WORDS[now],
            to: SELF_WORDS[next],
            css: next,
            fromCss: editor.own['align-self'] ?? 'auto',
            intent:
              next === 'stretch'
                ? 'Stretch within its parent'
                : `${SELF_NAMES[next]} of its parent`,
          });
        }}
      />
      <FromMarks editor={editor} families={['self']} />
    </div>
  );
}

const SIZE_CHOICES: readonly SizeChoice[] = ['Fixed', 'Fit', 'Fill', 'Auto'];

const SIZE_CSS: Readonly<Record<Exclude<SizeChoice, 'Fixed'>, string>> = {
  Fit: 'fit-content',
  Fill: '100%',
  Auto: 'auto',
};

const SIZE_CLASS: Readonly<Record<Exclude<SizeChoice, 'Fixed'>, string>> = {
  Fit: 'fit',
  Fill: 'full',
  Auto: 'auto',
};

function SizeRow({
  editor,
  pick,
  axis,
}: {
  editor: Editor;
  pick: PropertyPick;
  axis: 'width' | 'height';
}) {
  const utility = axis === 'width' ? 'w' : 'h';
  const name = axis === 'width' ? 'Width' : 'Height';
  const staged = stagedFor(editor.changes, editor.picked, editor.width, axis);
  const stagedValue = staged?.after[0]?.value;
  const measured = editor.box[axis];
  const value =
    staged && !stagedSizeChoice(stagedValue) ? pixels(stagedValue) : measured;
  const hasAuto = activeClass(
    editor.classes,
    utility,
    editor.width,
  )?.className.endsWith(`${utility}-auto`);
  let choice: SizeChoice = hasAuto ? 'Auto' : sizingMode(axis, pick);
  if (staged) choice = stagedSizeChoice(stagedValue) ?? 'Fixed';

  return (
    <div className="layout-row">
      <ClassField
        editor={editor}
        name={name}
        label={axis === 'width' ? 'W' : 'H'}
        property={axis}
        family={utility}
        steps={SIZE_STEPS}
        classOf={(step) => sizeClass(utility, step.value)}
        value={value}
        measured
      />
      <Segmented<SizeChoice>
        name={`${name} sizing`}
        value={choice}
        options={SIZE_CHOICES.map((option) => ({
          value: option,
          label: option,
        }))}
        onPreview={(next) => {
          if (next === null || next === choice) {
            peek(editor, utility, undefined);
            return;
          }
          peek(
            editor,
            utility,
            next === 'Fixed'
              ? sizeClass(
                  utility,
                  nearestStep(SIZE_STEPS, measured)?.value ?? 0,
                )
              : `${utility}-${SIZE_CLASS[next]}`,
          );
        }}
        onChange={(next) => {
          if (next === choice) return;
          const fixed = nearestStep(SIZE_STEPS, measured)?.value ?? 0;
          // What it reads now, as a change back to the same number is a change.
          const fromCss =
            stagedValue ??
            (choice === 'Fixed'
              ? `${formatValue(measured)}px`
              : SIZE_CSS[choice]);
          if (next === 'Fixed') {
            stageWord(editor, {
              property: axis,
              name,
              family: utility,
              className: sizeClass(utility, fixed),
              from: choice,
              to: `Fixed ${formatValue(fixed)}`,
              css: `${formatValue(fixed)}px`,
              fromCss,
              intent: `Fix the ${axis} at ${formatValue(fixed)} px`,
            });
            return;
          }
          stageWord(editor, {
            property: axis,
            name,
            family: utility,
            className: `${utility}-${SIZE_CLASS[next]}`,
            from: choice,
            to: next,
            css: SIZE_CSS[next],
            fromCss,
            intent: `Set the ${axis} to ${next.toLowerCase()}`,
          });
        }}
      />
    </div>
  );
}

/** The words a min or max can be, for its menu: no number, so no step. */
const SIZE_WORD_ROWS: readonly TokenRow[] = SIZE_WORDS.map((word) => ({
  key: word,
  name: word,
  value: sizeWordCss(word),
  kind: 'spacing',
  hex: null,
  px: null,
  family: null,
}));

function LimitField({
  editor,
  kind,
  axis,
}: {
  editor: Editor;
  kind: 'min' | 'max';
  axis: 'width' | 'height';
}) {
  const utility = `${kind}-${axis === 'width' ? 'w' : 'h'}` as const;
  const property = `${kind}-${axis}`;
  const word = kind === 'min' ? 'Min' : 'Max';
  const none = kind === 'max';
  const now = editor.own[property] ?? '';
  // Not a number: a word set it, and it reads as that (`100%`).
  const reads = /^-?[\d.]/.test(now) && now.endsWith('px') ? null : now;
  const name = `${word} ${axis}`;
  return (
    <ClassField
      editor={editor}
      name={name}
      label={`${word} ${axis === 'width' ? 'W' : 'H'}`}
      property={property}
      family={utility}
      steps={SIZE_STEPS}
      zeroText={reads && reads !== 'none' ? reads : none ? 'None' : undefined}
      rows={SIZE_WORD_ROWS}
      words={(choice, commit) => {
        const className = `${utility}-${choice}`;
        if (!commit) {
          peek(editor, utility, className);
          return;
        }
        stageWord(editor, {
          property,
          name,
          family: utility,
          className,
          from: reads ?? formatValue(pixels(now)),
          to: choice,
          css: sizeWordCss(choice),
          fromCss: now,
          intent: `Set the ${name.toLowerCase()} to ${choice}`,
        });
      }}
      classOf={(step) =>
        none && step.value === 0
          ? `${utility}-none`
          : sizeClass(utility, step.value)
      }
      css={(next) => (none && next === 0 ? 'none' : `${formatValue(next)}px`)}
      value={pixels(editor.own[property])}
      measured
    />
  );
}

export function LayoutBody(props: BodyProps) {
  const editor = useEditor(props);
  const spacing = use(spacingOf(props.call));
  if (!editor) return null;
  const { own, parent } = editor;
  const placed = own.position === 'absolute' || own.position === 'fixed';
  const placeSteps = withNegatives(stepsOf(spacing));
  const flipped = (axis: 'x' | 'y'): boolean => {
    const staged = own[`scale-${axis}`];
    return staged === undefined
      ? isFlipped(own.scale, axis)
      : staged === 'flipped';
  };
  const flip = (axis: 'x' | 'y', on: boolean): void => {
    const way = axis === 'x' ? 'across' : 'up and down';
    stageWord(editor, {
      property: `scale-${axis}`,
      name: `Flip ${way}`,
      family: axis === 'x' ? 'flip-x' : 'flip-y',
      className: on ? `-scale-${axis}-100` : null,
      from: on ? 'Off' : 'On',
      to: on ? 'On' : 'Off',
      css: on ? 'flipped' : 'normal',
      fromCss: on ? 'normal' : 'flipped',
      intent: on
        ? `Flip the element ${way}`
        : `Stop flipping the element ${way}`,
    });
  };

  return (
    <div className="layout-stack">
      <ScopeRow editor={editor} />
      {inFlow(parent) ? <SelfRow editor={editor} /> : null}
      {placed ? (
        <div className="layout-pair">
          <ClassField
            editor={editor}
            name="X"
            label="X"
            property="left"
            family="left"
            steps={placeSteps}
            rows={spacing}
            classOf={(step) => spacingClass('left', step)}
            value={pixels(own.left)}
          />
          <ClassField
            editor={editor}
            name="Y"
            label="Y"
            property="top"
            family="top"
            steps={placeSteps}
            rows={spacing}
            classOf={(step) => spacingClass('top', step)}
            value={pixels(own.top)}
          />
        </div>
      ) : null}
      <SizeRow editor={editor} pick={props.pick} axis="width" />
      <SizeRow editor={editor} pick={props.pick} axis="height" />
      <div className="layout-pair">
        <LimitField editor={editor} kind="min" axis="width" />
        <LimitField editor={editor} kind="max" axis="width" />
        <LimitField editor={editor} kind="min" axis="height" />
        <LimitField editor={editor} kind="max" axis="height" />
      </div>
      <div className="layout-row">
        <ClassField
          editor={editor}
          name="Rotation"
          label={<RotateCw aria-hidden {...icon} />}
          property="rotate"
          family="rotate"
          steps={ROTATE_STEPS}
          unit="°"
          classOf={(step) => rotateClass(step.value)}
          css={(next) => `${formatValue(next)}deg`}
          value={degrees(own.rotate)}
        />
        <IconToggle
          label="Flip across"
          pressed={flipped('x')}
          onChange={(on) => flip('x', on)}
          onPreview={(on) =>
            peek(
              editor,
              'flip-x',
              on === null ? undefined : on ? '-scale-x-100' : null,
            )
          }
        >
          <FlipHorizontal aria-hidden {...icon} />
        </IconToggle>
        <IconToggle
          label="Flip up and down"
          pressed={flipped('y')}
          onChange={(on) => flip('y', on)}
          onPreview={(on) =>
            peek(
              editor,
              'flip-y',
              on === null ? undefined : on ? '-scale-y-100' : null,
            )
          }
        >
          <FlipVertical aria-hidden {...icon} />
        </IconToggle>
        <IconToggle
          label="Hide"
          pressed={own.display === 'none'}
          onPreview={(on) =>
            editor.preview(
              on === null
                ? null
                : hideChange(editor.classes, on, editor.target),
            )
          }
          onChange={(on) =>
            stageWord(editor, {
              property: 'display',
              name: 'Hide',
              family: 'hidden',
              className: null,
              change: hideChange(editor.classes, on, editor.target),
              from: on ? 'Off' : 'On',
              to: on ? 'On' : 'Off',
              css: on ? 'none' : 'block',
              fromCss: own.display ?? 'block',
              intent: on ? 'Hide this element' : 'Show this element',
            })
          }
        >
          <EyeOff aria-hidden {...icon} />
        </IconToggle>
        <FromMarks editor={editor} families={['hidden']} />
      </div>
      {inFlow(parent) ? (
        <ClassField
          editor={editor}
          name="Order"
          label="Order"
          property="order"
          family="order"
          steps={ORDER_STEPS}
          classOf={(step) => `order-${formatValue(step.value)}`}
          css={formatValue}
          value={pixels(own.order)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Padding and margin: two fields, or all four sides.

const SIDE_FIELDS = [
  { key: 'top', letter: 'T' },
  { key: 'right', letter: 'R' },
  { key: 'bottom', letter: 'B' },
  { key: 'left', letter: 'L' },
] as const;

const SIDE_UTILITY = {
  padding: {
    top: 'pt',
    right: 'pr',
    bottom: 'pb',
    left: 'pl',
    x: 'px',
    y: 'py',
  },
  margin: {
    top: 'mt',
    right: 'mr',
    bottom: 'mb',
    left: 'ml',
    x: 'mx',
    y: 'my',
  },
} as const satisfies Record<string, Record<string, FamilyName>>;

function SidesFields({
  editor,
  kind,
  rows,
}: {
  editor: Editor;
  kind: 'padding' | 'margin';
  rows: readonly TokenRow[];
}) {
  const word = kind === 'padding' ? 'Padding' : 'Margin';
  const utilities = SIDE_UTILITY[kind];
  const read = (side: string): number => pixels(editor.own[`${kind}-${side}`]);
  const steps =
    kind === 'padding' ? stepsOf(rows) : withNegatives(stepsOf(rows));
  const differs =
    read('top') !== read('bottom') || read('left') !== read('right');
  const [open, setOpen] = useState(differs);

  const field = (
    name: string,
    label: ReactNode,
    property: string,
    utility: FamilyName,
    value: number,
  ): ReactNode => (
    <ClassField
      key={property}
      editor={editor}
      name={name}
      label={label}
      property={property}
      family={utility}
      steps={steps}
      rows={rows}
      classOf={(step) => spacingClass(utility, step)}
      value={value}
    />
  );

  return (
    <div className="layout-row layout-sides">
      <div className="layout-pair">
        {open ? (
          SIDE_FIELDS.map(({ key, letter }) =>
            field(
              `${word} ${key}`,
              letter,
              `${kind}-${key}`,
              utilities[key],
              read(key),
            ),
          )
        ) : (
          <>
            {field(
              `${word} across`,
              <UnfoldHorizontal aria-hidden {...icon} />,
              `${kind}-inline`,
              utilities.x,
              read('left'),
            )}
            {field(
              `${word} up and down`,
              <UnfoldVertical aria-hidden {...icon} />,
              `${kind}-block`,
              utilities.y,
              read('top'),
            )}
          </>
        )}
      </div>
      <IconToggle
        label={`${word} on each side`}
        pressed={open}
        onChange={setOpen}
      >
        <Square aria-hidden {...icon} />
      </IconToggle>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flex and grid.

function GapField({
  editor,
  rows,
  column,
}: {
  editor: Editor;
  rows: readonly TokenRow[];
  /** Children run downwards: the gap that shows is the row gap. */
  column: boolean;
}) {
  const read = editor.own[column ? 'row-gap' : 'column-gap'];
  return (
    <ClassField
      editor={editor}
      name="Gap"
      label="Gap"
      property="gap"
      family="gap"
      steps={stepsOf(rows)}
      rows={rows}
      classOf={(step) => spacingClass('gap', step)}
      value={pixels(editor.own.gap ?? read)}
    />
  );
}

/**
 * Two axes' changes as one preview. An axis that stays put takes nothing away,
 * as `classChange` with no name would otherwise drop its class.
 */
function mergeChanges(changes: readonly ClassChange[]): ClassChange {
  const moved = changes.filter((change) => change.add.length > 0);
  return {
    add: moved.flatMap((change) => change.add),
    remove: moved.flatMap((change) => change.remove),
  };
}

const AXIS_WORDS: Readonly<Record<Alignment, string>> = {
  start: 'Start',
  center: 'Centre',
  end: 'End',
};

function stageAxis(
  editor: Editor,
  {
    property,
    name,
    family,
    prefix,
    from,
    to,
  }: {
    property: string;
    name: string;
    family: FamilyName;
    prefix: string;
    from: Alignment;
    to: Alignment;
  },
): void {
  stageWord(editor, {
    property,
    name,
    family,
    className: `${prefix}-${to}`,
    from: AXIS_WORDS[from],
    to: AXIS_WORDS[to],
    css: AXIS_CSS[to],
    fromCss: editor.own[property] ?? AXIS_CSS[from],
    intent: `${name} the children to the ${AXIS_WORDS[to].toLowerCase()}`,
  });
}

const DIRECTION_OPTIONS = [
  {
    value: 'column',
    label: 'Down',
    icon: <ArrowDown aria-hidden {...icon} />,
  },
  {
    value: 'row',
    label: 'Right',
    icon: <ArrowRight aria-hidden {...icon} />,
  },
] as const;

export function FlexBody(props: BodyProps) {
  const editor = useEditor(props);
  const rows = use(spacingOf(props.call));
  if (!editor) return null;
  const { own } = editor;
  const direction = own['flex-direction'] ?? 'row';
  const isRow = direction.startsWith('row');
  const wraps = (own['flex-wrap'] ?? 'nowrap') !== 'nowrap';
  const main = axisOf(own['justify-content'] ?? '');
  const cross = axisOf(own['align-items'] ?? '');
  const pad: PadValue = isRow ? { x: main, y: cross } : { x: cross, y: main };

  const padChange = (next: PadValue): ClassChange =>
    mergeChanges([
      classChange(
        editor.classes,
        'justify',
        (isRow ? next.x : next.y) === main
          ? null
          : `justify-${isRow ? next.x : next.y}`,
        editor.target,
      ),
      classChange(
        editor.classes,
        'items',
        (isRow ? next.y : next.x) === cross
          ? null
          : `items-${isRow ? next.y : next.x}`,
        editor.target,
      ),
    ]);

  const onPad = (next: PadValue): void => {
    const nextMain = isRow ? next.x : next.y;
    const nextCross = isRow ? next.y : next.x;
    if (nextMain !== main) {
      stageAxis(editor, {
        property: 'justify-content',
        name: 'Justify',
        family: 'justify',
        prefix: 'justify',
        from: main,
        to: nextMain,
      });
    }
    if (nextCross !== cross) {
      stageAxis(editor, {
        property: 'align-items',
        name: 'Align',
        family: 'items',
        prefix: 'items',
        from: cross,
        to: nextCross,
      });
    }
  };

  return (
    <div className="layout-stack">
      <div className="layout-flex">
        <AlignmentPad
          name="Align the children"
          value={pad}
          direction={isRow ? 'row' : 'column'}
          onChange={onPad}
          onPreview={(next) => editor.preview(next ? padChange(next) : null)}
        />
        <div className="layout-stack">
          <div className="layout-row">
            <Segmented
              name="Direction"
              value={isRow ? 'row' : 'column'}
              options={DIRECTION_OPTIONS}
              onPreview={(next) =>
                peek(
                  editor,
                  'direction',
                  next === null || next === (isRow ? 'row' : 'column')
                    ? undefined
                    : next === 'column'
                      ? 'flex-col'
                      : 'flex-row',
                )
              }
              onChange={(next) => {
                const down = next === 'column';
                stageWord(editor, {
                  property: 'flex-direction',
                  name: 'Direction',
                  family: 'direction',
                  className: down ? 'flex-col' : 'flex-row',
                  from: down ? 'Right' : 'Down',
                  to: down ? 'Down' : 'Right',
                  css: next,
                  fromCss: direction,
                  intent: down
                    ? 'Stack the children in a column'
                    : 'Lay the children out in a row',
                });
              }}
            />
            <FromMarks
              editor={editor}
              families={['direction', 'wrap', 'items', 'justify']}
            />
            <IconToggle
              label="Wrap"
              pressed={wraps}
              onPreview={(on) =>
                peek(
                  editor,
                  'wrap',
                  on === null ? undefined : on ? 'flex-wrap' : 'flex-nowrap',
                )
              }
              onChange={(on) =>
                stageWord(editor, {
                  property: 'flex-wrap',
                  name: 'Wrap',
                  family: 'wrap',
                  className: on ? 'flex-wrap' : 'flex-nowrap',
                  from: on ? 'Off' : 'On',
                  to: on ? 'On' : 'Off',
                  css: on ? 'wrap' : 'nowrap',
                  fromCss: own['flex-wrap'] ?? 'nowrap',
                  intent: on
                    ? 'Let the children wrap'
                    : 'Keep the children on one line',
                })
              }
            >
              <WrapText aria-hidden {...icon} />
            </IconToggle>
            <ChoiceMenu
              name="More alignment"
              icon={<Ellipsis aria-hidden {...icon} />}
              choices={[
                {
                  label: 'Space between',
                  checked: own['justify-content'] === 'space-between',
                  onPreview: (on) =>
                    peek(
                      editor,
                      'justify',
                      on === null
                        ? undefined
                        : on
                          ? 'justify-between'
                          : 'justify-start',
                    ),
                  onChange: (on) =>
                    stageWord(editor, {
                      property: 'justify-content',
                      name: 'Space between',
                      family: 'justify',
                      className: on ? 'justify-between' : 'justify-start',
                      from: on ? 'Off' : 'On',
                      to: on ? 'On' : 'Off',
                      css: on ? 'space-between' : 'flex-start',
                      fromCss: own['justify-content'] ?? 'normal',
                      intent: on
                        ? 'Space the children evenly between the ends'
                        : 'Stop spacing the children between the ends',
                    }),
                },
                {
                  label: 'Baseline',
                  checked: own['align-items'] === 'baseline',
                  onPreview: (on) =>
                    peek(
                      editor,
                      'items',
                      on === null
                        ? undefined
                        : on
                          ? 'items-baseline'
                          : 'items-start',
                    ),
                  onChange: (on) =>
                    stageWord(editor, {
                      property: 'align-items',
                      name: 'Baseline',
                      family: 'items',
                      className: on ? 'items-baseline' : 'items-start',
                      from: on ? 'Off' : 'On',
                      to: on ? 'On' : 'Off',
                      css: on ? 'baseline' : 'flex-start',
                      fromCss: own['align-items'] ?? 'normal',
                      intent: on
                        ? 'Align the children on their text baseline'
                        : 'Stop aligning the children on their baseline',
                    }),
                },
              ]}
            />
          </div>
          <GapField editor={editor} rows={rows} column={!isRow} />
        </div>
      </div>
      <SidesFields editor={editor} kind="padding" rows={rows} />
    </div>
  );
}

export function GridBody(props: BodyProps) {
  const editor = useEditor(props);
  const rows = use(spacingOf(props.call));
  if (!editor) return null;
  const { own } = editor;
  const x = axisOf(own['justify-items'] ?? '');
  const y = axisOf(own['align-items'] ?? '');
  const flow = (own['grid-auto-flow'] ?? 'row').startsWith('column')
    ? 'column'
    : 'row';
  return (
    <div className="layout-stack">
      <div className="layout-flex">
        <AlignmentPad
          name="Align the children"
          value={{ x, y }}
          direction={flow}
          onPreview={(next) =>
            editor.preview(
              next
                ? mergeChanges([
                    classChange(
                      editor.classes,
                      'justify-items',
                      next.x === x ? null : `justify-items-${next.x}`,
                      editor.target,
                    ),
                    classChange(
                      editor.classes,
                      'items',
                      next.y === y ? null : `items-${next.y}`,
                      editor.target,
                    ),
                  ])
                : null,
            )
          }
          onChange={(next) => {
            if (next.x !== x) {
              stageAxis(editor, {
                property: 'justify-items',
                name: 'Justify',
                family: 'justify-items',
                prefix: 'justify-items',
                from: x,
                to: next.x,
              });
            }
            if (next.y !== y) {
              stageAxis(editor, {
                property: 'align-items',
                name: 'Align',
                family: 'items',
                prefix: 'items',
                from: y,
                to: next.y,
              });
            }
          }}
        />
        <div className="layout-stack">
          <Segmented
            name="Direction"
            value={flow}
            options={DIRECTION_OPTIONS}
            onPreview={(next) =>
              peek(
                editor,
                'flow',
                next === null || next === flow
                  ? undefined
                  : next === 'column'
                    ? 'grid-flow-col'
                    : 'grid-flow-row',
              )
            }
            onChange={(next) => {
              const down = next === 'column';
              stageWord(editor, {
                property: 'grid-auto-flow',
                name: 'Direction',
                family: 'flow',
                className: down ? 'grid-flow-col' : 'grid-flow-row',
                from: down ? 'Right' : 'Down',
                to: down ? 'Down' : 'Right',
                css: next,
                fromCss: flow,
                intent: down
                  ? 'Fill the grid column by column'
                  : 'Fill the grid row by row',
              });
            }}
          />
          <GapField editor={editor} rows={rows} column={false} />
        </div>
      </div>
      <Rows>
        <Row label="Columns">
          {trackCount(own['grid-template-columns'] ?? '')}
        </Row>
        <Row label="Rows">{trackCount(own['grid-template-rows'] ?? '')}</Row>
      </Rows>
    </div>
  );
}

export function SpacingBody(props: BodyProps) {
  const editor = useEditor(props);
  const rows = use(spacingOf(props.call));
  if (!editor) return null;
  // Flex holds a frame's padding, as Paper's does.
  const flex = (props.pick.own.display ?? '').endsWith('flex');
  return (
    <div className="layout-stack">
      {flex ? null : <SidesFields editor={editor} kind="padding" rows={rows} />}
      <SidesFields editor={editor} kind="margin" rows={rows} />
    </div>
  );
}
