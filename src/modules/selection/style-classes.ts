// What the style controls write and read (TRU-4.3): type, colour, radius, border,
// shadow and opacity as the classes that set them. A class's kind comes from
// what it sets, as `text-title-m`, `text-grey-700` and `text-center` share a
// prefix. Pure, so every rule here is tested without a browser.
import Colour from 'colorjs.io';

import type { StagedChange } from '../../module';
import { formatValue, scaleOf, type Step } from '../../shell/controls/scale';
import { type TokenRow, tokenRows } from '../../shell/controls/token-rows';
import type { Token } from '../../tokens/manifest';

import { layersOf, visibleShadow } from './design-values';
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
import type { Style } from './module';

// ---------------------------------------------------------------------------
// What a class sets.

type Sets = (properties: readonly string[]) => boolean;

const sets =
  (property: RegExp): Sets =>
  (properties) =>
    properties.some((name) => property.test(name));

const SETS_SIZE = sets(/^font-size$/);

export const KINDS = {
  fill: sets(/^background(?:-color)?$/),
  'text-colour': sets(/^color$/),
  'border-colour': sets(/^border(?:-[a-z]+)*-color$/),
  'border-width': sets(/^border(?:-[a-z]+)*-width$/),
  'decoration-colour': sets(/^text-decoration-color$/),
  size: SETS_SIZE,
  // A text style sets a weight too, and isn't one.
  weight: (properties) =>
    sets(/^font-weight$/)(properties) && !SETS_SIZE(properties),
  font: sets(/^font-family$/),
  shadow: sets(/^box-shadow$/),
  'text-shadow': sets(/^text-shadow$/),
} as const satisfies Record<string, Sets>;

export type Kind = keyof typeof KINDS;

/** Others set these too and aren't them: `ring-1` is a box-shadow, `divide-y` a border. */
const NAMED: Partial<Record<Kind, RegExp>> = {
  shadow: /^shadow(?:-|$)/,
  'border-width': /^border(?:-|$)/,
  'border-colour': /^border(?:-|$)/,
};

/** The family of the element's classes that set something, whatever they're called. */
export function familyOf(styles: readonly Style[], kind: Kind): Family {
  const named = NAMED[kind];
  const bases = new Set(
    styles
      .filter((style) => KINDS[kind](style.properties))
      .map((style) => parseClass(style.className).base)
      .filter((base) => named?.test(base) ?? true),
  );
  return { own: { test: (base) => bases.has(base) } };
}

const SETS_TEXT = sets(
  /^(?:color|font-size|font-weight|font-family|line-height|letter-spacing|text-align)$/,
);

/** Whether Text shows: it holds only text, or a class that always holds sets type or a text colour. */
export function setsText(
  text: string | null,
  styles: readonly Style[],
): boolean {
  return (
    text !== null ||
    styles.some(
      (style) => holdsBySize(style.className) && SETS_TEXT(style.properties),
    )
  );
}

// ---------------------------------------------------------------------------
// Writing several kinds at once.

/** Classes in place of several families: a text style takes size, weight and line height. */
function replacing(
  classes: readonly string[],
  families: readonly FamilyRef[],
  added: readonly string[],
  target: Target,
): ClassChange {
  const add = added.map((name) => `${target.prefix}${name}`);
  return {
    add,
    remove: families
      .flatMap((family) => classChange(classes, family, null, target).remove)
      .filter((name) => !add.includes(name)),
  };
}

/** A text style: its `text-*`, and nothing left that would fight it or keep it flagged. */
export function textStyleChange(
  classes: readonly string[],
  styles: readonly Style[],
  name: string,
  target: Target,
): ClassChange {
  return replacing(
    classes,
    [
      familyOf(styles, 'size'),
      familyOf(styles, 'weight'),
      'leading',
      'tracking',
    ],
    [`text-${name}`],
    target,
  );
}

