import { expect, it } from 'vitest';

import { PROPERTY_SECTIONS, type StagedChange } from '../../src/module';
import {
  activeClass,
  classChange,
  targetOf,
  withStaged,
} from '../../src/modules/selection/layout-classes';
import type { Style } from '../../src/modules/selection/module';
import {
  backgroundOf,
  borderSideOfClass,
  borderWidthChange,
  borderWidthClass,
  clearChange,
  contrastOf,
  contrastWarning,
  familyOf,
  type Kind,
  readShadow,
  readTextStyle,
  rowSteps,
  setsText,
  shadowName,
  shadowSize,
  sizeChange,
  styleTokens,
  textStyleChange,
  textStyleSets,
  trackingRows,
  weightClass,
} from '../../src/modules/selection/style-classes';
import type { TokenRow } from '../../src/shell/controls/token-rows';
import type { Token } from '../../src/tokens/manifest';

const ALL = targetOf('desktop', 'all');
const DESKTOP_UP = targetOf('desktop', 'up');
const element = { selector: '#a', href: 'http://x/' };

const css = (className: string, properties: string[]): Style => ({
  status: 'value',
  className,
  properties,
  variants: [],
});

const STYLES: Style[] = [
  css('text-title-m', ['font-size', 'line-height', 'font-weight']),
  css('text-sm', ['font-size', 'line-height']),
  css('text-grey-700', ['color']),
  css('text-center', ['text-align']),
  css('font-bold', ['font-weight']),
  css('font-sans', ['font-family']),
  css('leading-5', ['line-height']),
  css('tracking-wide', ['letter-spacing']),
  css('bg-card', ['background-color']),
  css('bg-cover', ['background-size']),
  css('border', ['border-style', 'border-width']),
  css('border-b-2', ['border-bottom-style', 'border-bottom-width']),
  css('border-grey-300', ['border-color']),
  css('border-dashed', ['border-style']),
  css('shadow-pane', ['box-shadow']),
  css('shadow-red-500', []),
  css('hover:text-red-500', ['color']),
  css('md:text-lg', ['font-size', 'line-height']),
];

const has = (kind: Kind, className: string): boolean =>
  familyOf(STYLES, kind).own.test(className);

const row = (name: string, px: number | null, value = ''): TokenRow => ({
  key: `--x-${name}`,
  name,
  value,
  kind: 'text',
  hex: null,
  px,
  family: null,
});

const staged = (property: string, value: string): StagedChange =>
  ({
    module: 'selection',
    property,
    scope: 'all',
    element,
    after: [{ value, token: null }],
  }) as unknown as StagedChange;

it('tells classes with one prefix apart by what they set', () => {
  expect(has('text-colour', 'text-grey-700')).toBe(true);
  expect(has('text-colour', 'text-title-m')).toBe(false);
  expect(has('text-colour', 'text-center')).toBe(false);
  expect(has('size', 'text-title-m')).toBe(true);
  expect(has('size', 'text-grey-700')).toBe(false);
  expect(has('fill', 'bg-card')).toBe(true);
  expect(has('fill', 'bg-cover')).toBe(false);
  expect(has('border-colour', 'border-grey-300')).toBe(true);
  expect(has('border-colour', 'border')).toBe(false);
  expect(has('border-width', 'border-b-2')).toBe(true);
  expect(has('border-width', 'border-dashed')).toBe(false);
  expect(has('shadow', 'shadow-pane')).toBe(true);
  expect(has('shadow', 'shadow-red-500')).toBe(false);
  expect(has('font', 'font-sans')).toBe(true);
  expect(has('font', 'font-bold')).toBe(false);
});

it("doesn't take a text style for a weight", () => {
  expect(has('weight', 'font-bold')).toBe(true);
  expect(has('weight', 'text-title-m')).toBe(false);
});

it('writes a colour and takes the one it replaces, leaving a state and other kinds', () => {
  const classes = ['text-grey-700', 'text-sm', 'hover:text-red-500', 'bg-card'];
  expect(
    classChange(classes, familyOf(STYLES, 'text-colour'), 'text-primary', ALL),
  ).toEqual({ add: ['text-primary'], remove: ['text-grey-700'] });
  expect(
    classChange(classes, familyOf(STYLES, 'fill'), 'bg-muted', DESKTOP_UP),
  ).toEqual({ add: ['lg:bg-muted'], remove: [] });
});

