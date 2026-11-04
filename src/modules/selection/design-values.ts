// What the properties panel reads (TRU-3.8): the page's computed styles and the
// element's classes, turned into what a designer sees. Pure, so every rule
// here is tested without a browser.
import type { PropertyPick } from '../../module';

import type { Style } from './module';

/** The computed styles the panel asks a frame for. */
export const COMPUTED_PROPERTIES = [
  'display',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'rotate',
  'scale',
  'order',
  'position',
  'left',
  'top',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'align-items',
  'align-self',
  'justify-content',
  'justify-items',
  'grid-auto-flow',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'opacity',
  'mix-blend-mode',
  'background-color',
  'background-image',
  'color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'color-scheme',
  'box-shadow',
  'text-shadow',
  'filter',
  'backdrop-filter',
  'font-family',
  'font-weight',
  'font-size',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration-line',
  'text-decoration-color',
  'text-decoration-thickness',
  'text-underline-offset',
  '-webkit-text-stroke-width',
  '-webkit-text-stroke-color',
  // TRU-4.5: what the app's classes set that the panel couldn't change.
  'right',
  'bottom',
  'z-index',
  'overflow',
  'aspect-ratio',
  'flex-shrink',
  'grid-column-start',
  'grid-row-start',
  'translate',
  'text-transform',
  'font-style',
  'white-space',
  'object-fit',
  'object-position',
  'background-size',
  'background-position',
  'background-repeat',
  'background-clip',
  'outline-style',
  'outline-width',
  'outline-color',
  'outline-offset',
  'fill',
  'stroke',
  'stroke-width',
  'cursor',
  'pointer-events',
  'user-select',
  'visibility',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'animation-name',
] as const;

type Css = PropertyPick['own'];

const read = (css: Css, name: string): string => css[name] ?? '';

/** A CSS length as a designer's number: `12px` reads 12, two decimals at most. `50%` stays. */
export function number(value: string): string {
  if (!/^-?[\d.]+(?:px)?$/.test(value)) return value;
  return String(Math.round(Number.parseFloat(value) * 100) / 100);
}

/** Four sides, shortened as CSS shortens them: `12`, `12 16`, `12 16 8`, `12 16 8 4`. */
export function sides(
  values: readonly [string, string, string, string],
): string {
  const [top, right, bottom, left] = values.map(number) as [
    string,
    string,
    string,
    string,
  ];
  if (left !== right) return `${top} ${right} ${bottom} ${left}`;
  if (top !== bottom) return `${top} ${right} ${bottom}`;
  return top === right ? top : `${top} ${right}`;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

const sidesOf = (
  css: Css,
  name: (side: (typeof SIDES)[number]) => string,
): [string, string, string, string] => [
  read(css, name('top')),
  read(css, name('right')),
  read(css, name('bottom')),
  read(css, name('left')),
];

const isZero = (value: string): boolean =>
  value === '' || Number.parseFloat(value) === 0;

const CORNERS = [
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
] as const;

/** `rgb(61, 130, 242)` reads `#3d82f2`; any other colour stays as the browser gives it. */
export function colourText(value: string): string {
  const match =
    /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?\s*\)$/.exec(
      value,
    );
  if (!match) return value;
  const channels = [match[1], match[2], match[3]].map((channel) =>
    Number(channel).toString(16).padStart(2, '0'),
  );
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (alpha === 1) return `#${channels.join('')}`;
  return `#${channels.join('')} ${Math.round(alpha * 100)}%`;
}

export function isClear(colour: string): boolean {
  return (
    colour === '' ||
    colour === 'transparent' ||
    /^rgba\([^)]*,\s*0\)$/.test(colour)
  );
}

