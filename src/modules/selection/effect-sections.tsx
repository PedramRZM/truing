import { type CSSProperties, useState } from 'react';
import { use } from 'react';

import { Plus, Type } from 'lucide-react';

import { messageOf, type PropertyPick } from '../../module';
import { ChoiceMenu } from '../../shell/controls/choice-menu';
import { ScaleField, TokenField } from '../../shell/controls/field';
import { FoldSummary } from '../../shell/controls/fold';
import { formatValue, type Step } from '../../shell/controls/scale';
import { IconToggle, Segmented } from '../../shell/controls/toggles';
import { stepsOf, type TokenRow } from '../../shell/controls/token-rows';

import { useDesign } from './design-panel';
import { Row, Rows } from './design-rows';
import { colourText, isClear } from './design-values';
import {
  ANIMATION,
  ASPECT,
  BACKGROUND_FIT,
  BACKGROUND_PLACE,
  BACKGROUND_REPEAT,
  CLIP_FAMILY,
  COLUMN_SPAN,
  CURSOR,
  DIRECTIONS,
  DISPLAY,
  EASING,
  type FilterSpec,
  FILTERS,
  filterProperty,
  filtersOf,
  GRADIENT_FAMILIES,
  GRADIENT_PROPERTIES,
  gradientCss,
  gradientGone,
  type GradientKind,
  GROW,
  holdsClassOf,
  IMAGE_FIT,
  IMAGE_PLACE,
  imageUrlOf,
  INSET_FAMILY,
  INSET_NAMES,
  innerShadow,
  ITALIC,
  LINES,
  OUTLINE_FAMILIES,
  OVERFLOW,
  POINTER_EVENTS,
  POSITION,
  readGradient,
  RING_FAMILIES,
  ringOf,
  ROW_SPAN,
  SELECT_TEXT,
  shapeClass,
  SHRINK,
  solidToGradient,
  STACK,
  STOP_NAMES,
  STOP_STEPS,
  type StopName,
  STRIKE,
  TEXT_CASE,
  TRANSITION,
  VISIBILITY,
  type WordControl,
} from './effect-classes';
import {
  activeClass,
  type ClassChange,
  classChange,
  type Family,
  type FamilyName,
  parseClass,
  pixels,
  SIZE_STEPS,
  sizeClass,
  spacingClass,
  stagedFor,
  stagedOn,
  withNegatives,
} from './layout-classes';
import {
  type BodyProps,
  ClassField,
  type Editor,
  icon,
  peek,
  spacingOf,
  stageWord,
} from './layout-sections';
import { clearChange, familyOf } from './style-classes';
import type { StyleTokens } from './style-classes';
import {
  coloursFor,
  colourWords,
  colourOf,
  FILL,
  ignore,
  RemoveButton,
  SolidFill,
  useStyleEditor,
} from './style-sections';
import { WordRow } from './word-row';

const WIDTH_STEPS: readonly Step[] = [0, 1, 2, 4, 8].map((value) => ({
  value,
  token: null,
}));

/** The pick's classes with what's staged on them: what a control reads before the page does. */
function classesWithStaged(editor: Editor): string[] {
  let list = [...editor.classes];
  for (const change of stagedOn(editor.changes, editor.picked, editor.width)) {
    const edit = change.write?.by === 'edit' ? change.write.edit : null;
    if (edit?.kind !== 'classes') continue;
    list = list.filter((name) => !edit.remove.includes(name));
    list.push(...edit.add);
  }
  return list;
}

