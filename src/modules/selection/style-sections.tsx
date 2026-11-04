import { use, useState } from 'react';

import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Minus,
  Plus,
  Square,
  SquareRoundCorner,
  TriangleAlert,
} from 'lucide-react';

import type { PropertyPick } from '../../module';
import { ChoiceMenu } from '../../shell/controls/choice-menu';
import { TokenButton, TokenField } from '../../shell/controls/field';
import { findStep, formatValue } from '../../shell/controls/scale';
import { IconToggle, Segmented } from '../../shell/controls/toggles';
import { stepsOf, type TokenRow } from '../../shell/controls/token-rows';

import { useDesign } from './design-panel';
import {
  borderSideOf,
  borderWidthOf,
  colourName,
  colourText,
  cornersOf,
  fontName,
  inWords,
  isClear,
  shownColour,
  type ShownColour,
} from './design-values';
import { BLEND, outerShadow } from './effect-classes';
import {
  activeClass,
  classChange,
  type FamilyRef,
  parseClass,
  pixels,
  stagedFor,
  stagedOn,
} from './layout-classes';
import {
  type BodyProps,
  ClassField,
  type Editor,
  FromMarks,
  icon,
  peek,
  stageWord,
  useEditor,
} from './layout-sections';
import type { Style } from './module';
import type { Props } from './panel-shared';
import { TextField } from './selection-section';
import {
  backgroundOf,
  BORDER_WIDTH_STEPS,
  borderWidthChange,
  borderWidthClass,
  clearChange,
  contrastWarning,
  familyOf,
  type Kind,
  LINE_HEIGHT_STEPS,
  OPACITY_STEPS,
  readTextStyle,
  readShadow,
  rowSteps,
  shadowSize,
  sizeChange,
  type StyleTokens,
  textStyleChange,
  textStyleSets,
  THICKNESS_STEPS,
  trackingRows,
  UNDERLINE_OFFSET_STEPS,
  weightClass,
} from './style-classes';
import { WordRow } from './word-row';

// ---------------------------------------------------------------------------
// The project's tokens, read once.

let tokensLookup: Promise<StyleTokens> | null = null;

function tokensOf(call: Props['call']): Promise<StyleTokens> {
  tokensLookup ??= call('style-tokens', {}).catch((error: unknown) => {
    // The next pick tries again.
    tokensLookup = null;
    throw error;
  });
  return tokensLookup;
}

/** An editor whose values have a staged text style's size, line height and weight in them. */
export function useStyleEditor(props: BodyProps): {
  editor: Editor | null;
  tokens: StyleTokens;
} {
  const tokens = use(tokensOf(props.call));
  const editor = useEditor(props, (change) =>
    change.property === 'text-style'
      ? textStyleSets(tokens.textStyles, change.after[0]?.value)
      : null,
  );
  return { editor, tokens };
}

export const coloursFor = (editor: Editor, tokens: StyleTokens): TokenRow[] =>
  editor.own['color-scheme'] === 'dark'
    ? tokens.colours.dark
    : tokens.colours.light;

export const ignore = (): void => {
  // Already told, in the panel's notice.
};

// ---------------------------------------------------------------------------
// A colour on a token.

type ColourSpec = {
  name: string;
  property: string;
  /** The computed property it reads. */
  reads: string;
  /** Which of the element's classes set it. */
  kind: Kind;
  /** What it is, for Claude: Colour alone doesn't say it's the text's. */
  what: string;
  /** `bg`, `text`, `border`, `decoration`. */
  utility: string;
  /** The classes' CSS, for the token it reads. */
  sets: RegExp;
};

export const FILL: ColourSpec = {
  name: 'Fill',
  property: 'background-color',
  reads: 'background-color',
  kind: 'fill',
  what: 'fill',
  utility: 'bg',
  sets: /^background(?:-color)?$/,
};

const TEXT_COLOUR: ColourSpec = {
  name: 'Colour',
  property: 'color',
  reads: 'color',
  kind: 'text-colour',
  what: 'text colour',
  utility: 'text',
  sets: /^color$/,
};

const UNDERLINE_COLOUR: ColourSpec = {
  name: 'Underline colour',
  property: 'text-decoration-color',
  reads: 'text-decoration-color',
  kind: 'decoration-colour',
  what: 'underline colour',
  utility: 'decoration',
  sets: /^text-decoration-color$/,
};

/** What a colour reads, what's staged over the page coming first. */
export function colourOf(
  editor: Editor,
  styles: readonly Style[],
  spec: ColourSpec,
): ShownColour {
  const staged = stagedFor(
    editor.changes,
    editor.picked,
    editor.width,
    spec.property,
  );
  const after = staged?.after[0];
  if (after) {
    return {
      colour: after.value,
      text: colourText(after.value),
      reading: { token: after.token, off: false },
    };
  }
  return shownColour(
    styles,
    spec.sets,
    editor.own[spec.reads] ?? '',
    editor.own['color-scheme'] === 'dark',
  );
}