/** The layers of a `box-shadow`, split on the commas that aren't inside a colour. */
export function layersOf(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    if (character === '(') depth++;
    if (character === ')') depth--;
    if (character === ',' && depth === 0) {
      layers.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  layers.push(current.trim());
  return layers;
}

/**
 * The shadow that shows. Tailwind writes every shadow as several layers, most
 * of them clear and of no size, so `none` alone doesn't mean nothing is drawn.
 */
export function visibleShadow(value: string): string | null {
  if (value === '' || value === 'none') return null;
  const shown = layersOf(value).filter((layer) => {
    if (/rgba\([^)]*,\s*0\)/.test(layer)) return false;
    const lengths = layer.replace(/[a-z]+\([^)]*\)/gi, '').match(/-?[\d.]+px/g);
    return !lengths || lengths.some((length) => !isZero(length));
  });
  return shown.length > 0 ? shown.join(', ') : null;
}

/**
 * Whether the element draws anything of its own. Holding only text and
 * nothing else makes it Text; a Button's words sit in a Frame.
 */
function hasBox(own: Css): boolean {
  return (
    !isClear(read(own, 'background-color')) ||
    read(own, 'background-image') !== 'none' ||
    SIDES.some(
      (side) =>
        !isZero(read(own, `padding-${side}`)) ||
        !isZero(read(own, `border-${side}-width`)),
    ) ||
    CORNERS.some((corner) => !isZero(read(own, corner))) ||
    visibleShadow(read(own, 'box-shadow')) !== null
  );
}

/** A pick reads as Text when it holds only text and draws no box around it. */
export function kindOfPick(text: string | null, own: Css): 'element' | 'text' {
  return text !== null && !hasBox(own) ? 'text' : 'element';
}

// ---------------------------------------------------------------------------
// Sizing: the same three words as the pill (TRU-16.3) and TRU-4.2's menu.

export type SizingMode = 'Fill' | 'Fit' | 'Fixed';

const FILL_CLASS =
  /^(?:w|h|size)-(?:full|screen|svw|lvw|dvw|svh|lvh|dvh|\d+\/\d+)$/;
const FIT_CLASS = /^(?:w|h|size)-(?:fit|min|max)$/;
/** Says nothing of its own: the layout decides. */
const AUTO_CLASS = /^(?:w|h|size)-auto$/;

/** What the classes say about one axis, breakpoint and state classes aside. */
function modeFromClass(
  axis: 'width' | 'height',
  classes: readonly string[],
): SizingMode | null {
  const inset = axis === 'width' ? /^inset(?:-x)?-0$/ : /^inset(?:-y)?-0$/;
  if (classes.some((name) => inset.test(name))) return 'Fill';
  const prefix = axis === 'width' ? 'w-' : 'h-';
  // The last one wins, as tailwind-merge keeps it.
  const own = classes.findLast(
    (name) => name.startsWith(prefix) || name.startsWith('size-'),
  );
  if (!own || AUTO_CLASS.test(own)) return null;
  if (FILL_CLASS.test(own)) return 'Fill';
  if (FIT_CLASS.test(own)) return 'Fit';
  return 'Fixed';
}

/** The width a block has to fill: its parent's, inside the padding and the border. */
function roomInside(parent: Css): number {
  const width = Number.parseFloat(read(parent, 'width'));
  if (read(parent, 'box-sizing') !== 'border-box') return width;
  const inset = (name: string): number =>
    Number.parseFloat(read(parent, name)) || 0;
  return (
    width -
    inset('padding-left') -
    inset('padding-right') -
    inset('border-left-width') -
    inset('border-right-width')
  );
}