it('reads which size holds at a width', () => {
  const classes = ['text-sm', 'md:text-lg'];
  const size = familyOf(STYLES, 'size');
  expect(activeClass(classes, size, 400)?.className).toBe('text-sm');
  const wide = activeClass(classes, size, 900);
  expect(wide?.className).toBe('md:text-lg');
  expect(wide?.from).toBe('md');
});

it('writes a text style and takes what would fight it or keep it flagged', () => {
  expect(
    textStyleChange(
      ['text-sm', 'font-bold', 'leading-5', 'tracking-wide', 'text-grey-700'],
      STYLES,
      'label-md',
      ALL,
    ),
  ).toEqual({
    add: ['text-label-md'],
    remove: ['text-sm', 'font-bold', 'leading-5', 'tracking-wide'],
  });
});

it('choosing the style already named takes away what fights it', () => {
  expect(
    textStyleChange(['text-title-m', 'font-bold'], STYLES, 'title-m', ALL),
  ).toEqual({ add: ['text-title-m'], remove: ['font-bold'] });
});

it("doesn't take a ring for a shadow, or a divide for a border", () => {
  const styles = [
    css('ring-1', ['box-shadow']),
    css('shadow-sm', ['box-shadow']),
    css('divide-y', ['border-top-width', 'border-bottom-width']),
    css('border-2', ['border-style', 'border-width']),
  ];
  expect(familyOf(styles, 'shadow').own.test('ring-1')).toBe(false);
  expect(familyOf(styles, 'shadow').own.test('shadow-sm')).toBe(true);
  expect(familyOf(styles, 'border-width').own.test('divide-y')).toBe(false);
  expect(familyOf(styles, 'border-width').own.test('border-2')).toBe(true);
  expect(
    clearChange(
      ['shadow-sm', 'ring-1'],
      [familyOf(styles, 'shadow')],
      'shadow-none',
      ALL,
    ),
  ).toEqual({ add: [], remove: ['shadow-sm'] });
});

it('reads the shadow that holds at a width', () => {
  const linked = (className: string, name: string): Style => ({
    status: 'token',
    className,
    properties: ['box-shadow'],
    variants: [],
    token: name,
    through: [],
    light: '',
    dark: null,
  });
  const styles = [
    linked('shadow-pane', 'shadow-pane'),
    linked('md:shadow-floating-card', 'shadow-floating-card'),
    css('shadow-[0_1px_2px_black]', ['box-shadow']),
    css('shadow-none', ['box-shadow']),
    css('ring-1', ['box-shadow']),
  ];
  const read = (classes: string[], width: number) =>
    readShadow(classes, styles, 'shadow', width);
  const both = ['shadow-pane', 'md:shadow-floating-card'];
  expect(read(both, 400)).toEqual({ name: 'pane', off: false });
  expect(read(both, 1440)).toEqual({ name: 'floating-card', off: false });
  expect(read(['shadow-[0_1px_2px_black]'], 1440)).toEqual({
    name: null,
    off: true,
  });
  expect(read(['shadow-none'], 1440).off).toBe(false);
  // A ring isn't a shadow written by hand.
  expect(read(['ring-1'], 1440)).toEqual({ name: null, off: false });
});

it('writes a border width on every side it is on', () => {
  const family = familyOf(
    [
      css('border-t', ['border-top-width']),
      css('border-b', ['border-bottom-width']),
      css('border', ['border-width']),
    ],
    'border-width',
  );
  expect(borderWidthChange(['border-t', 'border-b'], family, 2, ALL)).toEqual({
    add: ['border-t-2', 'border-b-2'],
    remove: ['border-t', 'border-b'],
  });
  expect(borderWidthChange(['border'], family, 2, ALL)).toEqual({
    add: ['border-2'],
    remove: ['border'],
  });
  expect(borderWidthChange(['border-b'], family, 1, ALL)).toEqual({
    add: ['border-b'],
    remove: [],
  });
  expect(borderWidthChange([], family, 1, ALL)).toEqual({
    add: ['border'],
    remove: [],
  });
});

it('writes a text style from a size up, leaving what holds below it', () => {
  expect(
    textStyleChange(['text-sm', 'md:text-lg'], STYLES, 'label-md', DESKTOP_UP),
  ).toEqual({ add: ['lg:text-label-md'], remove: [] });
});