/**
 * A size. Off a text style it keeps the style's weight, as the weight would
 * otherwise go with the style, and only the size was asked for.
 */
export function sizeChange(
  classes: readonly string[],
  styles: readonly Style[],
  name: string,
  target: Target,
  keepWeight: string | null,
): ClassChange {
  return replacing(
    classes,
    [familyOf(styles, 'size')],
    keepWeight ? [`text-${name}`, keepWeight] : [`text-${name}`],
    target,
  );
}

/**
 * Takes a value away. At every size that's its classes going; from a size up,
 * or when no class of the element's sets it, something must say so instead.
 */
export function clearChange(
  classes: readonly string[],
  families: readonly FamilyRef[],
  neutral: string,
  target: Target,
): ClassChange {
  const { remove } = replacing(classes, families, [], target);
  const needsSaying = target.prefix !== '' || remove.length === 0;
  return {
    add: needsSaying ? [`${target.prefix}${neutral}`] : [],
    remove,
  };
}

// ---------------------------------------------------------------------------
// Text styles.

export type TextStyleRow = TokenRow & {
  /** In pixels. */
  lineHeight: number | null;
  weight: string | null;
};

export type StyleReading = {
  name: string | null;
  /** Something fights the style, or a plain size stands where a style would. */
  off: boolean;
};

const FIGHTS_STYLE: ReadonlySet<string> = new Set([
  'font-weight',
  'line-height',
  'letter-spacing',
]);

/** Which text style the classes say, whether anything fights it, and what's staged over that. */
export function readTextStyle(
  classes: readonly string[],
  styles: readonly Style[],
  rows: readonly TokenRow[],
  width: number,
  staged: readonly StagedChange[],
): StyleReading {
  const active = activeClass(classes, familyOf(styles, 'size'), width);
  const base = active ? parseClass(active.className).base : null;
  let name = rows.find((row) => `text-${row.name}` === base)?.name ?? null;
  const fighters: readonly FamilyRef[] = [
    familyOf(styles, 'weight'),
    'leading',
    'tracking',
  ];
  const fought = fighters.some(
    (family) => activeClass(classes, family, width) !== null,
  );
  let off = active && !name ? true : fought;
  for (const change of staged) {
    if (change.property === 'text-style') {
      name = change.after[0]?.value ?? null;
      off = false;
    } else if (change.property === 'font-size') {
      name = null;
      off = true;
    } else if (FIGHTS_STYLE.has(change.property)) {
      off = true;
    }
  }
  return { name, off };
}

/** The properties a staged text style sets, so the fields read them before the page does. */
export function textStyleSets(
  rows: readonly TextStyleRow[],
  name: string | undefined,
): Record<string, string> | null {
  const row = rows.find((entry) => entry.name === name);
  if (!row) return null;
  return {
    ...(row.px === null ? {} : { 'font-size': `${row.px}px` }),
    ...(row.lineHeight === null
      ? {}
      : { 'line-height': `${row.lineHeight}px` }),
    ...(row.weight === null ? {} : { 'font-weight': row.weight }),
  };
}

/** The `font-*` that keeps a style's weight when the style goes. */
export function weightClass(
  rows: readonly TokenRow[],
  weight: string | null,
): string | null {
  const row = rows.find((entry) => entry.value === weight);
  return row ? `font-${row.name}` : null;
}

// ---------------------------------------------------------------------------
// Scales without a project token.

const stepsOfValues = (values: readonly number[]): Step[] =>
  values.map((value) => ({ value, token: null }));

/** Tailwind's own: `opacity-50`. */
export const OPACITY_STEPS = stepsOfValues(
  Array.from({ length: 21 }, (_, index) => index * 5),
);

export const BORDER_WIDTH_STEPS = stepsOfValues([0, 1, 2, 4, 8]);

/** `leading-5` is 20 px. There's no step for Auto: stepping leaves it for a number. */
export const LINE_HEIGHT_STEPS = stepsOfValues(
  Array.from({ length: 8 }, (_, index) => (index + 3) * 4),
);