/** Fill, Fit or Fixed: from a class that says so, else from how the page lays it out. */
export function sizingMode(
  axis: 'width' | 'height',
  pick: Pick<PropertyPick, 'classes' | 'own' | 'parent'> & {
    width?: number;
  },
): SizingMode {
  const { own, parent } = pick;
  const fromClass = modeFromClass(axis, pick.classes);
  if (fromClass) return fromClass;

  const position = read(own, 'position');
  if (position === 'absolute' || position === 'fixed') return 'Fit';
  if (read(own, 'display').startsWith('inline')) return 'Fit';

  const parentDisplay = read(parent, 'display');
  if (parentDisplay.endsWith('flex')) {
    const row = read(parent, 'flex-direction').startsWith('row');
    const main = row === (axis === 'width');
    if (main) return Number(read(own, 'flex-grow')) > 0 ? 'Fill' : 'Fit';
    const self = read(own, 'align-self');
    const align = self === 'auto' ? read(parent, 'align-items') : self;
    return align === 'normal' || align === 'stretch' ? 'Fill' : 'Fit';
  }
  if (parentDisplay.endsWith('grid')) return 'Fill';
  if (axis === 'height') return 'Fit';

  // A block fills its parent, unless a stylesheet set it narrower.
  const room = roomInside(parent);
  const taken =
    (pick.width ?? Number.NaN) +
    Number.parseFloat(read(own, 'margin-left') || '0') +
    Number.parseFloat(read(own, 'margin-right') || '0');
  return taken < room - 1 ? 'Fixed' : 'Fill';
}

// ---------------------------------------------------------------------------
// Tokens: which one a value reads, and whether it's off the scale.

export type Reading = {
  /** The token it's linked to, by name. Two when two sides read different ones. */
  token: string | null;
  /** A class sets it to something that isn't a token. */
  off: boolean;
};

const NONE: Reading = { token: null, off: false };

/** The pixels a token's value comes to: `12px`, or `0.75rem (12px)`. */
function tokenPixels(value: string): number | null {
  const match = /(-?[\d.]+)px\)?$/.exec(value);
  return match?.[1] === undefined ? null : Number(match[1]);
}

function setsProperty(style: Style, property: RegExp): boolean {
  return style.properties.some((name) => property.test(name));
}

/** A class that always applies: not behind a state or a breakpoint. */
const always = (style: Style): boolean => !style.className.includes(':');

/** Sets a keyword, or nothing at all: there's no scale for it to be off. */
const KEYWORD_CLASS =
  /-(?:0|auto|none|full|inherit|initial|unset|transparent|current)$/;

/** A class that sets a value by hand, when a token could. */
const offScale = (style: Style, property: RegExp): boolean =>
  style.status !== 'token' &&
  always(style) &&
  !KEYWORD_CLASS.test(style.className) &&
  setsProperty(style, property);

/**
 * Which tokens give a length its value. A class behind a breakpoint counts
 * only if it matches what's on the page, so `md:px-500` links at `md` and not
 * below it.
 */
export function lengthReading(
  styles: readonly Style[],
  property: RegExp,
  values: readonly string[],
): Reading {
  // By size, as `-mt-200` reads the same token as `mt-200`.
  const shown = new Set(
    values.map((value) => Math.abs(Number.parseFloat(value))),
  );
  const tokens = styles.flatMap((style) => {
    if (style.status !== 'token' || !setsProperty(style, property)) return [];
    const pixels = [style.light, style.dark ?? ''].map(tokenPixels);
    return pixels.some((px) => px !== null && shown.has(px))
      ? [style.token]
      : [];
  });
  const off = styles.some((style) => offScale(style, property));
  if (tokens.length === 0) return { token: null, off };
  return { token: [...new Set(tokens)].join(', '), off };
}

/** Which token gives a colour or a shadow its value: a value that has no number to compare. */
export function namedReading(
  styles: readonly Style[],
  property: RegExp,
): Reading {
  const matching = styles.filter(
    (style) => always(style) && setsProperty(style, property),
  );
  const last = matching.at(-1);
  if (!last) return NONE;
  if (last.status === 'token') return { token: last.token, off: false };
  return { token: null, off: offScale(last, property) };
}

/** A colour as the panel shows it: its swatch, its words and its token. */
export type ShownColour = { colour: string; text: string; reading: Reading };

/** A class that shows while the pointer is on the element: `hover:`, `group-hover/x:`, `active:`. */
const POINTER_STATE =
  /(?:^|:)(?:(?:group|peer)-)?(?:hover|active)(?:\/[^:]*)?:/;