/** A colour by the name a designer reads: its token's, or its value. Clear has neither. */
export function colourWords(shown: ShownColour): {
  name: string | null;
  text: string;
} {
  return {
    name: shown.reading.token ? colourName(shown.reading.token) : null,
    // `border-transparent` has no token and needs none; 0% black says nothing.
    text: isClear(shown.colour) ? 'Transparent' : shown.text,
  };
}

function ColourField({
  editor,
  tokens,
  spec,
  label,
}: {
  editor: Editor;
  tokens: StyleTokens;
  spec: ColourSpec;
  label?: string;
}) {
  const { styles } = useDesign();
  const shown = colourOf(editor, styles, spec);
  const rows = coloursFor(editor, tokens);
  const family = familyOf(styles, spec.kind);
  const { name, text } = colourWords(shown);
  const classFor = (row: TokenRow): string => `${spec.utility}-${row.name}`;
  return (
    <>
      <TokenField
        name={spec.name}
        label={label}
        value={name ?? text}
        swatch={shown.colour}
        detail={name ? text : undefined}
        off={shown.reading.off}
        rows={rows}
        current={rows.find((row) => row.name === name)?.key ?? null}
        near={shown.reading.off ? shown.colour : null}
        onPreview={(row) =>
          peek(editor, family, row ? classFor(row) : undefined)
        }
        onChoose={(row) => {
          editor
            .stage({
              property: spec.property,
              label: `${spec.name}: ${name ?? text} → ${row.name}`,
              intent: `Set the ${spec.what} to ${row.name}`,
              change: classChange(
                editor.classes,
                family,
                classFor(row),
                editor.target,
              ),
              before: { value: shown.text, token: name },
              after: { value: row.hex ?? row.value, token: row.name },
            })
            .catch(ignore);
        }}
      />
      <FromMarks editor={editor} families={[family]} />
    </>
  );
}

/** Says when text fails contrast on what's behind it. */
function ContrastNote({
  editor,
  pick,
  colour,
}: {
  editor: Editor;
  pick: PropertyPick;
  colour: string;
}) {
  const { own } = editor;
  const fill = own['background-color'] ?? '';
  const warning = contrastWarning(
    colour,
    backgroundOf(
      fill,
      own['background-image'] ?? '',
      isClear(fill),
      pick.backdrop,
    ),
    pixels(own['font-size']),
    pixels(own['font-weight']),
  );
  if (!warning) return null;
  return (
    <p className="field-note" role="status">
      <TriangleAlert aria-hidden {...icon} size={12} />
      Contrast is {formatValue(warning.ratio)}:1. This text needs{' '}
      {formatValue(warning.needs)}:1.
    </p>
  );
}

/** Takes a set value away. */
export function RemoveButton({
  name,
  onRemove,
  onPreview,
}: {
  name: string;
  onRemove: () => void;
  onPreview: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="tool"
      aria-label={`Remove ${name}`}
      title={`Remove ${name}`}
      onClick={onRemove}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onPreview(true);
      }}
      onPointerLeave={() => onPreview(false)}
    >
      <Minus aria-hidden {...icon} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Radius: a slider through the tokens, or a field per corner.

const CORNERS = [
  {
    key: 'tl',
    label: 'TL',
    name: 'Top left radius',
    property: 'border-top-left-radius',
    family: 'rounded-tl',
  },
  {
    key: 'tr',
    label: 'TR',
    name: 'Top right radius',
    property: 'border-top-right-radius',
    family: 'rounded-tr',
  },
  {
    key: 'bl',
    label: 'BL',
    name: 'Bottom left radius',
    property: 'border-bottom-left-radius',
    family: 'rounded-bl',
  },
  {
    key: 'br',
    label: 'BR',
    name: 'Bottom right radius',
    property: 'border-bottom-right-radius',
    family: 'rounded-br',
  },
] as const;

/** A class's token name when it reads this value: `rounded-md` says md where the scale says sm. */
const activeRadiusName = (className: string | undefined): string | null =>
  className
    ? (/^rounded-([a-z0-9]+)$/.exec(parseClass(className).base)?.[1] ?? null)
    : null;

