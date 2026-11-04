// What the layout controls write and read (TRU-4.2): a value as the class that
// sets it, the classes a change replaces, which class wins at a frame's width,
// and what's staged laid over what the page reports. Pure, so every rule here
// is tested without a browser. tailwind-merge still decides conflicts at Apply.
import type { Scope, StagedChange } from '../../module';
import { formatValue, type Step } from '../../shell/controls/scale';

// ---------------------------------------------------------------------------
// Sizes and scopes. Tailwind is mobile-first: `md:` holds from 768 px up.

const BREAKPOINTS: Readonly<Record<string, number>> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export type FrameSize = 'phone' | 'tablet' | 'desktop';

export function sizeOfWidth(width: number): FrameSize {
  if (width < 768) return 'phone';
  return width < 1024 ? 'tablet' : 'desktop';
}

export type ScopeChoice = 'all' | 'up' | 'only';

/** Phone has nothing below it to go "up" from, and nothing sits above Desktop. */
export const SCOPES: Readonly<Record<FrameSize, readonly ScopeChoice[]>> = {
  phone: ['all', 'only'],
  tablet: ['all', 'up', 'only'],
  desktop: ['all', 'up'],
};

/** Where a change goes: the classes' prefix, its scope and the words for Claude. */
export type Target = { prefix: string; scope: Scope; words: string };

export function targetOf(size: FrameSize, choice: ScopeChoice): Target {
  if (choice === 'up' && size === 'tablet') {
    return {
      prefix: 'md:',
      scope: { from: 'md' },
      words: 'from Tablet size up',
    };
  }
  if (choice === 'up' && size === 'desktop') {
    return {
      prefix: 'lg:',
      scope: { from: 'lg' },
      words: 'from Desktop size up',
    };
  }
  if (choice === 'only' && size === 'phone') {
    return {
      prefix: 'max-md:',
      scope: { only: 'Phone' },
      words:
        'at Phone size only, below 768 px, keeping every other size as it is',
    };
  }
  if (choice === 'only' && size === 'tablet') {
    return {
      prefix: 'md:max-lg:',
      scope: { only: 'Tablet' },
      words:
        'at Tablet size only, from 768 px to below 1024 px, keeping every other size as it is',
    };
  }
  return { prefix: '', scope: 'all', words: 'at every size' };
}

/** Whether a change's scope holds at a width. */
export function scopeHolds(scope: Scope, width: number): boolean {
  if (scope === 'all') return true;
  if ('from' in scope) return width >= (BREAKPOINTS[scope.from] ?? Infinity);
  return scope.only === 'Phone' ? width < 768 : width >= 768 && width < 1024;
}

/** Why a change at one size only goes to Claude: the value above it must be restored. */
export function scopeReason(scope: Scope): string | null {
  return typeof scope === 'object' && 'only' in scope
    ? `layout change at ${scope.only} size needs restructuring`
    : null;
}

export type FromWords = { words: string; size: FrameSize };

/** Where a value comes from, in a designer's words: `md` reads From Tablet up. */
export function fromWords(from: string): FromWords {
  if (from === 'max-md') return { words: 'Phone only', size: 'phone' };
  if (from === 'md:max-lg') return { words: 'Tablet only', size: 'tablet' };
  if (from === 'md') return { words: 'From Tablet up', size: 'tablet' };
  if (from === 'lg') return { words: 'From Desktop up', size: 'desktop' };
  const width = BREAKPOINTS[from];
  if (width !== undefined) {
    return { words: `From ${width} px up`, size: sizeOfWidth(width) };
  }
  return { words: from, size: 'desktop' };
}

// ---------------------------------------------------------------------------
// Reading a class.

export type ParsedClass = {
  className: string;
  /** `md`, `hover`, as written, outermost first. */
  variants: string[];
  /** Written with a leading minus: `-mt-200`. */
  negative: boolean;
  /** Without its variants and minus: `mt-200`. */
  base: string;
};