/**
 * What a colour reads, at rest. The pointer is on the element when it's picked,
 * so a `hover:` class or its transition may be what the browser reports. Where
 * such a class sets the property, the resting token decides. Otherwise a token
 * must agree with the page, as another class may have overridden it. A class
 * behind `dark:` or a breakpoint counts when it's what the page shows.
 */
export function shownColour(
  styles: readonly Style[],
  property: RegExp,
  colour: string,
  dark = false,
): ShownColour {
  const text = colourText(colour);
  const hex = text.slice(0, 7).toLowerCase();
  const setting = styles.filter((style) => setsProperty(style, property));
  const resting = setting.filter(
    (style) => !POINTER_STATE.test(style.className),
  );

  const shows = resting.findLast(
    (style) =>
      style.status === 'token' &&
      [style.light, style.dark ?? ''].some(
        (value) => value.slice(0, 7).toLowerCase() === hex,
      ),
  );
  if (shows?.status === 'token') {
    return { colour, text, reading: { token: shows.token, off: false } };
  }

  const rest = resting.findLast(always);
  if (rest?.status !== 'token') {
    return { colour, text, reading: namedReading(styles, property) };
  }
  const reading: Reading = { token: rest.token, off: false };
  if (resting.length < setting.length) {
    const value = dark ? (rest.dark ?? rest.light) : rest.light;
    return { colour: value, text: colourText(value), reading };
  }
  // Not comparable as hex: the class is the best there is.
  const comparable = hex.startsWith('#') && rest.light.startsWith('#');
  return { colour, text, reading: comparable ? NONE : reading };
}

/** A colour token's name for the panel: `color-primary` reads `primary`. */
export function colourName(token: string): string {
  return token.replace(/^color-/, '');
}

/** The text style the element's classes name, if any: `text-title-md`. */
export function textStyleOf(styles: readonly Style[]): string | null {
  const style = styles.find(
    (entry) =>
      entry.status === 'token' &&
      always(entry) &&
      entry.className.startsWith('text-') &&
      setsProperty(entry, /^font-size$/),
  );
  return style?.status === 'token' ? style.token : null;
}

// ---------------------------------------------------------------------------
// Words.

/** `flex-start` reads Start, `space-between` Space between. */
export function inWords(value: string): string {
  const words = value.replace(/^(?:flex|self)-/, '').replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The first family, as the designer would name it. */
export function fontName(family: string): string {
  const first = family.split(',')[0] ?? '';
  return first.trim().replace(/^["']|["']$/g, '');
}

/** How many tracks a resolved grid template has: `100px 100px` is 2. */
export function trackCount(template: string): number {
  // Named lines sit between the tracks: `[a] 100px [b] 100px`.
  const tracks = template.replace(/\[[^\]]*\]/g, ' ').trim();
  if (tracks === '' || tracks === 'none') return 0;
  return tracks.split(/\s+(?![^(]*\))/).length;
}

export const paddingOf = (css: Css) =>
  sidesOf(css, (side) => `padding-${side}`);
export const marginOf = (css: Css) => sidesOf(css, (side) => `margin-${side}`);
export const borderWidthOf = (css: Css) =>
  sidesOf(css, (side) => `border-${side}-width`);
export const cornersOf = (css: Css): [string, string, string, string] => [
  read(css, CORNERS[0]),
  read(css, CORNERS[1]),
  read(css, CORNERS[2]),
  read(css, CORNERS[3]),
];

/** The side a border is drawn on, for its colour and style: the top if there are several. */
export function borderSideOf(css: Css): (typeof SIDES)[number] | null {
  return (
    SIDES.find(
      (side) =>
        !isZero(read(css, `border-${side}-width`)) &&
        read(css, `border-${side}-style`) !== 'none',
    ) ?? null
  );
}

export const allZero = (values: readonly string[]): boolean =>
  values.every(isZero);