export function RadiusBody(props: BodyProps) {
  const { editor, tokens } = useStyleEditor(props);
  const corners = cornersOf(props.pick.own);
  const [open, setOpen] = useState(new Set(corners).size > 1);
  if (!editor) return null;
  const rows = tokens.radius;
  const steps = stepsOf(rows);
  const value = pixels(editor.own['border-top-left-radius']);
  const staged = stagedFor(
    editor.changes,
    editor.picked,
    editor.width,
    'border-radius',
  );
  const active = activeClass(editor.classes, 'rounded', editor.width);
  const step = findStep(steps, value);
  const namedHere =
    !staged && step
      ? rows.find(
          (row) =>
            row.name === activeRadiusName(active?.className) &&
            row.px === value,
        )?.name
      : null;
  const name = namedHere ?? step?.token ?? null;
  const toggle = (
    <IconToggle label="Radius on each corner" pressed={open} onChange={setOpen}>
      <Square aria-hidden {...icon} />
    </IconToggle>
  );
  if (open) {
    return (
      <div className="layout-row layout-sides">
        <div className="layout-pair">
          {CORNERS.map((corner) => (
            <ClassField
              key={corner.key}
              editor={editor}
              name={corner.name}
              label={corner.label}
              property={corner.property}
              family={corner.family}
              steps={steps}
              rows={rows}
              classOf={(at) => `rounded-${corner.key}-${at.token ?? 'none'}`}
              value={pixels(editor.own[corner.property])}
            />
          ))}
        </div>
        {toggle}
      </div>
    );
  }
  return (
    <div className="layout-row">
      <ClassField
        slider
        editor={editor}
        name="Radius"
        label={<SquareRoundCorner aria-hidden {...icon} />}
        property="border-radius"
        family="rounded"
        steps={steps}
        rows={rows}
        classOf={(at) => `rounded-${at.token ?? 'none'}`}
        value={value}
      />
      {name ? <span className="field-token">{name}</span> : null}
      {toggle}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blending: opacity and blend mode.

export function BlendingBody(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  const opacity = Math.round(Number(editor.own.opacity ?? '1') * 100);
  return (
    <div className="layout-stack">
      <ClassField
        slider
        editor={editor}
        name="Opacity"
        label="Opacity"
        unit="%"
        property="opacity"
        family="opacity"
        steps={OPACITY_STEPS}
        classOf={(step) => `opacity-${formatValue(step.value)}`}
        css={(next) => formatValue(next / 100)}
        value={opacity}
      />
      <WordRow editor={editor} control={BLEND} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fill.

const value = (pick: PropertyPick, name: string): string =>
  pick.own[name] ?? '';

export const hasFill = (pick: PropertyPick): boolean =>
  pick.kind === 'text' ||
  pick.tag === 'img' ||
  !isClear(value(pick, 'background-color')) ||
  value(pick, 'background-image') !== 'none';

/** An empty section's `+` that opens a list of tokens. */
function AddWithToken({
  editor,
  name,
  rows,
  family,
  classFor,
  onChoose,
}: {
  editor: Editor;
  name: string;
  rows: readonly TokenRow[];
  family: FamilyRef;
  classFor: (row: TokenRow) => string;
  onChoose: (row: TokenRow) => void;
}) {
  return (
    <TokenButton
      name={name}
      label={`Add ${name.toLowerCase()}`}
      icon={<Plus aria-hidden {...icon} size={16} />}
      rows={rows}
      onPreview={(row) => peek(editor, family, row ? classFor(row) : undefined)}
      onChoose={onChoose}
    />
  );
}

export function FillAdd(props: BodyProps) {
  const { editor, tokens } = useStyleEditor(props);
  const { styles } = useDesign();
  if (!editor) return null;
  const family = familyOf(styles, 'fill');
  return (
    <AddWithToken
      editor={editor}
      name="Fill"
      rows={coloursFor(editor, tokens)}
      family={family}
      classFor={(row) => `bg-${row.name}`}
      onChoose={(row) => {
        editor
          .stage({
            property: FILL.property,
            label: `Fill: None → ${row.name}`,
            intent: `Add a fill of the ${row.name} colour`,
            change: classChange(
              editor.classes,
              family,
              `bg-${row.name}`,
              editor.target,
            ),
            before: { value: 'transparent', token: null },
            after: { value: row.hex ?? row.value, token: row.name },
          })
          .catch(ignore);
      }}
    />
  );
}

export function SolidFill(props: BodyProps) {
  const { pick } = props;
  const { editor, tokens } = useStyleEditor(props);
  const { styles } = useDesign();
  if (!editor) return null;
  const textColour = colourOf(editor, styles, TEXT_COLOUR).colour;
  if (pick.kind === 'text') {
    return (
      <div className="layout-stack">
        <div className="layout-row">
          <ColourField editor={editor} tokens={tokens} spec={TEXT_COLOUR} />
        </div>
        <ContrastNote editor={editor} pick={pick} colour={textColour} />
      </div>
    );
  }
  const colour = editor.own['background-color'] ?? '';
  const family = familyOf(styles, 'fill');
  const clear = clearChange(
    editor.classes,
    [family],
    'bg-transparent',
    editor.target,
  );
  const words = colourWords(colourOf(editor, styles, FILL));
  const fillNow = words.name ?? words.text;
  return (
    <div className="layout-stack">
      <div className="layout-row">
        <ColourField editor={editor} tokens={tokens} spec={FILL} />
        {isClear(colour) ? null : (
          <RemoveButton
            name="fill"
            onPreview={(on) => editor.preview(on ? clear : null)}
            onRemove={() => {
              editor
                .stage({
                  property: FILL.property,
                  label: `Fill: ${fillNow} → None`,
                  intent: 'Remove the fill',
                  change: clear,
                  before: { value: colourText(colour), token: words.name },
                  after: { value: 'transparent', token: null },
                  clearWith: 'bg-transparent',
                })
                .catch(ignore);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Border.

export const hasBorder = (pick: PropertyPick): boolean =>
  borderSideOf(pick.own) !== null;

export function BorderAdd(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  const { styles } = useDesign();
  if (!editor) return null;
  const family = familyOf(styles, 'border-width');
  return (
    <button
      type="button"
      className="tool"
      aria-label="Add border"
      title="Add border"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') peek(editor, family, 'border');
      }}
      onPointerLeave={() => peek(editor, family, undefined)}
      onClick={() =>
        stageWord(editor, {
          property: 'border-width',
          name: 'Border',
          family,
          className: 'border',
          from: 'None',
          to: '1',
          css: '1px',
          fromCss: '0px',
          intent: 'Add a border 1 px wide',
        })
      }
    >
      <Plus aria-hidden {...icon} size={16} />
    </button>
  );
}

const BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const;

export function BorderBody(props: BodyProps) {
  const { editor, tokens } = useStyleEditor(props);
  const { styles } = useDesign();
  if (!editor) return null;
  const side = borderSideOf(editor.own) ?? 'top';
  const width =
    pixels(borderWidthOf(editor.own)[0]) ||
    pixels(editor.own[`border-${side}-width`]);
  const style = editor.own[`border-${side}-style`] ?? 'solid';
  const widthFamily = familyOf(styles, 'border-width');
  const colourFamily = familyOf(styles, 'border-colour');
  const families = [widthFamily, colourFamily, 'border-style'] as const;
  const clear = clearChange(
    editor.classes,
    families,
    'border-0',
    editor.target,
  );
  return (
    <div className="layout-stack">
      <div className="layout-row">
        <ColourField
          editor={editor}
          tokens={tokens}
          spec={{
            name: 'Border colour',
            property: 'border-color',
            reads: `border-${side}-color`,
            kind: 'border-colour',
            what: 'border colour',
            utility: 'border',
            sets: /^border(?:-[a-z]+)*-color$/,
          }}
        />
        <RemoveButton
          name="border"
          onPreview={(on) => editor.preview(on ? clear : null)}
          onRemove={() =>
            stageWord(editor, {
              property: 'border-width',
              name: 'Border',
              family: widthFamily,
              className: null,
              change: clear,
              from: formatValue(width),
              to: 'None',
              css: '0px',
              fromCss: `${formatValue(width)}px`,
              intent: 'Remove the border',
              clearWith: 'border-0',
              // A staged colour has already rewritten what this takes away.
              replaces: ['border-color', 'border-style'],
            })
          }
        />
      </div>
      <div className="layout-pair">
        <ClassField
          editor={editor}
          name="Border width"
          label="Width"
          property="border-width"
          family={widthFamily}
          steps={BORDER_WIDTH_STEPS}
          classOf={(step) => borderWidthClass(step.value, null)}
          change={(step) =>
            borderWidthChange(
              editor.classes,
              widthFamily,
              step.value,
              editor.target,
            )
          }
          value={width}
        />
        <ChoiceMenu
          name="Border style"
          value={inWords(style)}
          choices={BORDER_STYLES.map((choice) => ({
            label: inWords(choice),
            checked: choice === style,
            onPreview: (on) =>
              peek(
                editor,
                'border-style',
                on === null ? undefined : `border-${choice}`,
              ),
            onChange: () => {
              if (choice === style) return;
              stageWord(editor, {
                property: 'border-style',
                name: 'Border style',
                family: 'border-style',
                className: `border-${choice}`,
                from: inWords(style),
                to: inWords(choice),
                css: choice,
                fromCss: style,
                intent: `Make the border ${choice}`,
              });
            },
          }))}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text.

type TextAlign = 'start' | 'center' | 'end' | 'justify';

const TEXT_ALIGN_WORDS: Readonly<Record<TextAlign, string>> = {
  start: 'Start',
  center: 'Centre',
  end: 'End',
  justify: 'Justify',
};

function alignOf(css: string | undefined): TextAlign {
  if (css === 'center' || css === 'justify') return css;
  return css === 'end' || css === 'right' ? 'end' : 'start';
}

const TEXT_ALIGN_OPTIONS = [
  {
    value: 'start',
    label: 'Align to the start',
    icon: <AlignLeft aria-hidden {...icon} />,
  },
  {
    value: 'center',
    label: 'Align to the centre',
    icon: <AlignCenter aria-hidden {...icon} />,
  },
  {
    value: 'end',
    label: 'Align to the end',
    icon: <AlignRight aria-hidden {...icon} />,
  },
  {
    value: 'justify',
    label: 'Justify',
    icon: <AlignJustify aria-hidden {...icon} />,
  },
] as const;

type VerticalAlign = 'start' | 'center' | 'end';

const VERTICAL_WORDS: Readonly<Record<VerticalAlign, string>> = {
  start: 'Top',
  center: 'Middle',
  end: 'Bottom',
};

const VERTICAL_OPTIONS = [
  {
    value: 'start',
    label: 'Align to the top',
    icon: <AlignStartVertical aria-hidden {...icon} />,
  },
  {
    value: 'center',
    label: 'Align to the middle',
    icon: <AlignCenterVertical aria-hidden {...icon} />,
  },
  {
    value: 'end',
    label: 'Align to the bottom',
    icon: <AlignEndVertical aria-hidden {...icon} />,
  },
] as const;

const ALIGN_CLASS: Readonly<Record<VerticalAlign, string>> = {
  start: 'top',
  center: 'middle',
  end: 'bottom',
};

type VerticalWay = 'self' | 'align' | null;

/** What moves text up and down here: its place in a row or a grid, or its line. Nothing in a block. */
function verticalWay(
  own: Readonly<Record<string, string>>,
  parent: Readonly<Record<string, string>>,
): VerticalWay {
  const inRow =
    (parent.display ?? '').endsWith('flex') &&
    (parent['flex-direction'] ?? 'row').startsWith('row');
  if (inRow || (parent.display ?? '').endsWith('grid')) return 'self';
  return /^(?:inline|inline-block|table-cell)$/.test(own.display ?? '')
    ? 'align'
    : null;
}

function verticalOf(way: VerticalWay, own: Readonly<Record<string, string>>) {
  const css = way === 'self' ? own['align-self'] : own['vertical-align'];
  if (css === 'center' || css === 'middle') return 'center';
  if (css === 'end' || css === 'flex-end' || css === 'bottom') return 'end';
  return css === 'start' || css === 'flex-start' || css === 'top'
    ? 'start'
    : ('none' as const);
}

function VerticalAlignRow({
  editor,
  way,
}: {
  editor: Editor;
  way: Exclude<VerticalWay, null>;
}) {
  const family = way === 'self' ? 'self' : 'vertical-align';
  const now = verticalOf(way, editor.own);
  const classOf = (next: VerticalAlign): string =>
    way === 'self' ? `self-${next}` : `align-${ALIGN_CLASS[next]}`;
  return (
    <div className="layout-row">
      <Segmented<VerticalAlign | 'none'>
        name="Align vertically"
        value={now}
        options={VERTICAL_OPTIONS}
        onPreview={(next) =>
          peek(
            editor,
            family,
            next === null || next === 'none' || next === now
              ? undefined
              : classOf(next),
          )
        }
        onChange={(next) => {
          if (next === 'none' || next === now) return;
          stageWord(editor, {
            property: way === 'self' ? 'align-self' : 'vertical-align',
            name: 'Align vertically',
            family,
            className: classOf(next),
            from:
              now === 'none'
                ? way === 'self'
                  ? 'As its parent says'
                  : 'None'
                : VERTICAL_WORDS[now],
            to: VERTICAL_WORDS[next],
            css: way === 'self' ? next : ALIGN_CLASS[next],
            fromCss:
              (way === 'self'
                ? editor.own['align-self']
                : editor.own['vertical-align']) ?? '',
            intent: `Align to the ${VERTICAL_WORDS[next].toLowerCase()} of its ${way === 'self' ? 'parent' : 'line'}`,
          });
        }}
      />
      <FromMarks editor={editor} families={[family]} />
    </div>
  );
}

const STYLE_FIGHTERS = [
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
];

export function TextBody(props: BodyProps) {
  const { pick, call, notify, changes } = props;
  const { picked, styles } = useDesign();
  const { editor, tokens } = useStyleEditor(props);
  if (!editor) return null;
  const textColour = colourOf(editor, styles, TEXT_COLOUR).colour;
  const { own } = editor;
  const size = familyOf(styles, 'size');
  const weight = familyOf(styles, 'weight');
  const font = familyOf(styles, 'font');
  const reading = readTextStyle(
    editor.classes,
    styles,
    tokens.textStyles,
    editor.width,
    stagedOn(editor.changes, editor.picked, editor.width),
  );
  const fontSize = pixels(own['font-size']);
  const lineHeight = own['line-height'] ?? '';
  const tracking = trackingRows(tokens.tracking, fontSize);
  const align = alignOf(own['text-align']);
  const way = verticalWay(own, pick.parent);
  const activeFont = activeClass(editor.classes, font, editor.width);
  const fontToken = activeFont
    ? tokens.fonts.find(
        (row) => `font-${row.name}` === parseClass(activeFont.className).base,
      )
    : null;
  const stagedFont = stagedFor(
    editor.changes,
    editor.picked,
    editor.width,
    'font-family',
  )?.after[0]?.token;
  const fontShown =
    stagedFont ?? fontToken?.name ?? fontName(own['font-family'] ?? '');
  const styleNow = tokens.textStyles.find((row) => row.name === reading.name);
  // What the code says, as a change replaces that: staged changes are replaced by name.
  const written = readTextStyle(
    editor.classes,
    styles,
    tokens.textStyles,
    editor.width,
    [],
  );
  const writtenWords = written.off
    ? `${written.name ?? 'None'}, changed`
    : (written.name ?? 'None');
  // The style a size leaves, whose weight would go with it: staged, or as written.
  const stagedStyle = stagedFor(
    editor.changes,
    editor.picked,
    editor.width,
    'text-style',
  )?.after[0]?.value;
  const leaving = tokens.textStyles.find(
    (row) => row.name === (stagedStyle ?? written.name),
  );
  const weightSet =
    activeClass(editor.classes, weight, editor.width) !== null ||
    stagedFor(editor.changes, editor.picked, editor.width, 'font-weight') !==
      null;
  const keepWeight =
    leaving?.weight && !weightSet
      ? weightClass(tokens.weights, leaving.weight)
      : null;
  return (
    <div className="layout-stack">
      {pick.kind === 'text' && picked ? (
        <TextField
          frame={pick.frame}
          picked={picked}
          call={call}
          notify={notify}
          changes={changes}
        />
      ) : null}
      {pick.kind === 'text' ? null : (
        <>
          <div className="layout-row">
            <ColourField
              editor={editor}
              tokens={tokens}
              spec={TEXT_COLOUR}
              label="Colour"
            />
          </div>
          <ContrastNote editor={editor} pick={pick} colour={textColour} />
        </>
      )}
      <div className="layout-row">
        <TokenField
          name="Text style"
          label="Style"
          value={reading.name ?? 'None'}
          off={reading.off}
          rows={tokens.textStyles}
          current={styleNow?.key ?? null}
          near={reading.off && !reading.name ? fontSize : null}
          onPreview={(row) =>
            editor.preview(
              row
                ? textStyleChange(
                    editor.classes,
                    styles,
                    row.name,
                    editor.target,
                  )
                : null,
            )
          }
          onChoose={(row) => {
            editor
              .stage({
                property: 'text-style',
                label: `Text style: ${writtenWords} → ${row.name}`,
                intent: `Set the text style to ${row.name}`,
                change: textStyleChange(
                  editor.classes,
                  styles,
                  row.name,
                  editor.target,
                ),
                before: {
                  value: writtenWords,
                  token: written.name ? `text-${written.name}` : null,
                },
                after: { value: row.name, token: `text-${row.name}` },
                replaces: STYLE_FIGHTERS,
              })
              .catch(ignore);
          }}
        />
        <FromMarks editor={editor} families={[size]} />
      </div>
      <div className="layout-row">
        <TokenField
          name="Font"
          label="Font"
          value={fontShown}
          rows={tokens.fonts}
          current={
            tokens.fonts.find((row) => row.name === fontShown)?.key ?? null
          }
          onPreview={(row) =>
            peek(editor, font, row ? `font-${row.name}` : undefined)
          }
          onChoose={(row) => {
            editor
              .stage({
                property: 'font-family',
                label: `Font: ${fontShown} → ${row.name}`,
                intent: `Set the font to ${row.name}`,
                change: classChange(
                  editor.classes,
                  font,
                  `font-${row.name}`,
                  editor.target,
                ),
                before: { value: fontShown, token: fontToken?.name ?? null },
                after: { value: row.name, token: row.name },
              })
              .catch(ignore);
          }}
        />
        <FromMarks editor={editor} families={[font]} />
      </div>
      <div className="layout-pair">
        <ClassField
          editor={editor}
          name="Weight"
          label="Weight"
          property="font-weight"
          family={weight}
          steps={rowSteps(tokens.weights)}
          rows={tokens.weights}
          classOf={(step) => `font-${step.token ?? 'normal'}`}
          css={formatValue}
          value={pixels(own['font-weight'])}
          measured
        />
        <ClassField
          editor={editor}
          name="Size"
          label="Size"
          property="font-size"
          family={size}
          steps={rowSteps(tokens.sizes)}
          rows={tokens.sizes}
          classOf={(step) => `text-${step.token ?? 'base'}`}
          change={(step) =>
            sizeChange(
              editor.classes,
              styles,
              step.token ?? 'base',
              editor.target,
              keepWeight,
            )
          }
          value={fontSize}
          measured
        />
      </div>
      <div className="layout-stack">
        <ClassField
          editor={editor}
          name="Line height"
          label="Line height"
          property="line-height"
          family="leading"
          steps={LINE_HEIGHT_STEPS}
          classOf={(step) => `leading-${formatValue(step.value / 4)}`}
          value={pixels(lineHeight)}
          zeroText="Auto"
          measured
        />
        <ClassField
          editor={editor}
          name="Letter spacing"
          label="Letter spacing"
          property="letter-spacing"
          family="tracking"
          steps={rowSteps(tracking)}
          rows={tracking}
          classOf={(step) => `tracking-${step.token ?? 'normal'}`}
          value={pixels(own['letter-spacing'])}
          measured
        />
      </div>
      <div className="layout-row">
        <Segmented<TextAlign>
          name="Align text"
          value={align}
          options={TEXT_ALIGN_OPTIONS}
          onPreview={(next) =>
            peek(
              editor,
              'text-align',
              next === null || next === align ? undefined : `text-${next}`,
            )
          }
          onChange={(next) => {
            if (next === align) return;
            stageWord(editor, {
              property: 'text-align',
              name: 'Align text',
              family: 'text-align',
              className: `text-${next}`,
              from: TEXT_ALIGN_WORDS[align],
              to: TEXT_ALIGN_WORDS[next],
              css: next,
              fromCss: own['text-align'] ?? 'start',
              intent:
                next === 'justify'
                  ? 'Justify the text'
                  : `Align the text to the ${TEXT_ALIGN_WORDS[next].toLowerCase()}`,
            });
          }}
        />
        <FromMarks editor={editor} families={['text-align']} />
      </div>
      {way ? <VerticalAlignRow editor={editor} way={way} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Underline.

export const hasUnderline = (pick: PropertyPick): boolean =>
  value(pick, 'text-decoration-line').includes('underline');

export function UnderlineAdd(props: BodyProps) {
  const { editor } = useStyleEditor(props);
  if (!editor) return null;
  return (
    <button
      type="button"
      className="tool"
      aria-label="Add underline"
      title="Add underline"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          peek(editor, 'underline', 'underline');
        }
      }}
      onPointerLeave={() => peek(editor, 'underline', undefined)}
      onClick={() =>
        stageWord(editor, {
          property: 'text-decoration-line',
          name: 'Underline',
          family: 'underline',
          className: 'underline',
          from: 'Off',
          to: 'On',
          css: 'underline',
          fromCss: 'none',
          intent: 'Underline the text',
        })
      }
    >
      <Plus aria-hidden {...icon} size={16} />
    </button>
  );
}

export function UnderlineBody(props: BodyProps) {
  const { editor, tokens } = useStyleEditor(props);
  const { styles } = useDesign();
  if (!editor) return null;
  const clear = clearChange(
    editor.classes,
    [
      'underline',
      'thickness',
      'underline-offset',
      familyOf(styles, 'decoration-colour'),
    ],
    'no-underline',
    editor.target,
  );
  return (
    <div className="layout-stack">
      <div className="layout-row">
        <ColourField editor={editor} tokens={tokens} spec={UNDERLINE_COLOUR} />
        <RemoveButton
          name="underline"
          onPreview={(on) => editor.preview(on ? clear : null)}
          onRemove={() =>
            stageWord(editor, {
              property: 'text-decoration-line',
              name: 'Underline',
              family: 'underline',
              className: null,
              change: clear,
              from: 'On',
              to: 'Off',
              css: 'none',
              fromCss: 'underline',
              intent: 'Remove the underline',
              clearWith: 'no-underline',
              // A staged colour has already rewritten what this takes away.
              replaces: [
                'text-decoration-color',
                'text-decoration-thickness',
                'text-underline-offset',
              ],
            })
          }
        />
      </div>
      <div className="layout-pair">
        <ClassField
          editor={editor}
          name="Underline thickness"
          label="Thickness"
          property="text-decoration-thickness"
          family="thickness"
          steps={THICKNESS_STEPS}
          zeroText="Auto"
          classOf={(step) =>
            step.value === 0
              ? 'decoration-auto'
              : `decoration-${formatValue(step.value)}`
          }
          value={pixels(editor.own['text-decoration-thickness'])}
          measured
        />
        <ClassField
          editor={editor}
          name="Underline offset"
          label="Offset"
          property="text-underline-offset"
          family="underline-offset"
          steps={UNDERLINE_OFFSET_STEPS}
          zeroText="Auto"
          classOf={(step) =>
            step.value === 0
              ? 'underline-offset-auto'
              : `underline-offset-${formatValue(step.value)}`
          }
          value={pixels(editor.own['text-underline-offset'])}
          measured
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shadow: a token by its name, not its layers.

const shadowProperty = (pick: PropertyPick): 'text-shadow' | 'box-shadow' =>
  pick.kind === 'text' ? 'text-shadow' : 'box-shadow';

export const shadowOf = (pick: PropertyPick): string | null =>
  outerShadow(value(pick, shadowProperty(pick)));

/** Which tokens a shadow chooses from, and what writes one. */
function shadowKind(pick: PropertyPick, tokens: StyleTokens) {
  return pick.kind === 'text'
    ? {
        rows: tokens.textShadows,
        kind: 'text-shadow' as const,
        utility: 'text-shadow',
        neutral: 'text-shadow-none',
      }
    : {
        rows: tokens.shadows,
        kind: 'shadow' as const,
        utility: 'shadow',
        neutral: 'shadow-none',
      };
}

export function ShadowAdd(props: BodyProps) {
  const { pick } = props;
  const { editor, tokens } = useStyleEditor(props);
  const { styles } = useDesign();
  if (!editor) return null;
  const { rows, kind, utility } = shadowKind(pick, tokens);
  const family = familyOf(styles, kind);
  const property = shadowProperty(pick);
  return (
    <AddWithToken
      editor={editor}
      name="Shadow"
      rows={rows}
      family={family}
      classFor={(row) => `${utility}-${row.name}`}
      onChoose={(row) => {
        editor
          .stage({
            property,
            label: `Shadow: None → ${row.name}`,
            intent: `Add the ${row.name} shadow`,
            change: classChange(
              editor.classes,
              family,
              `${utility}-${row.name}`,
              editor.target,
            ),
            before: { value: 'none', token: null },
            after: { value: `var(${row.key})`, token: row.name },
          })
          .catch(ignore);
      }}
    />
  );
}

export function ShadowBody(props: BodyProps) {
  const { pick } = props;
  const { editor, tokens } = useStyleEditor(props);
  const { styles } = useDesign();
  if (!editor) return null;
  const { rows, kind, utility, neutral } = shadowKind(pick, tokens);
  const property = shadowProperty(pick);
  const family = familyOf(styles, kind);
  const css = outerShadow(editor.own[property] ?? '') ?? '';
  const staged = stagedFor(
    editor.changes,
    editor.picked,
    editor.width,
    property,
  )?.after[0];
  const reading = staged
    ? { name: staged.token, off: false }
    : readShadow(editor.classes, styles, kind, editor.width);
  const { name } = reading;
  const shown = name ?? 'Custom';
  // As a token's written, so going back to it undoes the change.
  const nowRow = rows.find((row) => row.name === name);
  const now = nowRow ? `var(${nowRow.key})` : css;
  const clear = clearChange(editor.classes, [family], neutral, editor.target);
  return (
    <div className="layout-row">
      <TokenField
        name="Shadow"
        value={shown}
        off={reading.off}
        rows={rows}
        current={nowRow?.key ?? null}
        near={reading.off ? shadowSize(css) : null}
        onPreview={(row) =>
          peek(editor, family, row ? `${utility}-${row.name}` : undefined)
        }
        onChoose={(row) => {
          editor
            .stage({
              property,
              label: `Shadow: ${shown} → ${row.name}`,
              intent: `Use the ${row.name} shadow`,
              change: classChange(
                editor.classes,
                family,
                `${utility}-${row.name}`,
                editor.target,
              ),
              before: { value: now, token: name },
              after: { value: `var(${row.key})`, token: row.name },
            })
            .catch(ignore);
        }}
      />
      <FromMarks editor={editor} families={[family]} />
      <RemoveButton
        name="shadow"
        onPreview={(on) => editor.preview(on ? clear : null)}
        onRemove={() => {
          editor
            .stage({
              property,
              label: `Shadow: ${shown} → None`,
              intent: 'Remove the shadow',
              change: clear,
              before: { value: now, token: name },
              after: { value: 'none', token: null },
              clearWith: neutral,
            })
            .catch(ignore);
        }}
      />
    </div>
  );
}
