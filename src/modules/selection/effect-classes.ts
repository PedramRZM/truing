// What the controls past TRU-4.3 write and read (TRU-4.5): gradients, filters, and the
// settings that are one word among a few, each a class. Pure, so every rule here
// is tested without a browser. The words come from an audit of the classes the
// app's own source uses; `panel-coverage.ts` keeps the list honest.
import type { Step } from '../../shell/controls/scale';

import { layersOf } from './design-values';
import {
  activeClass,
  type ClassChange,
  classChange,
  type Family,
  type FamilyRef,
  holdsBySize,
  parseClass,
  type Target,
} from './layout-classes';

// ---------------------------------------------------------------------------
// One word among a few: blend mode, overflow, text case.

export type Word = {
  label: string;
  /** Null takes the family's classes away: what the element is without one. */
  className: string | null;
  /** What the page reports with this word on. */
  css: string;
  /** What a staged change says, when `css` doesn't tell it from another word. */
  value?: string;
  /** What says this word at a use, or a breakpoint, where nothing can be taken away. */
  clearWith?: string;
};

export type WordControl = {
  name: string;
  /** The property a change is staged under. */
  property: string;
  /** The computed property it reads, when that's another. */
  reads?: string;
  family: Family;
  words: readonly Word[];
};

const word = (label: string, className: string, css: string): Word => ({
  label,
  className,
  css,
});

/** The word that says a default: its class is taken away, and it can be said outright. */
const none = (label: string, clearWith: string, css: string): Word => ({
  label,
  className: null,
  css,
  clearWith,
});