/** `decoration-2`, and Auto at 0. */
export const THICKNESS_STEPS = stepsOfValues([0, 1, 2, 4, 8]);

/** `underline-offset-2`, and Auto at 0. */
export const UNDERLINE_OFFSET_STEPS = stepsOfValues([0, 1, 2, 4, 8]);

/** `border`, `border-2`, `border-b-2`: on the side it's already on. */
export function borderWidthClass(px: number, side: string | null): string {
  const head = side ? `border-${side}` : 'border';
  return px === 1 ? head : `${head}-${formatValue(px)}`;
}

/**
 * A width on every side the classes set one, as `border-t border-b` has two.
 * With a class on all sides, or none, it's one class for all of them.
 */
export function borderWidthChange(
  classes: readonly string[],
  family: Family,
  px: number,
  target: Target,
): ClassChange {
  const own = classes.filter(
    (name) => holdsBySize(name) && family.own.test(parseClass(name).base),
  );
  const sides = new Set(own.map(borderSideOfClass));
  const each = sides.size === 0 || sides.has(null) ? [null] : [...sides];
  return replacing(
    classes,
    [family],
    each.map((side) => borderWidthClass(px, side)),
    target,
  );
}

/** The side a border's width class names: `b` in `border-b-2`. */
export function borderSideOfClass(className: string | null): string | null {
  if (!className) return null;
  const { base } = parseClass(className);
  return /^border-([xytrblse])(?:-|$)/.exec(base)?.[1] ?? null;
}

/** A scale from rows that carry a number: weights, letter spacing. */
export function rowSteps(rows: readonly TokenRow[]): Step[] {
  return scaleOf(
    rows.flatMap((row) =>
      row.px === null ? [] : [{ value: row.px, token: row.name }],
    ),
  );
}

/** Letter spacing is in `em`: what it comes to at this size, in pixels. */
export function trackingRows(
  rows: readonly TokenRow[],
  fontSize: number,
): TokenRow[] {
  return rows.map((row) => {
    const px = Number.parseFloat(row.value) * fontSize;
    return { ...row, px, value: formatValue(px) };
  });
}

// ---------------------------------------------------------------------------
// Shadow.

/** How far a shadow reaches, by its largest blur, to compare it with the tokens. */
export function shadowSize(css: string): number | null {
  const shown = visibleShadow(css);
  if (shown === null) return null;
  const blurs = layersOf(shown).map((layer) => {
    const lengths = layer
      .replace(/[a-z-]+\([^)]*\)/gi, '')
      .match(/-?[\d.]+(?:px|rem|em)?/g);
    return Number.parseFloat(lengths?.[2] ?? '0');
  });
  return Math.max(...blurs);
}

/** The shadow that holds at a width, as its token, and whether one written by hand sets it. */
export function readShadow(
  classes: readonly string[],
  styles: readonly Style[],
  kind: 'shadow' | 'text-shadow',
  width: number,
): { name: string | null; off: boolean } {
  const active = activeClass(classes, familyOf(styles, kind), width);
  if (!active) return { name: null, off: false };
  const style = styles.find((entry) => entry.className === active.className);
  if (style?.status === 'token') {
    return { name: shadowName(style.token), off: false };
  }
  return { name: null, off: !/-(?:none|0)$/.test(active.className) };
}

/** A shadow's token, without its namespace: `shadow-pane` reads `pane`. */
export function shadowName(token: string): string {
  return token.replace(/^(?:text-)?shadow-/, '');
}

// ---------------------------------------------------------------------------
// Contrast.

const AA_TEXT = 4.5;
const AA_LARGE = 3;

/** WCAG's large text: 24 px, or about 18.66 px in bold. */
function isLarge(fontSize: number, weight: number): boolean {
  return fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
}