export function parseClass(className: string): ParsedClass {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of className) {
    if (character === '[' || character === '(') depth++;
    if (character === ']' || character === ')') depth--;
    if (character === ':' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  const negative = current.startsWith('-');
  return {
    className,
    variants: parts,
    negative,
    base: negative ? current.slice(1) : current,
  };
}

type Range = { min: number; max: number };

/** The widths a class's variants hold at; null when a state or anything else is among them. */
function rangeOf(variants: readonly string[]): Range | null {
  const range: Range = { min: 0, max: Infinity };
  for (const variant of variants) {
    const below = variant.startsWith('max-');
    const width = BREAKPOINTS[below ? variant.slice(4) : variant];
    if (width === undefined) return null;
    if (below) range.max = Math.min(range.max, width);
    else range.min = Math.max(range.min, width);
  }
  return range;
}

/** It holds at some width, with no state behind it: `md:px-500`, not `hover:px-500`. */
export function holdsBySize(className: string): boolean {
  return rangeOf(parseClass(className).variants) !== null;
}

/** Tests a class without its variants: a pattern, or what `familyOf` builds from what classes set. */
type ClassTest = { test: (base: string) => boolean };

/** The classes that set one thing: its own, and wider ones it refines (`p-*` for `px-*`). */
export type Family = { own: ClassTest; inherits?: ClassTest };

export const FAMILIES = {
  p: { own: /^p-/ },
  px: { own: /^px-/, inherits: /^p-/ },
  py: { own: /^py-/, inherits: /^p-/ },
  pt: { own: /^pt-/, inherits: /^(?:py|p)-/ },
  pr: { own: /^pr-/, inherits: /^(?:px|p)-/ },
  pb: { own: /^pb-/, inherits: /^(?:py|p)-/ },
  pl: { own: /^pl-/, inherits: /^(?:px|p)-/ },
  mx: { own: /^mx-/, inherits: /^m-/ },
  my: { own: /^my-/, inherits: /^m-/ },
  mt: { own: /^mt-/, inherits: /^(?:my|m)-/ },
  mr: { own: /^mr-/, inherits: /^(?:mx|m)-/ },
  mb: { own: /^mb-/, inherits: /^(?:my|m)-/ },
  ml: { own: /^ml-/, inherits: /^(?:mx|m)-/ },
  gap: { own: /^gap-(?!x-|y-)/ },
  w: { own: /^w-/, inherits: /^size-/ },
  h: { own: /^h-/, inherits: /^size-/ },
  'min-w': { own: /^min-w-/ },
  'max-w': { own: /^max-w-/ },
  'min-h': { own: /^min-h-/ },
  'max-h': { own: /^max-h-/ },
  left: { own: /^left-/, inherits: /^inset-/ },
  top: { own: /^top-/, inherits: /^inset-/ },
  right: { own: /^right-/, inherits: /^inset-/ },
  bottom: { own: /^bottom-/, inherits: /^inset-/ },
  rotate: { own: /^rotate-(?![xyz]-)/ },
  'flip-x': { own: /^scale-x-/ },
  'flip-y': { own: /^scale-y-/ },
  order: { own: /^order-/ },
  self: { own: /^self-/ },
  direction: { own: /^flex-(?:row|col)(?:-reverse)?$/ },
  wrap: { own: /^flex-(?:wrap|nowrap|wrap-reverse)$/ },
  items: { own: /^items-/ },
  justify: { own: /^justify-(?!items-|self-)/ },
  'justify-items': { own: /^justify-items-/ },
  flow: { own: /^grid-flow-/ },
  hidden: { own: /^hidden$/ },
  rounded: {
    own: /^rounded(?!-(?:[trbl]|[se]|t[lr]|b[lr]|s[se]|e[se])(?:-|$))(?:-|$)/,
  },
  'rounded-tl': {
    own: /^rounded-tl(?:-|$)/,
    inherits:
      /^rounded(?:-(?:t|l))?(?!-(?:[trbl]|[se]|t[lr]|b[lr]|s[se]|e[se])(?:-|$))(?:-|$)/,
  },
  'rounded-tr': {
    own: /^rounded-tr(?:-|$)/,
    inherits:
      /^rounded(?:-(?:t|r))?(?!-(?:[trbl]|[se]|t[lr]|b[lr]|s[se]|e[se])(?:-|$))(?:-|$)/,
  },
  'rounded-br': {
    own: /^rounded-br(?:-|$)/,
    inherits:
      /^rounded(?:-(?:b|r))?(?!-(?:[trbl]|[se]|t[lr]|b[lr]|s[se]|e[se])(?:-|$))(?:-|$)/,
  },
  'rounded-bl': {
    own: /^rounded-bl(?:-|$)/,
    inherits:
      /^rounded(?:-(?:b|l))?(?!-(?:[trbl]|[se]|t[lr]|b[lr]|s[se]|e[se])(?:-|$))(?:-|$)/,
  },
  opacity: { own: /^opacity-/ },
  'border-style': {
    own: /^border-(?:solid|dashed|dotted|double|hidden|none)$/,
  },
  'text-align': { own: /^text-(?:left|center|right|justify|start|end)$/ },
  'vertical-align': {
    own: /^align-(?:baseline|top|middle|bottom|text-top|text-bottom|sub|super)$/,
  },
  leading: { own: /^leading-/ },
  tracking: { own: /^tracking-/ },
  underline: { own: /^(?:no-)?underline$/ },
  thickness: { own: /^decoration-(?:\d+|auto|from-font)$/ },
  'underline-offset': { own: /^underline-offset-/ },
} as const satisfies Record<string, Family>;

export type FamilyName = keyof typeof FAMILIES;

/** A family by name, or one built from what the element's classes set. */
export type FamilyRef = FamilyName | Family;

const familyFrom = (ref: FamilyRef): Family =>
  typeof ref === 'string' ? FAMILIES[ref] : ref;

/** The class that gives a family its value at a width, and the breakpoint it comes from. */
export type Active = {
  className: string;
  /** `md`, or null for a class that holds at every size. */
  from: string | null;
  /** Written by hand: `min-h-[40px]`. */
  arbitrary: boolean;
};

/**
 * Breakpoints beat the plain class, the larger first; then the family's own
 * class beats a wider one; then the later one, as tailwind-merge keeps it.
 */
export function activeClass(
  classes: readonly string[],
  name: FamilyRef,
  width: number,
): Active | null {
  const family = familyFrom(name);
  let best: { parsed: ParsedClass; min: number; own: boolean } | null = null;
  for (const className of classes) {
    const parsed = parseClass(className);
    const own = family.own.test(parsed.base);
    if (!own && !family.inherits?.test(parsed.base)) continue;
    const range = rangeOf(parsed.variants);
    if (!range || width < range.min || width >= range.max) continue;
    const wins =
      !best ||
      range.min > best.min ||
      (range.min === best.min && (own || !best.own));
    if (wins) best = { parsed, min: range.min, own };
  }
  if (!best) return null;
  return {
    className: best.parsed.className,
    from: best.parsed.variants.join(':') || null,
    arbitrary: best.parsed.base.includes('['),
  };
}

// ---------------------------------------------------------------------------
// Writing one.

export type ClassChange = { add: string[]; remove: string[] };

/**
 * The classes for a new value: `name` with the target's prefix, in place of
 * what it replaces. All sizes takes the family's classes at every breakpoint
 * with it, or one of them would still win; from a size up, those from that
 * size up. A state's classes (`hover:px-500`) stay.
 */
export function classChange(
  classes: readonly string[],
  family: FamilyRef,
  name: string | null,
  target: Target,
): ClassChange {
  const added = name === null ? null : `${target.prefix}${name}`;
  return {
    add: added === null ? [] : [added],
    remove: replacedBy(classes, familyFrom(family).own, target).filter(
      (name) => name !== added,
    ),
  };
}

/**
 * The classes of a kind a change at this target replaces. All sizes takes them
 * at every breakpoint, one size up or down included, or one would still win.
 * From a size up takes those that start there or higher; one size only, its own.
 */
function replacedBy(
  classes: readonly string[],
  kind: ClassTest,
  target: Target,
): string[] {
  const wanted = parseClass(target.prefix).variants;
  const floor = rangeOf(wanted)?.min ?? 0;
  const only = typeof target.scope === 'object' && 'only' in target.scope;
  return classes.filter((className) => {
    const parsed = parseClass(className);
    if (!kind.test(parsed.base)) return false;
    const range = rangeOf(parsed.variants);
    if (!range) return false;
    if (only) return parsed.variants.join(':') === wanted.join(':');
    return range.min >= floor;
  });
}

/** What sets an element's display: what `hidden` hides and showing it puts back. */
const DISPLAY =
  /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents|table)$/;