const BLEND_MODES = [
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

const inWords = (name: string): string => {
  const spaced = name.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const BLEND: WordControl = {
  name: 'Blend',
  property: 'mix-blend-mode',
  family: { own: /^mix-blend-/ },
  words: [
    none('Normal', 'mix-blend-normal', 'normal'),
    ...BLEND_MODES.map((mode) =>
      word(inWords(mode), `mix-blend-${mode}`, mode),
    ),
  ],
};

export const DISPLAY: WordControl = {
  name: 'Display',
  property: 'display',
  family: {
    own: /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents)$/,
  },
  words: [
    word('Block', 'block', 'block'),
    word('Inline', 'inline', 'inline'),
    word('Inline block', 'inline-block', 'inline-block'),
    word('Flex', 'flex', 'flex'),
    word('Inline flex', 'inline-flex', 'inline-flex'),
    word('Grid', 'grid', 'grid'),
    word('Inline grid', 'inline-grid', 'inline-grid'),
    word('No box', 'contents', 'contents'),
  ],
};

export const POSITION: WordControl = {
  name: 'Position',
  property: 'position',
  family: { own: /^(?:static|relative|absolute|fixed|sticky)$/ },
  words: [
    word('In the flow', 'static', 'static'),
    word('Relative', 'relative', 'relative'),
    word('Absolute', 'absolute', 'absolute'),
    word('Fixed', 'fixed', 'fixed'),
    word('Sticky', 'sticky', 'sticky'),
  ],
};

export const STACK: WordControl = {
  name: 'Stack order',
  property: 'z-index',
  family: { own: /^z-/ },
  words: [
    none('Auto', 'z-auto', 'auto'),
    ...[0, 10, 20, 30, 40, 50].map((level) =>
      word(String(level), `z-${level}`, String(level)),
    ),
  ],
};

export const OVERFLOW: WordControl = {
  name: 'Overflow',
  property: 'overflow',
  family: { own: /^overflow-(?:visible|hidden|clip|auto|scroll)$/ },
  words: [
    none('Visible', 'overflow-visible', 'visible'),
    word('Clip', 'overflow-hidden', 'hidden'),
    word('Scroll when needed', 'overflow-auto', 'auto'),
    word('Always scroll', 'overflow-scroll', 'scroll'),
  ],
};

export const ASPECT: WordControl = {
  name: 'Aspect ratio',
  property: 'aspect-ratio',
  family: { own: /^aspect-/ },
  words: [
    none('Auto', 'aspect-auto', 'auto'),
    word('Square', 'aspect-square', '1 / 1'),
    word('Video', 'aspect-video', '16 / 9'),
  ],
};

export const GROW: WordControl = {
  name: 'Grow',
  property: 'flex-grow',
  family: { own: /^(?:flex-)?grow(?:-|$)/ },
  words: [word('No', 'grow-0', '0'), word('Yes', 'grow', '1')],
};

export const SHRINK: WordControl = {
  name: 'Shrink',
  property: 'flex-shrink',
  family: { own: /^(?:flex-)?shrink(?:-|$)/ },
  words: [word('Yes', 'shrink', '1'), word('No', 'shrink-0', '0')],
};

const SPANS = [2, 3, 4, 5, 6, 12];

const spanWords = (utility: string): Word[] =>
  SPANS.map((span) =>
    word(String(span), `${utility}-span-${span}`, `span ${span}`),
  );

export const COLUMN_SPAN: WordControl = {
  name: 'Column span',
  property: 'grid-column-start',
  family: { own: /^col-span-/ },
  words: [none('1', 'col-auto', 'auto'), ...spanWords('col')],
};

export const ROW_SPAN: WordControl = {
  name: 'Row span',
  property: 'grid-row-start',
  family: { own: /^row-span-/ },
  words: [none('1', 'row-auto', 'auto'), ...spanWords('row')],
};

export const TEXT_CASE: WordControl = {
  name: 'Case',
  property: 'text-transform',
  family: { own: /^(?:uppercase|lowercase|capitalize|normal-case)$/ },
  words: [
    none('As written', 'normal-case', 'none'),
    word('Uppercase', 'uppercase', 'uppercase'),
    word('Lowercase', 'lowercase', 'lowercase'),
    word('Capitalize', 'capitalize', 'capitalize'),
  ],
};

export const ITALIC: WordControl = {
  name: 'Slant',
  property: 'font-style',
  family: { own: /^(?:not-)?italic$/ },
  words: [
    none('Upright', 'not-italic', 'normal'),
    word('Italic', 'italic', 'italic'),
  ],
};

export const STRIKE: WordControl = {
  name: 'Strikethrough',
  property: 'text-strike',
  reads: 'text-decoration-line',
  family: { own: /^line-through$/ },
  words: [
    none('Off', 'no-underline', 'none'),
    word('On', 'line-through', 'line-through'),
  ],
};

export const LINES: WordControl = {
  name: 'Lines',
  property: 'text-lines',
  reads: 'white-space',
  family: { own: /^(?:truncate|whitespace-[a-z-]+|line-clamp-[a-z0-9]+)$/ },
  words: [
    none('Wrap', 'whitespace-normal', 'normal'),
    word('No wrap', 'whitespace-nowrap', 'nowrap'),
    {
      label: 'One, cut short',
      className: 'truncate',
      css: 'nowrap',
      value: 'truncate',
    },
    ...[2, 3, 4].map((lines) => ({
      label: `${lines}, cut short`,
      className: `line-clamp-${lines}`,
      css: 'normal',
      value: `clamp-${lines}`,
    })),
  ],
};

export const IMAGE_FIT: WordControl = {
  name: 'Fit',
  property: 'object-fit',
  family: { own: /^object-(?:fill|contain|cover|none|scale-down)$/ },
  words: [
    none('Stretch', 'object-fill', 'fill'),
    word('Fit inside', 'object-contain', 'contain'),
    word('Cover', 'object-cover', 'cover'),
    word('Actual size', 'object-none', 'none'),
    word('Shrink to fit', 'object-scale-down', 'scale-down'),
  ],
};

export const IMAGE_PLACE: WordControl = {
  name: 'Place',
  property: 'object-position',
  family: { own: /^object-(?:center|top|bottom|left|right)$/ },
  words: [
    none('Centre', 'object-center', '50% 50%'),
    word('Top', 'object-top', '50% 0%'),
    word('Bottom', 'object-bottom', '50% 100%'),
    word('Left', 'object-left', '0% 50%'),
    word('Right', 'object-right', '100% 50%'),
  ],
};

export const BACKGROUND_FIT: WordControl = {
  name: 'Fit',
  property: 'background-size',
  family: { own: /^bg-(?:auto|cover|contain)$/ },
  words: [
    none('Actual size', 'bg-auto', 'auto'),
    word('Cover', 'bg-cover', 'cover'),
    word('Fit inside', 'bg-contain', 'contain'),
  ],
};

export const BACKGROUND_PLACE: WordControl = {
  name: 'Place',
  property: 'background-position',
  family: { own: /^bg-(?:center|top|bottom|left|right)$/ },
  words: [
    word('Top left', 'bg-left-top', '0% 0%'),
    word('Centre', 'bg-center', '50% 50%'),
    word('Top', 'bg-top', '50% 0%'),
    word('Bottom', 'bg-bottom', '50% 100%'),
    word('Left', 'bg-left', '0% 50%'),
    word('Right', 'bg-right', '100% 50%'),
  ],
};

export const BACKGROUND_REPEAT: WordControl = {
  name: 'Repeat',
  property: 'background-repeat',
  family: { own: /^bg-(?:repeat|no-repeat|repeat-x|repeat-y)$/ },
  words: [
    none('Repeat', 'bg-repeat', 'repeat'),
    word('Once', 'bg-no-repeat', 'no-repeat'),
    word('Across', 'bg-repeat-x', 'repeat-x'),
    word('Down', 'bg-repeat-y', 'repeat-y'),
  ],
};

export const CURSOR: WordControl = {
  name: 'Cursor',
  property: 'cursor',
  family: { own: /^cursor-/ },
  words: [
    none('Auto', 'cursor-auto', 'auto'),
    word('Default', 'cursor-default', 'default'),
    word('Pointer', 'cursor-pointer', 'pointer'),
    word('Text', 'cursor-text', 'text'),
    word('Wait', 'cursor-wait', 'wait'),
    word('Help', 'cursor-help', 'help'),
    word('Not allowed', 'cursor-not-allowed', 'not-allowed'),
  ],
};

export const POINTER_EVENTS: WordControl = {
  name: 'Clicks',
  property: 'pointer-events',
  family: { own: /^pointer-events-/ },
  words: [
    none('Takes them', 'pointer-events-auto', 'auto'),
    word('Lets them through', 'pointer-events-none', 'none'),
  ],
};

export const SELECT_TEXT: WordControl = {
  name: 'Select text',
  property: 'user-select',
  family: { own: /^select-/ },
  words: [
    none('Auto', 'select-auto', 'auto'),
    word('Off', 'select-none', 'none'),
    word('All at once', 'select-all', 'all'),
  ],
};

export const VISIBILITY: WordControl = {
  name: 'Visibility',
  property: 'visibility',
  family: { own: /^(?:visible|invisible|collapse)$/ },
  words: [
    none('Visible', 'visible', 'visible'),
    word('Invisible, keeps its room', 'invisible', 'hidden'),
  ],
};

export const TRANSITION: WordControl = {
  name: 'Transition',
  property: 'transition-property',
  family: { own: /^transition(?:-[a-z]+)?$/ },
  words: [
    none('None', 'transition-none', 'none'),
    word('Everything', 'transition-all', 'all'),
    word('Colours', 'transition-colors', 'colors'),
    word('Opacity', 'transition-opacity', 'opacity'),
    word('Shadow', 'transition-shadow', 'box-shadow'),
    word('Movement', 'transition-transform', 'transform'),
  ],
};

export const EASING: WordControl = {
  name: 'Easing',
  property: 'transition-timing-function',
  family: { own: /^ease-/ },
  words: [
    word('Linear', 'ease-linear', 'linear'),
    word('In', 'ease-in', 'cubic-bezier(0.4, 0, 1, 1)'),
    word('Out', 'ease-out', 'cubic-bezier(0, 0, 0.2, 1)'),
    word('In and out', 'ease-in-out', 'cubic-bezier(0.4, 0, 0.2, 1)'),
  ],
};

export const ANIMATION: WordControl = {
  name: 'Animation',
  property: 'animation-name',
  family: { own: /^animate-/ },
  words: [
    none('None', 'animate-none', 'none'),
    word('Spin', 'animate-spin', 'spin'),
    word('Ping', 'animate-ping', 'ping'),
    word('Pulse', 'animate-pulse', 'pulse'),
    word('Bounce', 'animate-bounce', 'bounce'),
  ],
};

export type WordReading = {
  word: Word | null;
  /** What it reads in words: the word's, or the page's own value. */
  text: string;
  /** A class by hand: `z-[1350]`. */
  off: boolean;
};

const valueOf = (entry: Word): string => entry.value ?? entry.css;

/** What a staged change or the tray says for a word. */
export const wordValue = valueOf;

/** Which word a control reads: what's staged, the class that holds, then what the page reports. */
export function readWord(
  control: WordControl,
  classes: readonly string[],
  own: Readonly<Record<string, string>>,
  width: number,
  staged: string | undefined,
): WordReading {
  if (staged !== undefined) {
    const chosen =
      control.words.find((entry) => valueOf(entry) === staged) ?? null;
    return { word: chosen, text: chosen?.label ?? staged, off: false };
  }
  const active = activeClass(classes, control.family, width);
  const base = active ? parseClass(active.className).base : null;
  const off = active?.arbitrary ?? false;
  // No class says nothing: a word with no class of its own isn't what it means.
  const byClass =
    base === null
      ? undefined
      : control.words.find((entry) => entry.className === base);
  if (byClass) return { word: byClass, text: byClass.label, off };
  const css = own[control.reads ?? control.property] ?? '';
  // `text-decoration-line` can hold more than one word.
  const byCss =
    control.words.find((entry) => entry.css === css) ??
    control.words.find(
      (entry) => entry.css !== 'none' && css.split(' ').includes(entry.css),
    );
  if (byCss) return { word: byCss, text: byCss.label, off };
  return { word: null, text: css || 'None', off };
}

/** What a word writes: its class, or the family's classes gone. */
export function wordChange(
  control: WordControl,
  chosen: Word,
  classes: readonly string[],
  target: Target,
): ClassChange {
  if (chosen.className !== null) {
    return classChange(classes, control.family, chosen.className, target);
  }
  const { remove } = classChange(classes, control.family, null, target);
  const needsSaying = target.prefix !== '' || remove.length === 0;
  return {
    add:
      needsSaying && chosen.clearWith
        ? [`${target.prefix}${chosen.clearWith}`]
        : [],
    remove,
  };
}

// ---------------------------------------------------------------------------
// Gradients.

/** `bg-gradient-to-r` is the older name of `bg-linear-to-r`, and the app has both. */
const SHAPE = /^bg-(?:linear|gradient|radial|conic)(?:-|$)/;

export const GRADIENT_FAMILIES = {
  shape: { own: SHAPE },
  from: { own: /^from-(?!\d+%$)/ },
  via: { own: /^via-(?!\d+%$)/ },
  to: { own: /^to-(?!\d+%$)/ },
  'from-position': { own: /^from-\d+%$/ },
  'via-position': { own: /^via-\d+%$/ },
  'to-position': { own: /^to-\d+%$/ },
} as const satisfies Record<string, Family>;

export const CLIP_FAMILY: Family = { own: /^bg-clip-/ };

export type StopName = 'from' | 'via' | 'to';

export const STOP_NAMES: Readonly<Record<StopName, string>> = {
  from: 'Start',
  via: 'Middle',
  to: 'End',
};

/** Every family a gradient writes: what going back to Solid takes away. */
export const ALL_GRADIENT: readonly FamilyRef[] =
  Object.values(GRADIENT_FAMILIES);

/** What a gradient staged replaces: every part of the one before it. */
export const GRADIENT_PROPERTIES = [
  'gradient-shape',
  'gradient-from',
  'gradient-via',
  'gradient-to',
  'gradient-from-position',
  'gradient-via-position',
  'gradient-to-position',
];

export type GradientKind = 'linear' | 'radial' | 'conic';

export const DIRECTIONS = [
  { name: 'r', label: 'To the right', css: 'to right' },
  { name: 'br', label: 'To the bottom right', css: 'to bottom right' },
  { name: 'b', label: 'To the bottom', css: 'to bottom' },
  { name: 'bl', label: 'To the bottom left', css: 'to bottom left' },
  { name: 'l', label: 'To the left', css: 'to left' },
  { name: 'tl', label: 'To the top left', css: 'to top left' },
  { name: 't', label: 'To the top', css: 'to top' },
  { name: 'tr', label: 'To the top right', css: 'to top right' },
] as const;

export type DirectionName = (typeof DIRECTIONS)[number]['name'];

/** A step at each 5%: what `from-10%` writes. */
export const STOP_STEPS: readonly Step[] = Array.from(
  { length: 21 },
  (_, index) => ({ value: index * 5, token: null }),
);

export type ParsedStop = { colour: string; position: number | null };

export type ParsedGradient = {
  kind: GradientKind;
  /** `to right`, `45deg`; null when the browser left it out. */
  direction: string | null;
  stops: ParsedStop[];
};

/** A colour and its position: `rgb(1, 2, 3) 10%`. */
function stopOf(text: string): ParsedStop {
  const match = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(text.trim());
  return {
    colour: match?.[1] ?? text.trim(),
    position: match?.[2] === undefined ? null : Number(match[2]),
  };
}

const NOT_A_COLOUR =
  /^(?:to |at |in |from |circle|ellipse|closest|farthest|-?[\d.]+(?:deg|turn|rad|grad)\b)/;

/** The first gradient in a computed `background-image`; null when there isn't one. */
export function parseGradient(css: string): ParsedGradient | null {
  const match = /^(?:repeating-)?(linear|radial|conic)-gradient\(/.exec(css);
  const kind = match?.[1];
  if (kind !== 'linear' && kind !== 'radial' && kind !== 'conic') return null;
  const open = match?.[0].length ?? 0;
  let depth = 1;
  let end = open;
  for (; end < css.length && depth > 0; end += 1) {
    if (css[end] === '(') depth += 1;
    if (css[end] === ')') depth -= 1;
  }
  const parts = layersOf(css.slice(open, end - 1));
  const head = parts[0] ?? '';
  const hasHead = NOT_A_COLOUR.test(head);
  const way = hasHead ? head.replace(/\s*\bin\s+.*$/, '').trim() : '';
  return {
    kind,
    direction: way === '' ? null : way,
    stops: (hasHead ? parts.slice(1) : parts).map(stopOf),
  };
}

export type GradientStop = {
  /** What its class names, `transparent` included; null for one with no class. */
  token: string | null;
  colour: string | null;
  position: number;
};

export type GradientReading = {
  kind: GradientKind;
  direction: DirectionName | null;
  /** The direction in words, when it's none of the eight: `45deg`. */
  directionText: string;
  /** Classes write it. One by hand (`bg-[linear-gradient(…)]`) can only be read. */
  written: boolean;
  from: GradientStop;
  via: GradientStop | null;
  to: GradientStop;
};

const STOP_DEFAULT: Readonly<Record<StopName, number>> = {
  from: 0,
  via: 50,
  to: 100,
};

/** What a stop's class names: `from-primary` reads `primary`. */
function stopToken(
  classes: readonly string[],
  stop: StopName,
  width: number,
): string | null {
  const active = activeClass(classes, GRADIENT_FAMILIES[stop], width);
  if (!active) return null;
  return parseClass(active.className).base.slice(stop.length + 1);
}

function stopPosition(
  classes: readonly string[],
  stop: StopName,
  width: number,
): number | null {
  const active = activeClass(
    classes,
    GRADIENT_FAMILIES[`${stop}-position`],
    width,
  );
  if (!active) return null;
  return Number.parseFloat(
    parseClass(active.className).base.slice(stop.length + 1),
  );
}

/** A gradient as its classes and the page say it. What's staged goes over this in the panel. */
export function readGradient(
  classes: readonly string[],
  css: string,
  width: number,
): GradientReading {
  const parsed = parseGradient(css);
  const active = activeClass(classes, GRADIENT_FAMILIES.shape, width);
  const shape = active ? parseClass(active.className).base : '';
  let kind: GradientKind = parsed?.kind ?? 'linear';
  if (shape.startsWith('bg-radial')) kind = 'radial';
  if (shape.startsWith('bg-conic')) kind = 'conic';
  const named = /^bg-(?:linear|gradient)-to-([a-z]+)$/.exec(shape)?.[1];
  const direction =
    DIRECTIONS.find((entry) => entry.name === named) ??
    DIRECTIONS.find((entry) => entry.css === parsed?.direction) ??
    null;
  const stops = parsed?.stops ?? [];
  const middle = stops.length > 2 ? stops[1] : undefined;
  const stop = (
    name: StopName,
    seen: ParsedStop | undefined,
  ): GradientStop => ({
    token: stopToken(classes, name, width),
    colour: seen?.colour ?? null,
    position:
      stopPosition(classes, name, width) ??
      seen?.position ??
      STOP_DEFAULT[name],
  });
  const hasVia =
    middle !== undefined || stopToken(classes, 'via', width) !== null;
  return {
    kind,
    direction: direction?.name ?? null,
    directionText: direction?.label ?? parsed?.direction ?? 'To the bottom',
    written: active !== null,
    from: stop('from', stops[0]),
    via: hasVia ? stop('via', middle) : null,
    to: stop('to', stops.at(-1)),
  };
}

/** The class for a shape, in the spelling the element already has, so `cn()` can merge the two. */
export function shapeClass(
  classes: readonly string[],
  kind: GradientKind,
  direction: DirectionName | null,
): string {
  if (kind !== 'linear') return `bg-${kind}`;
  const older = classes.some((name) =>
    parseClass(name).base.startsWith('bg-gradient-to-'),
  );
  return `bg-${older ? 'gradient' : 'linear'}-to-${direction ?? 'r'}`;
}

/** A solid fill turned into a gradient: the colour it has, fading out. */
export function solidToGradient(
  classes: readonly string[],
  fillFamily: Family,
  from: string,
  target: Target,
): ClassChange {
  const add = [
    shapeClass(classes, 'linear', 'r'),
    `from-${from}`,
    'to-transparent',
  ].map((name) => `${target.prefix}${name}`);
  const gone = [fillFamily, ...ALL_GRADIENT].flatMap(
    (family) => classChange(classes, family, null, target).remove,
  );
  return { add, remove: gone.filter((name) => !add.includes(name)) };
}

/** A gradient's classes gone. Text clipped to it would be invisible, so that goes too. */
export function gradientGone(
  classes: readonly string[],
  target: Target,
): ClassChange {
  const gone = ALL_GRADIENT.flatMap(
    (family) => classChange(classes, family, null, target).remove,
  );
  const clip = classChange(classes, CLIP_FAMILY, null, target).remove;
  return {
    add: [],
    remove: [
      ...gone,
      ...clip,
      ...(clip.length > 0
        ? classes.filter((name) => name === 'text-transparent')
        : []),
    ],
  };
}

/** What a gradient looks like, to draw it in the panel. */
export function gradientCss(reading: GradientReading): string {
  const stops = [reading.from, reading.via, reading.to]
    .flatMap((stop) =>
      stop ? [`${stop.colour ?? 'transparent'} ${stop.position}%`] : [],
    )
    .join(', ');
  if (reading.kind === 'radial') return `radial-gradient(${stops})`;
  if (reading.kind === 'conic') return `conic-gradient(${stops})`;
  const way =
    DIRECTIONS.find((entry) => entry.name === reading.direction)?.css ??
    'to bottom';
  return `linear-gradient(${way}, ${stops})`;
}

/** The image in a computed `background-image`; null when there isn't one. */
export function imageUrlOf(css: string): string | null {
  return /url\(["']?([^"')]+)["']?\)/.exec(css)?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Filters.

export type FilterSpec = {
  /** Which filter: staged as `filter-<name>`. */
  id: string;
  name: string;
  /** The CSS function it reads, in `filter`, or in `backdrop-filter` when `backdrop`. */
  fn: string;
  backdrop?: boolean;
  family: Family;
  unit: string;
  steps: readonly Step[];
  classOf: (value: number) => string;
  /** What says it's off at a use, where the class can't be taken away. */
  clearWith: string;
  /** What the `+` adds. */
  start: number;
  /** A computed value as the number the field shows: `1.1` reads 110. */
  read: (css: string) => number;
};

const stepsOfNumbers = (values: readonly number[]): Step[] =>
  values.map((value) => ({ value, token: null }));

/** `blur-sm` is 8 px. Tailwind's own scale, as the project has no tokens for it. */
const BLUR_NAMES: ReadonlyArray<readonly [number, string]> = [
  [0, 'none'],
  [4, 'xs'],
  [8, 'sm'],
  [12, 'md'],
  [16, 'lg'],
  [24, 'xl'],
  [40, '2xl'],
  [64, '3xl'],
];

const blurSpec = (
  name: string,
  utility: string,
  backdrop: boolean,
): FilterSpec => ({
  id: utility,
  name,
  fn: 'blur',
  backdrop,
  family: { own: new RegExp(`^${utility}(?:-|$)`) },
  unit: '',
  steps: stepsOfNumbers(BLUR_NAMES.map(([px]) => px)),
  classOf: (value) =>
    `${utility}-${BLUR_NAMES.find(([px]) => px === value)?.[1] ?? 'none'}`,
  clearWith: `${utility}-none`,
  start: 8,
  read: (css) => Number.parseFloat(css) || 0,
});

const percentSpec = (
  fn: string,
  name: string,
  values: readonly number[],
  start: number,
  off: number,
): FilterSpec => ({
  id: fn,
  name,
  fn: fn === 'saturate' ? 'saturate' : fn,
  family: { own: new RegExp(`^${fn}(?:-|$)`) },
  unit: '%',
  steps: stepsOfNumbers(values),
  classOf: (value) => `${fn}-${value}`,
  clearWith: `${fn}-${off}`,
  start,
  read: (css) =>
    Math.round(
      css.endsWith('%') ? Number.parseFloat(css) : Number.parseFloat(css) * 100,
    ),
});

export const FILTERS: readonly FilterSpec[] = [
  blurSpec('Blur', 'blur', false),
  percentSpec(
    'brightness',
    'Brightness',
    [0, 50, 75, 90, 95, 100, 105, 110, 125, 150, 200],
    110,
    100,
  ),
  percentSpec(
    'contrast',
    'Contrast',
    [0, 50, 75, 100, 125, 150, 200],
    125,
    100,
  ),
  percentSpec('saturate', 'Saturation', [0, 50, 100, 150, 200], 150, 100),
  percentSpec('grayscale', 'Grayscale', [0, 100], 100, 0),
  percentSpec('invert', 'Invert', [0, 100], 100, 0),
  percentSpec('sepia', 'Sepia', [0, 100], 100, 0),
  blurSpec('Backdrop blur', 'backdrop-blur', true),
];

export const filterProperty = (spec: FilterSpec): string => `filter-${spec.id}`;

/** The functions in a computed `filter`: `blur(8px) brightness(1.1)`. */
function functionsOf(css: string): Map<string, string> {
  return new Map(
    [...css.matchAll(/([a-z-]+)\(([^()]*)\)/g)].flatMap(
      (match): Array<[string, string]> =>
        match[1] && match[2] !== undefined ? [[match[1], match[2]]] : [],
    ),
  );
}

/** Which filters are on, by the page, with what's staged laid over it. `none` is staged off. */
export function filtersOf(
  own: Readonly<Record<string, string>>,
): ReadonlyMap<FilterSpec, number> {
  const page = functionsOf(own.filter ?? '');
  const behind = functionsOf(own['backdrop-filter'] ?? '');
  const on = new Map<FilterSpec, number>();
  for (const spec of FILTERS) {
    const staged = own[filterProperty(spec)];
    if (staged === 'none') continue;
    if (staged !== undefined) {
      on.set(spec, Number(staged));
      continue;
    }
    const css = (spec.backdrop ? behind : page).get(spec.fn);
    if (css !== undefined) on.set(spec, spec.read(css));
  }
  return on;
}

// ---------------------------------------------------------------------------
// Rings, and shadows without them.

export const RING_FAMILIES = {
  width: { own: /^ring(?:-\d+|-\[[^\]]*\])?$/ },
  colour: { own: /^ring-(?!\d|\[|inset$|offset)/ },
} as const satisfies Record<string, Family>;

export const OUTLINE_FAMILIES = {
  width: { own: /^outline(?:-\d+)?$/ },
  colour: {
    own: /^outline-(?!\d|offset-|none$|hidden$|dashed$|dotted$|double$)/,
  },
  offset: { own: /^outline-offset-/ },
} as const satisfies Record<string, Family>;

export const INSET_FAMILY: Family = { own: /^inset-shadow-/ };

/** Tailwind's own, as the project has no inner shadow tokens. */
export const INSET_NAMES = ['2xs', 'xs', 'sm'] as const;

const numbersIn = (layer: string): number[] =>
  (
    layer.replace(/[a-z-]+\([^)]*\)/gi, '').match(/-?[\d.]+(?=px|\b)/g) ?? []
  ).map(Number);

const CLEAR_LAYER = /rgba\([^)]*,\s*0\)|\/\s*0\)|transparent/;