/** Text over a background, or null when the background can't be measured (translucent, unparseable). */
export function contrastOf(text: string, background: string): number | null {
  try {
    const under = new Colour(background).to('srgb');
    if (under.alpha !== 1) return null;
    const over = new Colour(text).to('srgb');
    const alpha = Number(over.alpha);
    const seen = new Colour(
      'srgb',
      [0, 1, 2].map(
        (channel) =>
          (over.coords[channel] ?? 0) * alpha +
          (under.coords[channel] ?? 0) * (1 - alpha),
      ) as [number, number, number],
    );
    return seen.contrast(under, 'WCAG21');
  } catch {
    return null;
  }
}

export type ContrastWarning = { ratio: number; needs: number };

/** What fails 4.5:1, or 3:1 at a large size. Null when it passes, or can't be told. */
export function contrastWarning(
  text: string,
  background: string | null,
  fontSize: number,
  weight: number,
): ContrastWarning | null {
  if (background === null) return null;
  const ratio = contrastOf(text, background);
  if (ratio === null) return null;
  const needs = isLarge(fontSize, weight) ? AA_LARGE : AA_TEXT;
  // Down, so 4.498 doesn't read as the 4.5 it fails.
  return ratio < needs ? { ratio: Math.floor(ratio * 100) / 100, needs } : null;
}

/** What's behind the text: its own fill, or the colour behind the element. */
export function backgroundOf(
  fill: string,
  image: string,
  isClear: boolean,
  backdrop: string | null,
): string | null {
  if (image !== '' && image !== 'none') return null;
  return isClear ? backdrop : fill;
}

// ---------------------------------------------------------------------------
// What the panel offers, from the manifest.

export type StyleTokens = {
  colours: { light: TokenRow[]; dark: TokenRow[] };
  textStyles: TextStyleRow[];
  /** Tailwind's sizes: what a size alone writes. */
  sizes: TokenRow[];
  fonts: TokenRow[];
  weights: TokenRow[];
  tracking: TokenRow[];
  radius: TokenRow[];
  shadows: TokenRow[];
  textShadows: TokenRow[];
};

/** A shadow by its name and reach. Its layers are what the panel doesn't show. */
const shadowRows = (rows: readonly TokenRow[]): TokenRow[] =>
  rows
    .map((row) => ({ ...row, px: shadowSize(row.value), value: '' }))
    .sort((a, b) => (a.px ?? 0) - (b.px ?? 0));

export function styleTokens(tokens: readonly Token[]): StyleTokens {
  const textStyles = tokens.filter(
    (token) =>
      token.namespace === '--text' &&
      (token.origin === 'ours' || token.origin === 'alias') &&
      token.name !== null,
  );
  return {
    colours: {
      light: tokenRows(tokens, '--color'),
      dark: tokenRows(tokens, '--color', true),
    },
    textStyles: tokenRows(textStyles, '--text').map((row) => {
      const style = textStyles.find((token) => token.name === row.name);
      const lineHeight = style?.textStyle?.lineHeight?.px ?? null;
      const weight = style?.textStyle?.fontWeight?.value ?? null;
      const size = row.px === null ? '' : formatValue(row.px);
      const line = lineHeight === null ? '' : ` / ${formatValue(lineHeight)}`;
      return {
        ...row,
        lineHeight,
        weight,
        value: `${size}${line}${weight ? ` · ${weight}` : ''}`,
      };
    }),
    sizes: tokenRows(
      tokens.filter((token) => token.origin === 'default'),
      '--text',
    ),
    fonts: tokenRows(tokens, '--font').map((row) => ({ ...row, value: '' })),
    weights: tokenRows(tokens, '--font-weight').map((row) => ({
      ...row,
      px: Number(row.value),
    })),
    tracking: tokenRows(tokens, '--tracking'),
    radius: tokenRows(tokens, '--radius'),
    shadows: shadowRows(tokenRows(tokens, '--shadow')),
    textShadows: shadowRows(tokenRows(tokens, '--text-shadow')),
  };
}