/**
 * Hiding also takes a breakpoint's display away (`hidden md:flex` stays shown at
 * `md` otherwise). Showing at a size puts back the display the element has
 * below it, so a flex frame stays one; at every size, it only takes `hidden` away.
 */
export function hideChange(
  classes: readonly string[],
  on: boolean,
  target: Target,
): ClassChange {
  if (on) {
    const added = `${target.prefix}hidden`;
    return {
      add: [added],
      remove: replacedBy(classes, /^hidden$/, target)
        .concat(
          replacedBy(classes, DISPLAY, target).filter((name) =>
            name.includes(':'),
          ),
        )
        .filter((name) => name !== added),
    };
  }
  if (target.prefix === '') {
    return { add: [], remove: replacedBy(classes, /^hidden$/, target) };
  }
  const display = classes.find((name) => DISPLAY.test(name)) ?? 'block';
  return {
    add: [`${target.prefix}${display}`],
    remove: replacedBy(classes, /^hidden$/, target),
  };
}

/** A spacing class: `px-400`, `px-0`, `-mt-200`. The token's name when it has one. */
export function spacingClass(utility: string, step: Step): string {
  const size = step.token ?? formatValue(Math.abs(step.value));
  return `${step.value < 0 ? '-' : ''}${utility}-${size}`;
}