/** A layer that's drawn: a clear one, or one of no size, shows nothing. */
function isDrawn(layer: string): boolean {
  if (CLEAR_LAYER.test(layer)) return false;
  // A staged token, as it's written: its numbers are in the stylesheet.
  if (layer.trim().startsWith('var(')) return true;
  return numbersIn(layer).some((value) => value !== 0);
}

/** A ring's layer: no offset, no blur, only a spread. */
function isRing(layer: string): boolean {
  if (layer.includes('inset')) return false;
  const [x, y, blur, spread] = numbersIn(layer);
  return x === 0 && y === 0 && blur === 0 && (spread ?? 0) !== 0;
}

/** The shadow that isn't an inner one or a ring: those have their own sections. */
export function outerShadow(css: string): string | null {
  if (css === '' || css === 'none') return null;
  const shown = layersOf(css).filter(
    (layer) => isDrawn(layer) && !layer.includes('inset') && !isRing(layer),
  );
  return shown.length > 0 ? shown.join(', ') : null;
}

export function innerShadow(css: string): string | null {
  if (css === '' || css === 'none') return null;
  const shown = layersOf(css).filter(
    (layer) => isDrawn(layer) && layer.includes('inset'),
  );
  return shown.length > 0 ? shown.join(', ') : null;
}

/** A ring's width and colour, from a computed `box-shadow`. */
export function ringOf(css: string): { width: number; colour: string } | null {
  if (css === '' || css === 'none') return null;
  const layer = layersOf(css).find((entry) => isDrawn(entry) && isRing(entry));
  if (!layer) return null;
  const colour = /[a-z-]+\([^)]*\)/i.exec(layer)?.[0] ?? '';
  return { width: numbersIn(layer)[3] ?? 0, colour };
}

/** A class of a family holds at some size: a state's `focus:ring-2` isn't a ring. */
export const holdsClassOf = (
  classes: readonly string[],
  family: Family,
): boolean =>
  classes.some(
    (name) => holdsBySize(name) && family.own.test(parseClass(name).base),
  );