it('keeps a text style that is already there', () => {
  expect(textStyleChange(['text-title-m'], STYLES, 'title-m', ALL)).toEqual({
    add: ['text-title-m'],
    remove: [],
  });
});

it("keeps the style's weight when only the size changes", () => {
  expect(sizeChange(['text-title-m'], STYLES, 'lg', ALL, 'font-bold')).toEqual({
    add: ['text-lg', 'font-bold'],
    remove: ['text-title-m'],
  });
  expect(sizeChange(['text-sm'], STYLES, 'lg', ALL, null)).toEqual({
    add: ['text-lg'],
    remove: ['text-sm'],
  });
});

it('finds the weight class for a value', () => {
  const rows = [row('bold', 700, '700'), row('medium', 500, '500')];
  expect(weightClass(rows, '700')).toBe('font-bold');
  expect(weightClass(rows, null)).toBeNull();
  expect(weightClass(rows, '450')).toBeNull();
});

it("takes a value away, or says so when taking a class away can't", () => {
  const fill = familyOf(STYLES, 'fill');
  expect(clearChange(['bg-card'], [fill], 'bg-transparent', ALL)).toEqual({
    add: [],
    remove: ['bg-card'],
  });
  expect(clearChange(['flex'], [fill], 'bg-transparent', ALL)).toEqual({
    add: ['bg-transparent'],
    remove: [],
  });
  expect(
    clearChange(['bg-card'], [fill], 'bg-transparent', DESKTOP_UP),
  ).toEqual({ add: ['lg:bg-transparent'], remove: [] });
});

it('takes a whole border away', () => {
  expect(
    clearChange(
      ['border', 'border-grey-300', 'border-dashed', 'flex'],
      [
        familyOf(STYLES, 'border-width'),
        familyOf(STYLES, 'border-colour'),
        'border-style',
      ],
      'border-0',
      ALL,
    ),
  ).toEqual({
    add: [],
    remove: ['border', 'border-grey-300', 'border-dashed'],
  });
});

const STYLE_ROWS = [row('title-m', 16), row('label-md', 14)];

it('reads a named text style, and nothing as nothing', () => {
  expect(readTextStyle(['text-title-m'], STYLES, STYLE_ROWS, 1440, [])).toEqual(
    { name: 'title-m', off: false },
  );
  expect(readTextStyle(['flex'], STYLES, STYLE_ROWS, 1440, [])).toEqual({
    name: null,
    off: false,
  });
});

it('flags what fights a text style, or stands in for one', () => {
  for (const fight of ['font-bold', 'leading-5', 'tracking-wide']) {
    expect(
      readTextStyle(['text-title-m', fight], STYLES, STYLE_ROWS, 1440, []),
    ).toEqual({ name: 'title-m', off: true });
  }
  expect(readTextStyle(['text-sm'], STYLES, STYLE_ROWS, 1440, [])).toEqual({
    name: null,
    off: true,
  });
  expect(readTextStyle(['font-bold'], STYLES, STYLE_ROWS, 1440, [])).toEqual({
    name: null,
    off: true,
  });
});

it('reads what is staged over the classes', () => {
  const read = (changes: StagedChange[]) =>
    readTextStyle(['text-sm', 'font-bold'], STYLES, STYLE_ROWS, 1440, changes);
  expect(read([staged('text-style', 'label-md')])).toEqual({
    name: 'label-md',
    off: false,
  });
  expect(
    read([staged('text-style', 'label-md'), staged('font-weight', '400')]),
  ).toEqual({ name: 'label-md', off: true });
  expect(
    read([staged('text-style', 'label-md'), staged('font-size', '18px')]),
  ).toEqual({ name: null, off: true });
});

it("lays a staged text style's values over the page's, and a later change over that", () => {
  const rows = [
    { ...row('title-m', 16), lineHeight: 18, weight: '700' },
    { ...row('body-sm', 13), lineHeight: 20, weight: null },
  ];
  expect(textStyleSets(rows, 'title-m')).toEqual({
    'font-size': '16px',
    'line-height': '18px',
    'font-weight': '700',
  });
  expect(textStyleSets(rows, 'body-sm')).toEqual({
    'font-size': '13px',
    'line-height': '20px',
  });
  expect(textStyleSets(rows, 'nope')).toBeNull();

  expect(
    withStaged(
      { 'font-size': '12px', 'font-weight': '300' },
      [staged('text-style', 'title-m'), staged('font-weight', '400')],
      element,
      1440,
      (entry) =>
        entry.property === 'text-style'
          ? textStyleSets(rows, entry.after[0]?.value)
          : null,
    ),
  ).toMatchObject({
    'font-size': '16px',
    'line-height': '18px',
    'font-weight': '400',
  });
});