/** What a min or max can be besides a number, as the task has them: `max-w-full`. */
export const SIZE_WORDS = ['full', 'fit', 'auto'] as const;
export type SizeWord = (typeof SIZE_WORDS)[number];

const SIZE_WORD_CSS: Readonly<Record<SizeWord, string>> = {
  full: '100%',
  fit: 'fit-content',
  auto: 'auto',
};

export function sizeWordCss(word: SizeWord): string {
  return SIZE_WORD_CSS[word];
}

/** Tailwind's own sizes, as ADR 0004 has them: `w-10` is 40 px. */
const SIZE_UNITS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24,
  28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
];

export const SIZE_STEPS: readonly Step[] = SIZE_UNITS.map((unit) => ({
  value: unit * 4,
  token: null,
}));

/** `w-10`. Past the end of the scale, nothing gets written: a field stays on its steps. */
export function sizeClass(utility: string, px: number): string {
  return `${utility}-${formatValue(px / 4)}`;
}

/** Past zero as well, for a margin or a position: `-mt-200`. */
export function withNegatives(steps: readonly Step[]): Step[] {
  const below = steps
    .filter((step) => step.value > 0)
    .map((step) => ({ ...step, value: -step.value }))
    .reverse();
  return [...below, ...steps];
}

/** A quarter turn's sixth at a time, either way. */
export const ROTATE_STEPS: readonly Step[] = Array.from(
  { length: 25 },
  (_, index) => ({ value: (index - 12) * 15, token: null }),
);

/** `rotate-45`, `-rotate-45`. */
export function rotateClass(degrees: number): string {
  return `${degrees < 0 ? '-' : ''}rotate-${formatValue(Math.abs(degrees))}`;
}

export const ORDER_STEPS: readonly Step[] = Array.from(
  { length: 13 },
  (_, index) => ({ value: index, token: null }),
);

// ---------------------------------------------------------------------------
// Flex and grid.

export type Axis = 'start' | 'center' | 'end';

/** Where a computed alignment sits on the pad: a stretch or a space-between starts it at the start. */
export function axisOf(value: string): Axis {
  if (value === 'center') return 'center';
  if (/(?:^|-)end$|^right$|^bottom$/.test(value)) return 'end';
  return 'start';
}

/** What a pad's cell writes, for one axis of a flex or a grid. */
export const AXIS_CSS: Readonly<Record<Axis, string>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

// ---------------------------------------------------------------------------
// What's staged, over what the page reports.