/** A colour written with its own utility: a gradient's stop, a ring, an icon's fill (TRU-4.5). */
function ClassColour({
  editor,
  tokens,
  name,
  label,
  property,
  family,
  utility,
  colour,
  what,
}: {
  editor: Editor;
  tokens: StyleTokens;
  name: string;
  label?: string;
  property: string;
  family: Family;
  /** `from`, `ring`, `fill`. */
  utility: string;
  /** What the page shows. */
  colour: string;
  /** What it is, for Claude. */
  what: string;
}) {
  const rows = coloursFor(editor, tokens);
  const classes = classesWithStaged(editor);
  const active = activeClass(classes, family, editor.width);
  const base = active ? parseClass(active.className).base : null;
  const tokenName =
    base && !active?.arbitrary ? base.slice(utility.length + 1) : null;
  const row = rows.find((entry) => entry.name === tokenName);
  const swatch = row?.hex ?? colour;
  const text = isClear(swatch) ? 'Transparent' : colourText(swatch);
  const shown = tokenName ?? (colour === 'none' ? 'None' : text);
  const classFor = (next: TokenRow): string => `${utility}-${next.name}`;
  return (
    <TokenField
      name={name}
      label={label}
      value={shown}
      swatch={colour === 'none' && !row ? undefined : swatch}
      detail={tokenName && !isClear(swatch) ? text : undefined}
      off={active?.arbitrary ?? false}
      rows={rows}
      current={row?.key ?? null}
      onPreview={(next) =>
        peek(editor, family, next ? classFor(next) : undefined)
      }
      onChoose={(next) => {
        editor
          .stage({
            property,
            label: `${name}: ${shown} → ${next.name}`,
            intent: `Set the ${what} to ${next.name}`,
            change: classChange(
              editor.classes,
              family,
              classFor(next),
              editor.target,
            ),
            before: { value: text, token: tokenName },
            after: { value: next.hex ?? next.value, token: next.name },
          })
          .catch(ignore);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Fill: solid, gradient or image.

type FillKind = 'solid' | 'gradient' | 'image';

const FILL_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'image', label: 'Image' },
] as const;

const SHAPES = [
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
  { value: 'conic', label: 'Conic' },
] as const;

const PICK_AN_IMAGE = 'choosing an image changes the source and its assets';

function StopRow({
  editor,
  tokens,
  stop,
  colour,
  position,
  onRemove,
}: {
  editor: Editor;
  tokens: StyleTokens;
  stop: StopName;
  colour: string;
  position: number;
  onRemove?: () => void;
}) {
  const name = STOP_NAMES[stop];
  return (
    <div className="gradient-stop">
      <ClassColour
        editor={editor}
        tokens={tokens}
        name={`Gradient ${name.toLowerCase()}`}
        label={name}
        property={`gradient-${stop}`}
        family={GRADIENT_FAMILIES[stop]}
        utility={stop}
        colour={colour}
        what={`gradient's ${name.toLowerCase()} colour`}
      />
      <ClassField
        editor={editor}
        name={`${name} position`}
        label="At"
        unit="%"
        property={`gradient-${stop}-position`}
        family={GRADIENT_FAMILIES[`${stop}-position`]}
        steps={STOP_STEPS}
        classOf={(step) => `${stop}-${formatValue(step.value)}%`}
        css={formatValue}
        value={position}
      />
      {onRemove ? (
        <RemoveButton
          name="middle colour"
          onPreview={() => {}}
          onRemove={onRemove}
        />
      ) : null}
    </div>
  );
}

function GradientFields({
  editor,
  tokens,
  css,
}: {
  editor: Editor;
  tokens: StyleTokens;
  /** The computed `background-image`, as the page has it. */
  css: string;
}) {
  const classes = classesWithStaged(editor);
  const reading = readGradient(classes, css, editor.width);
  const rows = coloursFor(editor, tokens);
  const seen = (stop: {
    token: string | null;
    colour: string | null;
  }): string =>
    rows.find((row) => row.name === stop.token)?.hex ??
    (stop.token === 'transparent'
      ? 'transparent'
      : (stop.colour ?? 'transparent'));
  const drawn = gradientCss({
    ...reading,
    from: { ...reading.from, colour: seen(reading.from) },
    via: reading.via && { ...reading.via, colour: seen(reading.via) },
    to: { ...reading.to, colour: seen(reading.to) },
  });
  const bar = (
    <span
      className="gradient-bar"
      style={{ '--gradient': drawn } as CSSProperties}
      aria-hidden="true"
    />
  );
  if (!reading.written) {
    return (
      <div className="layout-stack">
        {bar}
        <Rows>
          <Row label="Direction" title={css}>
            {reading.directionText}
          </Row>
        </Rows>
        <p className="module-empty">
          Written by hand, so it can only be read here.
        </p>
      </div>
    );
  }
  const shape = (
    kind: GradientKind,
    direction = reading.direction,
  ): ClassChange =>
    classChange(
      editor.classes,
      GRADIENT_FAMILIES.shape,
      shapeClass(editor.classes, kind, direction),
      editor.target,
    );
  const clipped = classes.some(
    (name) => parseClass(name).base === 'bg-clip-text',
  );
  const clipOn: ClassChange = {
    add: ['bg-clip-text', 'text-transparent'].map(
      (name) => `${editor.target.prefix}${name}`,
    ),
    remove: [],
  };
  const clipOff = clearChange(
    editor.classes,
    [CLIP_FAMILY, { own: /^text-transparent$/ }],
    'bg-clip-border',
    editor.target,
  );
  return (
    <div className="layout-stack">
      {bar}
      <div className="layout-fill">
        <Segmented<GradientKind>
          name="Gradient shape"
          value={reading.kind}
          options={SHAPES}
          onPreview={(next) =>
            editor.preview(
              next === null || next === reading.kind ? null : shape(next),
            )
          }
          onChange={(next) => {
            if (next === reading.kind) return;
            stageWord(editor, {
              property: 'gradient-shape',
              name: 'Gradient',
              family: GRADIENT_FAMILIES.shape,
              className: null,
              change: shape(next),
              from: reading.kind,
              to: next,
              css: next,
              fromCss: reading.kind,
              intent: `Make the gradient ${next}`,
            });
          }}
        />
      </div>
      {reading.kind === 'linear' ? (
        <div className="word-row">
          <span className="word-label">Direction</span>
          <ChoiceMenu
            name="Gradient direction"
            value={reading.directionText}
            choices={DIRECTIONS.map((direction) => ({
              label: direction.label,
              checked: direction.name === reading.direction,
              onPreview: (on) =>
                editor.preview(
                  on === null ? null : shape('linear', direction.name),
                ),
              onChange: () => {
                if (direction.name === reading.direction) return;
                stageWord(editor, {
                  property: 'gradient-shape',
                  name: 'Gradient direction',
                  family: GRADIENT_FAMILIES.shape,
                  className: null,
                  change: shape('linear', direction.name),
                  from: reading.directionText,
                  to: direction.label,
                  css: direction.css,
                  fromCss: reading.direction ?? '',
                  intent: `Run the gradient ${direction.label.toLowerCase()}`,
                });
              },
            }))}
          />
        </div>
      ) : null}
      <StopRow
        editor={editor}
        tokens={tokens}
        stop="from"
        colour={seen(reading.from)}
        position={reading.from.position}
      />
      {reading.via ? (
        <StopRow
          editor={editor}
          tokens={tokens}
          stop="via"
          colour={seen(reading.via)}
          position={reading.via.position}
          onRemove={() =>
            stageWord(editor, {
              property: 'gradient-via',
              name: 'Gradient middle',
              family: GRADIENT_FAMILIES.via,
              className: null,
              from: reading.via?.token ?? 'Set',
              to: 'None',
              css: 'none',
              fromCss: reading.via?.token ?? 'set',
              intent: "Remove the gradient's middle colour",
              replaces: ['gradient-via-position'],
            })
          }
        />
      ) : (
        <div className="word-row">
          <span className="word-label">Middle</span>
          <TokenField
            name="Add a middle colour"
            value="None"
            rows={rows}
            onPreview={(row) =>
              peek(
                editor,
                GRADIENT_FAMILIES.via,
                row ? `via-${row.name}` : undefined,
              )
            }
            onChoose={(row) => {
              stageWord(editor, {
                property: 'gradient-via',
                name: 'Gradient middle',
                family: GRADIENT_FAMILIES.via,
                className: `via-${row.name}`,
                from: 'None',
                to: row.name,
                css: row.hex ?? row.value,
                fromCss: 'none',
                intent: `Add ${row.name} as the gradient's middle colour`,
              });
            }}
          />
        </div>
      )}
      <StopRow
        editor={editor}
        tokens={tokens}
        stop="to"
        colour={seen(reading.to)}
        position={reading.to.position}
      />
      <div className="word-row">
        <span className="word-label">Clip to text</span>
        <IconToggle
          label="Clip to text"
          pressed={clipped}
          onPreview={(on) =>
            editor.preview(on === null ? null : on ? clipOn : clipOff)
          }
          onChange={(on) =>
            stageWord(editor, {
              property: 'background-clip',
              name: 'Clip to text',
              family: CLIP_FAMILY,
              className: null,
              change: on ? clipOn : clipOff,
              from: on ? 'Off' : 'On',
              to: on ? 'On' : 'Off',
              css: on ? 'text' : 'border-box',
              fromCss: on ? 'border-box' : 'text',
              intent: on
                ? 'Show the gradient through the text'
                : 'Stop showing the gradient through the text',
              clearWith: 'bg-clip-border',
            })
          }
        >
          <Type aria-hidden {...icon} />
        </IconToggle>
      </div>
    </div>
  );
}

function ImageFields({
  editor,
  pick,
  props,
}: {
  editor: Editor;
  pick: PropertyPick;
  props: BodyProps;
}) {
  const isImg = pick.tag === 'img';
  const url = pick.src ?? imageUrlOf(pick.own['background-image'] ?? '');
  const controls: readonly WordControl[] = isImg
    ? [IMAGE_FIT, IMAGE_PLACE]
    : url
      ? [BACKGROUND_FIT, BACKGROUND_PLACE, BACKGROUND_REPEAT]
      : [];
  return (
    <div className="layout-stack">
      {url ? <img className="image-fill" src={url} alt="" /> : null}
      {controls.map((control) => (
        <WordRow key={control.name} editor={editor} control={control} />
      ))}
      <label className="inspect-field">
        <span>Image path or URL</span>
        <input
          type="text"
          key={url ?? ''}
          defaultValue=""
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim();
            if (next === '') return;
            props
              .call('stage-intent', {
                frame: pick.frame,
                id: editor.picked.id,
                property: 'image-source',
                label: `Image: ${next}`,
                intent: `Use the image at ${next} here`,
                reason: PICK_AN_IMAGE,
                after: { value: next, token: null },
              })
              .catch((error: unknown) =>
                props.notify(messageOf(error), { stays: true }),
              );
          }}
        />
      </label>
    </div>
  );
}