it('lays a staged radius and border over every corner and side', () => {
  const shown = withStaged(
    {
      'border-top-left-radius': '0px',
      'border-top-width': '0px',
      'border-top-style': 'none',
    },
    [staged('border-radius', '12px'), staged('border-width', '1px')],
    element,
    1440,
  );
  expect(shown['border-top-left-radius']).toBe('12px');
  expect(shown['border-bottom-right-radius']).toBe('12px');
  expect(shown['border-left-width']).toBe('1px');
  expect(shown['border-top-style']).toBe('solid');
});

it('writes a border on the side it is on', () => {
  expect(borderWidthClass(1, null)).toBe('border');
  expect(borderWidthClass(2, null)).toBe('border-2');
  expect(borderWidthClass(0, null)).toBe('border-0');
  expect(borderWidthClass(2, 'b')).toBe('border-b-2');
  expect(borderWidthClass(1, 'b')).toBe('border-b');
  expect(borderSideOfClass('border-b-2')).toBe('b');
  expect(borderSideOfClass('md:border-x')).toBe('x');
  expect(borderSideOfClass('border-2')).toBeNull();
  expect(borderSideOfClass(null)).toBeNull();
});

it('reads rounded classes apart from one another', () => {
  const classes = ['rounded-lg', 'rounded-tl-xl', 'rounded-s-sm'];
  expect(activeClass(classes, 'rounded', 1440)?.className).toBe('rounded-lg');
  expect(activeClass(classes, 'rounded-tl', 1440)?.className).toBe(
    'rounded-tl-xl',
  );
  expect(activeClass(['rounded-lg'], 'rounded-tr', 1440)?.className).toBe(
    'rounded-lg',
  );
  expect(activeClass(['rounded-t-lg'], 'rounded-tr', 1440)?.className).toBe(
    'rounded-t-lg',
  );
  expect(activeClass(['rounded-b-lg'], 'rounded-tr', 1440)).toBeNull();
  expect(activeClass(['rounded-[18px]'], 'rounded', 1440)?.arbitrary).toBe(
    true,
  );
  expect(activeClass(['rounded'], 'rounded', 1440)?.className).toBe('rounded');
  expect(activeClass(['rounded-sm'], 'rounded', 1440)?.className).toBe(
    'rounded-sm',
  );
  expect(activeClass(['rounded-s-sm'], 'rounded', 1440)).toBeNull();
});

it('steps through rows that carry a number', () => {
  expect(
    rowSteps([row('bold', 700), row('thin', 100), row('x', null)]),
  ).toEqual([
    { value: 100, token: 'thin' },
    { value: 700, token: 'bold' },
  ]);
});

it('works out letter spacing at the size', () => {
  const [wide] = trackingRows([row('wide', null, '0.025em')], 16);
  expect(wide?.px).toBeCloseTo(0.4);
  expect(wide?.value).toBe('0.4');
});

it('measures a shadow by its largest blur', () => {
  expect(shadowSize('0 4px 12px 0 rgb(24 27 36 / 0.05)')).toBe(12);
  expect(
    shadowSize(
      '0 1px 2px rgb(23 26 33 / 0.05), 0 8px 24px rgb(23 26 33 / 0.07)',
    ),
  ).toBe(24);
  expect(shadowSize('none')).toBeNull();
  expect(shadowName('shadow-floating-card')).toBe('floating-card');
  expect(shadowName('text-shadow-sm')).toBe('sm');
});