/** One property a change names may set several of the page's: `padding-inline` sets two. */
const EXPANDS: Readonly<Record<string, readonly string[]>> = {
  'padding-inline': ['padding-left', 'padding-right'],
  'padding-block': ['padding-top', 'padding-bottom'],
  'margin-inline': ['margin-left', 'margin-right'],
  'margin-block': ['margin-top', 'margin-bottom'],
  'border-radius': [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ],
  'border-color': [
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
  ],
  'border-style': [
    'border-top-style',
    'border-right-style',
    'border-bottom-style',
    'border-left-style',
  ],
};

const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** Widths a staged border sets. Tailwind's `border` also makes it solid, if nothing has. */
function borderOver(result: Record<string, string>, width: string): void {
  for (const side of BORDER_SIDES) {
    result[`border-${side}-width`] = width;
    if ((result[`border-${side}-style`] ?? 'none') === 'none') {
      result[`border-${side}-style`] = 'solid';
    }
  }
}

/** How specific a scope is: the wider ones go first, so the narrower win. */
export function scopeRank(scope: Scope): number {
  if (scope === 'all') return 0;
  return 'from' in scope ? (BREAKPOINTS[scope.from] ?? 0) : Infinity;
}

/** The staged changes that hold for an element at a width, the narrowest scope last. */
export function stagedOn(
  changes: readonly StagedChange[],
  element: { selector: string; href: string },
  width: number,
): StagedChange[] {
  return changes
    .filter(
      (change) =>
        change.module === 'selection' &&
        change.element?.selector === element.selector &&
        change.element.href === element.href &&
        change.after[0] !== undefined &&
        scopeHolds(change.scope, width),
    )
    .sort((a, b) => scopeRank(a.scope) - scopeRank(b.scope));
}

/** The staged change that gives a property its value at a width, if any. */
export function stagedFor(
  changes: readonly StagedChange[],
  element: { selector: string; href: string },
  width: number,
  property: string,
): StagedChange | null {
  return (
    stagedOn(changes, element, width).findLast(
      (change) => change.property === property,
    ) ?? null
  );
}

/**
 * The element's computed styles with its staged changes laid over them, for
 * what holds at this width. A preview may not have reached the frame when the
 * panel reads it, and what's staged is what the designer just said.
 */
export function withStaged(
  own: Readonly<Record<string, string>>,
  changes: readonly StagedChange[],
  element: { selector: string; href: string },
  width: number,
  /** What a change sets besides its one property: a text style sets three. */
  sets?: (change: StagedChange) => Readonly<Record<string, string>> | null,
): Record<string, string> {
  const result = { ...own };
  const mine = stagedOn(changes, element, width);
  for (const change of mine) {
    const value = change.after[0]?.value ?? '';
    const several = sets?.(change);
    if (several) {
      Object.assign(result, several);
    } else if (change.property === 'border-width') {
      borderOver(result, value);
    } else if (change.property === 'outline-width') {
      result['outline-width'] = value;
      // Tailwind's `outline-1` makes it solid too.
      result['outline-style'] = value === '0px' ? 'none' : 'solid';
    } else {
      for (const name of EXPANDS[change.property] ?? [change.property]) {
        result[name] = value;
      }
    }
  }
  return result;
}

/** A staged or computed length in pixels; 0 for what isn't one (`none`, `normal`, `100%`). */
export function pixels(value: string | undefined): number {
  if (!/^-?[\d.]+(?:px|deg)?$/.test(value ?? '')) return 0;
  return Number.parseFloat(value ?? '');
}

export type SizeChoice = 'Fixed' | 'Fit' | 'Fill' | 'Auto';

/** The mode a staged size says, or null when a computed length leaves it to the layout. */
export function stagedSizeChoice(value: string | undefined): SizeChoice | null {
  if (value === 'fit-content') return 'Fit';
  if (value === '100%') return 'Fill';
  if (value === 'auto') return 'Auto';
  return null;
}

/** The degrees a computed `rotate` reads: `45deg` is 45, `none` is 0. */
export function degrees(value: string | undefined): number {
  return pixels(value);
}

/** Whether a computed `scale` flips an axis: `-1 1`, `-100% 100%`. */
export function isFlipped(value: string | undefined, axis: 'x' | 'y'): boolean {
  const parts = (value ?? '').trim().split(/\s+/);
  const part = axis === 'x' ? parts[0] : (parts[1] ?? parts[0]);
  return part?.startsWith('-') ?? false;
}