export function FillBody(props: BodyProps) {
  const { pick } = props;
  const { editor, tokens } = useStyleEditor(props);
  const { styles } = useDesign();
  const [wantsImage, setWantsImage] = useState(false);
  if (!editor) return null;
  if (pick.kind === 'text') return <SolidFill {...props} />;
  if (pick.tag === 'img') {
    return <ImageFields editor={editor} pick={pick} props={props} />;
  }
  const image = editor.own['background-image'] ?? 'none';
  let kind: FillKind = 'solid';
  if (image.includes('gradient')) kind = 'gradient';
  else if (image !== 'none') kind = 'image';
  else if (wantsImage) kind = 'image';
  const family = familyOf(styles, 'fill');
  const words = colourWords(colourOf(editor, styles, FILL));
  const rows = coloursFor(editor, tokens);
  const fillNow = words.name ?? words.text;
  const startsFrom = words.name ?? rows[0]?.name ?? 'primary';
  const gradientNow = readGradient(
    classesWithStaged(editor),
    pick.own['background-image'] ?? '',
    editor.width,
  );
  const backTo = gradientNow.from.token;
  const backRow =
    rows.find((row) => row.name === backTo && row.hex !== null) ?? rows[0];
  const toGradient = solidToGradient(
    editor.classes,
    family,
    startsFrom,
    editor.target,
  );
  const gone = gradientGone(editor.classes, editor.target);
  const toSolid: ClassChange = backRow
    ? {
        add: [`${editor.target.prefix}bg-${backRow.name}`],
        remove: gone.remove,
      }
    : gone;
  const choose = (next: FillKind): void => {
    setWantsImage(next === 'image');
    if (next === kind) return;
    if (next === 'gradient') {
      stageWord(editor, {
        property: 'background-image',
        name: 'Fill',
        family,
        className: null,
        change: toGradient,
        from: kind === 'solid' ? fillNow : 'Image',
        to: 'Gradient',
        css: 'gradient',
        fromCss: image,
        intent: `Fill with a gradient from ${startsFrom} to transparent`,
        replaces: ['background-color', ...GRADIENT_PROPERTIES],
      });
      return;
    }
    if (next === 'solid' && kind === 'gradient') {
      stageWord(editor, {
        property: 'background-image',
        name: 'Fill',
        family,
        className: null,
        change: toSolid,
        from: 'Gradient',
        to: backRow?.name ?? 'None',
        css: 'none',
        fromCss: image,
        intent: `Fill with ${backRow?.name ?? 'nothing'} in place of the gradient`,
        replaces: ['background-color', ...GRADIENT_PROPERTIES],
      });
    }
  };
  return (
    <div className="layout-stack">
      <div className="layout-fill">
        <Segmented<FillKind>
          name="Fill kind"
          value={kind}
          options={FILL_OPTIONS}
          onPreview={(next) => {
            if (next === 'gradient' && kind !== 'gradient') {
              editor.preview(toGradient);
            } else if (next === 'solid' && kind === 'gradient') {
              editor.preview(toSolid);
            } else {
              editor.preview(null);
            }
          }}
          onChange={choose}
        />
      </div>
      {kind === 'gradient' ? (
        <GradientFields
          editor={editor}
          tokens={tokens}
          css={pick.own['background-image'] ?? ''}
        />
      ) : null}
      {kind === 'image' ? (
        <ImageFields editor={editor} pick={pick} props={props} />
      ) : null}
      {kind === 'solid' ? <SolidFill {...props} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout's other values.

const SCALE_STEPS: readonly Step[] = [
  0, 50, 75, 90, 95, 100, 105, 110, 125, 150,
].map((value) => ({ value, token: null }));

const SCALE_FAMILY: Family = { own: /^scale-\d/ };

const inGrid = (parent: Readonly<Record<string, string>>): boolean =>
  (parent.display ?? '').endsWith('grid');
const inFlex = (parent: Readonly<Record<string, string>>): boolean =>
  (parent.display ?? '').endsWith('flex');

/** What a computed `scale` reads, as a percentage: none is 100. */
function scaleOf(own: Readonly<Record<string, string>>): number {
  const css = own.scale ?? 'none';
  if (css === 'none' || css === '') return 100;
  const first = css.split(/\s+/)[0] ?? '1';
  return Math.round(
    first.endsWith('%')
      ? Math.abs(Number.parseFloat(first))
      : Math.abs(Number.parseFloat(first)) * 100,
  );
}

/** How far a computed `translate` moves on an axis, staged first. */
function moveOf(
  own: Readonly<Record<string, string>>,
  axis: 'x' | 'y',
): number {
  const staged = own[`translate-${axis}`];
  if (staged !== undefined) return pixels(staged);
  const parts = (own.translate ?? '').trim().split(/\s+/);
  return pixels(axis === 'x' ? parts[0] : parts[1]);
}

function MoveField({ editor, axis }: { editor: Editor; axis: 'x' | 'y' }) {
  const utility = `translate-${axis}`;
  return (
    <ClassField
      editor={editor}
      name={`Move ${axis === 'x' ? 'across' : 'up and down'}`}
      label={`Move ${axis.toUpperCase()}`}
      property={utility}
      family={{ own: new RegExp(`^${utility}-`) }}
      steps={withNegatives(SIZE_STEPS)}
      classOf={(step) =>
        `${step.value < 0 ? '-' : ''}${sizeClass(utility, Math.abs(step.value))}`
      }
      value={moveOf(editor.own, axis)}
    />
  );
}

/** Beside X and Y: what the app places from the far edges. */
function FarEdges({
  editor,
  rows,
}: {
  editor: Editor;
  rows: readonly TokenRow[];
}) {
  const steps = withNegatives(stepsOf(rows));
  const field = (
    name: string,
    label: string,
    side: FamilyName & ('right' | 'bottom'),
  ) => (
    <ClassField
      editor={editor}
      name={name}
      label={label}
      property={side}
      family={side}
      steps={steps}
      rows={rows}
      classOf={(step) => spacingClass(side, step)}
      value={pixels(editor.own[side])}
    />
  );
  return (
    <div className="layout-pair">
      {field('Right', 'R', 'right')}
      {field('Bottom', 'B', 'bottom')}
    </div>
  );
}

export function LayoutMore(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  const spacing = use(spacingOf(props.call));
  if (!editor) return null;
  const { own, parent } = editor;
  const placed = own.position === 'absolute' || own.position === 'fixed';
  return (
    <div className="layout-stack">
      <WordRow editor={editor} control={DISPLAY} />
      <WordRow editor={editor} control={POSITION} />
      {placed ? <FarEdges editor={editor} rows={spacing} /> : null}
      <WordRow editor={editor} control={OVERFLOW} />
      <details className="design-more">
        <FoldSummary>More</FoldSummary>
        <div className="layout-stack">
          <WordRow editor={editor} control={STACK} />
          <WordRow editor={editor} control={ASPECT} />
          {inFlex(parent) ? (
            <>
              <WordRow editor={editor} control={GROW} />
              <WordRow editor={editor} control={SHRINK} />
            </>
          ) : null}
          {inGrid(parent) ? (
            <>
              <WordRow editor={editor} control={COLUMN_SPAN} />
              <WordRow editor={editor} control={ROW_SPAN} />
            </>
          ) : null}
          <ClassField
            editor={editor}
            name="Scale"
            label="Scale"
            unit="%"
            property="scale"
            family={SCALE_FAMILY}
            steps={SCALE_STEPS}
            classOf={(step) => `scale-${formatValue(step.value)}`}
            css={(next) => `${formatValue(next)}%`}
            value={scaleOf(own)}
          />
          <div className="layout-pair">
            <MoveField editor={editor} axis="x" />
            <MoveField editor={editor} axis="y" />
          </div>
          <WordRow editor={editor} control={VISIBILITY} />
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text's other values.

export function TextMore(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  return (
    <div className="layout-stack">
      <WordRow editor={editor} control={TEXT_CASE} />
      <WordRow editor={editor} control={ITALIC} />
      <WordRow editor={editor} control={STRIKE} />
      <WordRow editor={editor} control={LINES} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters: one row each, added and taken away on their own.

const isSet = (css: string | undefined): boolean =>
  css !== undefined && css !== '' && css !== 'none';

/** The computed filters no row reads: a `drop-shadow`, a `hue-rotate`. */
function otherFilters(css: string, backdrop: boolean): string | null {
  if (!isSet(css)) return null;
  const known = FILTERS.filter(
    (spec) => Boolean(spec.backdrop) === backdrop,
  ).map((spec) => spec.fn);
  const rest = [...css.matchAll(/([a-z-]+)\([^()]*\)/g)]
    .filter((match) => !known.includes(match[1] ?? ''))
    .map((match) => match[0]);
  return rest.length > 0 ? rest.join(' ') : null;
}

export const hasFilters = (pick: PropertyPick): boolean =>
  filtersOf(pick.own).size > 0 ||
  otherFilters(pick.own.filter ?? '', false) !== null ||
  otherFilters(pick.own['backdrop-filter'] ?? '', true) !== null;

function filterOff(editor: Editor, spec: FilterSpec): ClassChange {
  return clearChange(
    editor.classes,
    [spec.family],
    spec.clearWith,
    editor.target,
  );
}

function setFilter(editor: Editor, spec: FilterSpec, on: boolean): void {
  stageWord(editor, {
    property: filterProperty(spec),
    name: spec.name,
    family: spec.family,
    className: on ? spec.classOf(spec.start) : null,
    change: on ? undefined : filterOff(editor, spec),
    from: on ? 'None' : 'On',
    to: on ? `${spec.start}${spec.unit}` : 'None',
    css: on ? String(spec.start) : 'none',
    fromCss: on ? 'none' : 'on',
    intent: on
      ? `Add ${spec.name.toLowerCase()} at ${spec.start}${spec.unit}`
      : `Remove the ${spec.name.toLowerCase()}`,
    clearWith: on ? undefined : spec.clearWith,
  });
}

export function FiltersAdd(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  const on = filtersOf(editor.own);
  return (
    <ChoiceMenu
      name="Add filter"
      icon={<Plus aria-hidden {...icon} size={16} />}
      choices={FILTERS.map((spec) => ({
        label: spec.name,
        checked: on.has(spec),
        onPreview: (next) => {
          if (next === null) {
            editor.preview(null);
            return;
          }
          editor.preview(
            next
              ? classChange(
                  editor.classes,
                  spec.family,
                  spec.classOf(spec.start),
                  editor.target,
                )
              : filterOff(editor, spec),
          );
        },
        onChange: (next) => setFilter(editor, spec, next),
      }))}
    />
  );
}

export function FiltersBody(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  const on = filtersOf(editor.own);
  const front = otherFilters(editor.own.filter ?? '', false);
  const behind = otherFilters(editor.own['backdrop-filter'] ?? '', true);
  return (
    <div className="layout-stack">
      {[...on].map(([spec, value]) => (
        <div key={spec.id} className="layout-row">
          <ClassField
            slider
            editor={editor}
            name={spec.name}
            label={spec.name}
            unit={spec.unit || undefined}
            property={filterProperty(spec)}
            family={spec.family}
            steps={spec.steps}
            classOf={(step) => spec.classOf(step.value)}
            css={formatValue}
            value={value}
          />
          <RemoveButton
            name={spec.name.toLowerCase()}
            onPreview={(hovering) =>
              editor.preview(hovering ? filterOff(editor, spec) : null)
            }
            onRemove={() => setFilter(editor, spec, false)}
          />
        </div>
      ))}
      {front || behind ? (
        <Rows>
          {front ? (
            <Row label="Other" title={front}>
              {front}
            </Row>
          ) : null}
          {behind ? (
            <Row label="Backdrop" title={behind}>
              {behind}
            </Row>
          ) : null}
        </Rows>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner shadow.

const INNER: WordControl = {
  name: 'Inner shadow',
  property: 'inset-shadow',
  family: INSET_FAMILY,
  words: [
    {
      label: 'None',
      className: null,
      css: 'none',
      clearWith: 'inset-shadow-none',
    },
    ...INSET_NAMES.map((name) => ({
      label: name,
      className: `inset-shadow-${name}`,
      css: name,
    })),
  ],
};

export const hasInnerShadow = (pick: PropertyPick): boolean => {
  const staged = pick.own['inset-shadow'];
  if (staged !== undefined) return staged !== 'none';
  return (
    holdsClassOf(pick.classes, INSET_FAMILY) ||
    innerShadow(pick.own['box-shadow'] ?? '') !== null
  );
};

export function InnerShadowAdd(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  return (
    <button
      type="button"
      className="tool"
      aria-label="Add inner shadow"
      title="Add inner shadow"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          peek(editor, INSET_FAMILY, 'inset-shadow-sm');
        }
      }}
      onPointerLeave={() => peek(editor, INSET_FAMILY, undefined)}
      onClick={() =>
        stageWord(editor, {
          property: 'inset-shadow',
          name: 'Inner shadow',
          family: INSET_FAMILY,
          className: 'inset-shadow-sm',
          from: 'None',
          to: 'sm',
          css: 'sm',
          fromCss: 'none',
          intent: 'Add the sm inner shadow',
        })
      }
    >
      <Plus aria-hidden {...icon} size={16} />
    </button>
  );
}

export function InnerShadowBody(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  return <WordRow editor={editor} control={INNER} unknown="Custom" />;
}

// ---------------------------------------------------------------------------
// Outline: a ring where the element has one, an outline otherwise.

export const hasOutline = (pick: PropertyPick): boolean => {
  const staged = pick.own['ring-width'];
  if (staged !== undefined) return staged !== '0px';
  if (holdsClassOf(pick.classes, RING_FAMILIES.width)) return true;
  if (ringOf(pick.own['box-shadow'] ?? '') !== null) return true;
  return (
    pick.own['outline-style'] !== 'none' &&
    pixels(pick.own['outline-width']) > 0
  );
};

export function OutlineAdd(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  const { width } = OUTLINE_FAMILIES;
  return (
    <button
      type="button"
      className="tool"
      aria-label="Add outline"
      title="Add outline"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') peek(editor, width, 'outline-1');
      }}
      onPointerLeave={() => peek(editor, width, undefined)}
      onClick={() =>
        stageWord(editor, {
          property: 'outline-width',
          name: 'Outline',
          family: width,
          className: 'outline-1',
          from: 'None',
          to: '1',
          css: '1px',
          fromCss: '0px',
          intent: 'Add an outline 1 px wide',
        })
      }
    >
      <Plus aria-hidden {...icon} size={16} />
    </button>
  );
}

export function OutlineBody(props: BodyProps) {
  const { pick } = props;
  const { editor, tokens } = useStyleEditor(props);
  if (!editor) return null;
  const ring =
    holdsClassOf(classesWithStaged(editor), RING_FAMILIES.width) ||
    ringOf(pick.own['box-shadow'] ?? '') !== null;
  const families = ring ? RING_FAMILIES : OUTLINE_FAMILIES;
  const utility = ring ? 'ring' : 'outline';
  const property = `${utility}-width`;
  const shownRing = ringOf(pick.own['box-shadow'] ?? '');
  const width = stagedFor(editor.changes, editor.picked, editor.width, property)
    ? pixels(editor.own[property])
    : ring
      ? (shownRing?.width ?? 0)
      : pixels(editor.own['outline-width']);
  const colour = ring
    ? (shownRing?.colour ?? '')
    : (editor.own['outline-color'] ?? '');
  const clear = clearChange(
    editor.classes,
    [families.width, families.colour],
    ring ? 'ring-0' : 'outline-0',
    editor.target,
  );
  return (
    <div className="layout-stack">
      <div className="layout-row">
        <ClassColour
          editor={editor}
          tokens={tokens}
          name="Outline colour"
          property={`${utility}-color`}
          family={families.colour}
          utility={utility}
          colour={colour}
          what="outline colour"
        />
        <RemoveButton
          name="outline"
          onPreview={(on) => editor.preview(on ? clear : null)}
          onRemove={() =>
            stageWord(editor, {
              property,
              name: 'Outline',
              family: families.width,
              className: null,
              change: clear,
              from: formatValue(width),
              to: 'None',
              css: '0px',
              fromCss: `${formatValue(width)}px`,
              intent: 'Remove the outline',
              clearWith: ring ? 'ring-0' : 'outline-0',
              replaces: [`${utility}-color`, 'outline-offset'],
            })
          }
        />
      </div>
      <div className="layout-pair">
        <ClassField
          editor={editor}
          name="Outline width"
          label="Width"
          property={property}
          family={families.width}
          steps={WIDTH_STEPS}
          classOf={(step) =>
            ring && step.value === 1
              ? 'ring'
              : `${utility}-${formatValue(step.value)}`
          }
          value={width}
        />
        {ring ? null : (
          <ClassField
            editor={editor}
            name="Outline offset"
            label="Offset"
            property="outline-offset"
            family={OUTLINE_FAMILIES.offset}
            steps={WIDTH_STEPS}
            classOf={(step) => `outline-offset-${formatValue(step.value)}`}
            value={pixels(editor.own['outline-offset'])}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// An icon: its colour and how its lines are drawn.

const STROKE_STEPS: readonly Step[] = [0, 1, 2].map((value) => ({
  value,
  token: null,
}));

export function IconBody(props: BodyProps) {
  const { editor, tokens } = useStyleEditor(props);
  if (!editor) return null;
  const { own } = editor;
  return (
    <div className="layout-stack">
      <div className="layout-row">
        <ClassColour
          editor={editor}
          tokens={tokens}
          name="Icon colour"
          label="Colour"
          property="color"
          family={{ own: /^text-/ }}
          utility="text"
          colour={own.color ?? ''}
          what="icon's colour"
        />
      </div>
      <div className="layout-row">
        <ClassColour
          editor={editor}
          tokens={tokens}
          name="Icon fill"
          label="Fill"
          property="fill"
          family={{ own: /^fill-/ }}
          utility="fill"
          colour={own.fill ?? 'none'}
          what="icon's fill"
        />
      </div>
      <div className="layout-row">
        <ClassColour
          editor={editor}
          tokens={tokens}
          name="Icon lines"
          label="Lines"
          property="stroke"
          family={{ own: /^stroke-(?!\d)/ }}
          utility="stroke"
          colour={own.stroke ?? 'none'}
          what="icon's line colour"
        />
      </div>
      <ClassField
        editor={editor}
        name="Line width"
        label="Line width"
        property="stroke-width"
        family={{ own: /^stroke-\d/ }}
        steps={STROKE_STEPS}
        classOf={(step) => `stroke-${formatValue(step.value)}`}
        value={pixels(own['stroke-width'])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interaction: what the pointer does here, and how it moves.

const DURATION_STEPS: readonly Step[] = [
  0, 75, 100, 150, 200, 300, 500, 700, 1000,
].map((value) => ({ value, token: null }));

/** A computed `transition-duration`, in milliseconds: `0.15s` is 150. */
function durationOf(css: string | undefined): number {
  const first = (css ?? '0s').split(',')[0]?.trim() ?? '0s';
  const seconds = Number.parseFloat(first);
  if (Number.isNaN(seconds)) return 0;
  return Math.round(first.endsWith('ms') ? seconds : seconds * 1000);
}

export function InteractionBody(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  return (
    <div className="layout-stack">
      <WordRow editor={editor} control={CURSOR} />
      <WordRow editor={editor} control={POINTER_EVENTS} />
      <WordRow editor={editor} control={SELECT_TEXT} />
      <WordRow editor={editor} control={TRANSITION} unknown="Custom" />
      <ClassField
        editor={editor}
        name="Duration"
        label="Duration"
        unit="ms"
        property="transition-duration"
        family={{ own: /^duration-/ }}
        steps={DURATION_STEPS}
        classOf={(step) => `duration-${formatValue(step.value)}`}
        css={(next) => `${formatValue(next / 1000)}s`}
        value={
          stagedFor(
            editor.changes,
            editor.picked,
            editor.width,
            'transition-duration',
          )
            ? durationOf(editor.own['transition-duration'])
            : durationOf(editor.own['transition-duration'])
        }
      />
      <WordRow editor={editor} control={EASING} unknown="Custom" />
      <WordRow editor={editor} control={ANIMATION} unknown="Custom" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// A text's stroke: Tailwind has no class for it, so it goes to Claude.

const TEXT_STROKE = "Tailwind has no class for a text's stroke";

const STROKE_WIDTHS: readonly Step[] = [0, 1, 2, 3, 4].map((value) => ({
  value,
  token: null,
}));

const stageStroke = (
  { call, notify, pick }: BodyProps,
  editor: Editor,
  stroke: {
    property: string;
    label: string;
    intent: string;
    after: { value: string; token: string | null };
  },
): void => {
  call('stage-intent', {
    frame: pick.frame,
    id: editor.picked.id,
    reason: TEXT_STROKE,
    ...stroke,
  }).catch((error: unknown) => notify(messageOf(error), { stays: true }));
};

export const hasStroke = (pick: PropertyPick): boolean =>
  pixels(pick.own['-webkit-text-stroke-width']) > 0;

export function StrokeAdd(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  return (
    <button
      type="button"
      className="tool"
      aria-label="Add stroke"
      title="Add stroke"
      onClick={() =>
        stageStroke(props, editor, {
          property: '-webkit-text-stroke-width',
          label: 'Stroke: None → 1',
          intent: 'Add a stroke 1 px wide to the text',
          after: { value: '1px', token: null },
        })
      }
    >
      <Plus aria-hidden {...icon} size={16} />
    </button>
  );
}

export function StrokeBody(props: BodyProps) {
  const { editor, tokens } = useStyleEditor(props);
  if (!editor) return null;
  const width = pixels(editor.own['-webkit-text-stroke-width']);
  const colour = editor.own['-webkit-text-stroke-color'] ?? '';
  const rows = coloursFor(editor, tokens);
  const staged = stagedFor(
    editor.changes,
    editor.picked,
    editor.width,
    '-webkit-text-stroke-color',
  )?.after[0];
  return (
    <div className="layout-stack">
      <ScaleField
        name="Stroke width"
        label="Width"
        value={width}
        steps={STROKE_WIDTHS}
        notify={editor.notify}
        onPreview={() => {}}
        onCommit={(next) =>
          stageStroke(props, editor, {
            property: '-webkit-text-stroke-width',
            label: `Stroke: ${formatValue(width)} → ${formatValue(next)}`,
            intent: `Set the text's stroke to ${formatValue(next)} px wide`,
            after: { value: `${formatValue(next)}px`, token: null },
          })
        }
      />
      <div className="layout-row">
        <TokenField
          name="Stroke colour"
          label="Colour"
          value={staged?.token ?? colourText(colour)}
          swatch={staged?.value ?? colour}
          rows={rows}
          onChoose={(row) =>
            stageStroke(props, editor, {
              property: '-webkit-text-stroke-color',
              label: `Stroke colour: ${colourText(colour)} → ${row.name}`,
              intent: `Set the text's stroke colour to ${row.name}`,
              after: { value: row.hex ?? row.value, token: row.name },
            })
          }
        />
      </div>
    </div>
  );
}