it('measures contrast against WCAG', () => {
  expect(contrastOf('#000000', '#ffffff')).toBeCloseTo(21);
  expect(contrastOf('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBeCloseTo(21);
  expect(contrastOf('oklch(0 0 0)', '#fff')).toBeCloseTo(21);
  // Half black over white is a mid grey, not black.
  expect(contrastOf('rgba(0, 0, 0, 0.5)', '#ffffff')).toBeLessThan(5);
  expect(contrastOf('#000', 'rgba(255, 255, 255, 0.5)')).toBeNull();
  expect(contrastOf('#000', 'not a colour')).toBeNull();
});

it('warns under 4.5:1, or 3:1 when large', () => {
  // #949494 on white is about 3.03:1.
  expect(contrastWarning('#949494', '#ffffff', 14, 400)?.needs).toBe(4.5);
  expect(contrastWarning('#949494', '#ffffff', 24, 400)).toBeNull();
  expect(contrastWarning('#949494', '#ffffff', 19, 700)).toBeNull();
  expect(contrastWarning('#949494', '#ffffff', 19, 400)?.needs).toBe(4.5);
  expect(contrastWarning('#000000', '#ffffff', 14, 400)).toBeNull();
  // Never rounds up to the ratio it failed.
  const close = contrastWarning('#767676', '#f8f8f8', 14, 400);
  expect(close?.ratio).toBeLessThan(4.5);
  expect(contrastWarning('#949494', null, 14, 400)).toBeNull();
});

it('takes the background from the fill, or the colour behind it', () => {
  expect(backgroundOf('#111', 'none', false, '#222')).toBe('#111');
  expect(backgroundOf('', 'none', true, '#222')).toBe('#222');
  expect(
    backgroundOf('#111', 'linear-gradient(red, blue)', false, '#222'),
  ).toBeNull();
  expect(backgroundOf('', 'none', true, null)).toBeNull();
});

it('shows Text on an element that holds text or sets type', () => {
  expect(setsText('Hello', [])).toBe(true);
  expect(setsText(null, [css('text-grey-700', ['color'])])).toBe(true);
  expect(setsText(null, [css('md:text-lg', ['font-size'])])).toBe(true);
  expect(setsText(null, [css('hover:text-red-500', ['color'])])).toBe(false);
  expect(setsText(null, [css('flex', ['display'])])).toBe(false);
  expect(PROPERTY_SECTIONS.element).toContain('text');
  expect(PROPERTY_SECTIONS.element).toContain('underline');
});

const designToken = (
  fields: Partial<Token> & Pick<Token, 'namespace' | 'name' | 'origin'>,
): Token =>
  ({
    key: `${fields.namespace}-${fields.name}`,
    category: 'other',
    value: '',
    light: { value: '' },
    dark: { value: '' },
    chain: { light: [], dark: [] },
    source: null,
    replacesDefault: false,
    ...fields,
  }) as Token;

it("offers each kind's own tokens, for each mode", () => {
  const offered = styleTokens([
    designToken({
      namespace: '--color',
      name: 'primary',
      origin: 'alias',
      light: { value: '', hex: '#111111' },
      dark: { value: '', hex: '#eeeeee' },
    }),
    designToken({
      namespace: '--text',
      name: 'title-m',
      origin: 'ours',
      light: { value: '16px', px: 16 },
      textStyle: {
        lineHeight: { value: '18px', px: 18, source: null },
        fontWeight: { value: '700', source: null },
      },
    }),
    designToken({
      namespace: '--text',
      name: 'sm',
      origin: 'default',
      light: { value: '0.875rem', px: 14 },
    }),
    designToken({
      namespace: '--font-weight',
      name: 'bold',
      origin: 'default',
      light: { value: '700' },
    }),
    designToken({
      namespace: '--shadow',
      name: 'pane',
      origin: 'ours',
      light: { value: '0 8px 24px rgb(0 0 0 / 0.1)' },
    }),
    designToken({
      namespace: '--shadow',
      name: 'lg',
      origin: 'default',
      light: { value: '0 10px 15px rgb(0 0 0 / 0.1)' },
    }),
  ]);
  expect(offered.colours.light[0]?.hex).toBe('#111111');
  expect(offered.colours.dark[0]?.hex).toBe('#eeeeee');
  // Only styles are offered as styles, and only Tailwind's sizes as sizes.
  expect(offered.textStyles.map((entry) => entry.name)).toEqual(['title-m']);
  expect(offered.textStyles[0]).toMatchObject({
    lineHeight: 18,
    weight: '700',
    value: '16 / 18 · 700',
  });
  expect(offered.sizes.map((entry) => entry.name)).toEqual(['sm']);
  expect(offered.weights[0]?.px).toBe(700);
  // A token, not its layers; ours where the project has them.
  expect(offered.shadows).toEqual([
    expect.objectContaining({ name: 'pane', value: '', px: 24 }),
  ]);
});
