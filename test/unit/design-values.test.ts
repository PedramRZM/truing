import { expect, it } from 'vitest';

import { type PropertySectionId, propertySectionsFor } from '../../src/module';
import {
  borderSideOf,
  colourText,
  fontName,
  inWords,
  kindOfPick,
  lengthReading,
  namedReading,
  number,
  shownColour,
  sides,
  sizingMode,
  textStyleOf,
  trackCount,
  visibleShadow,
} from '../../src/modules/selection/design-values';
import type { Style } from '../../src/modules/selection/module';

const token = (
  className: string,
  properties: string[],
  light: string,
  name: string,
  dark: string | null = null,
): Style => ({
  status: 'token',
  className,
  properties,
  variants: className.includes(':') ? [className.split(':')[0] ?? ''] : [],
  token: name,
  through: [],
  light,
  dark,
});

const byHand = (className: string, properties: string[]): Style => ({
  status: 'value',
  className,
  properties,
  variants: [],
});

it('shortens four sides as CSS does, in a designer’s numbers', () => {
  expect(sides(['12px', '12px', '12px', '12px'])).toBe('12');
  expect(sides(['12px', '16px', '12px', '16px'])).toBe('12 16');
  expect(sides(['12px', '16px', '8px', '16px'])).toBe('12 16 8');
  expect(sides(['12px', '16px', '8px', '4px'])).toBe('12 16 8 4');
  expect(sides(['1.256px', '1.256px', '1.256px', '1.256px'])).toBe('1.26');
});

it('reads holding only text, with no box, as Text', () => {
  const plain = {
    'background-color': 'rgba(0, 0, 0, 0)',
    'background-image': 'none',
    'box-shadow': 'none',
  };
  expect(kindOfPick('Hello', plain)).toBe('text');
  // Persian, on purpose: this goes by what's measured, not by any words.
  expect(kindOfPick('سلام', plain)).toBe('text');
  expect(kindOfPick(null, plain)).toBe('element');
  expect(kindOfPick('Save', { ...plain, 'padding-top': '4px' })).toBe(
    'element',
  );
  expect(
    kindOfPick('Save', { ...plain, 'background-color': 'rgb(1, 2, 3)' }),
  ).toBe('element');
  expect(
    kindOfPick('Save', { ...plain, 'border-top-left-radius': '6px' }),
  ).toBe('element');
});

it('takes the sizing mode from a class that says so', () => {
  const pick = (classes: string[]) => ({ classes, own: {}, parent: {} });
  expect(sizingMode('width', pick(['w-full']))).toBe('Fill');
  expect(sizingMode('width', pick(['w-1/2']))).toBe('Fill');
  expect(sizingMode('width', pick(['w-fit']))).toBe('Fit');
  expect(sizingMode('width', pick(['w-10']))).toBe('Fixed');
  expect(sizingMode('height', pick(['size-9']))).toBe('Fixed');
  expect(sizingMode('height', pick(['w-10', 'h-auto']))).toBe('Fit');
  // A class for the other axis says nothing about this one.
  expect(sizingMode('height', pick(['w-10']))).toBe('Fit');
});

it('takes the sizing mode from the layout when no class says', () => {
  const row = {
    display: 'flex',
    'flex-direction': 'row',
    'align-items': 'normal',
  };
  const flexItem = (own: Record<string, string>, parent = row) => ({
    classes: [],
    own: { display: 'block', 'align-self': 'auto', 'flex-grow': '0', ...own },
    parent,
  });
  expect(sizingMode('width', flexItem({}))).toBe('Fit');
  expect(sizingMode('width', flexItem({ 'flex-grow': '1' }))).toBe('Fill');
  expect(sizingMode('height', flexItem({}))).toBe('Fill');
  expect(
    sizingMode('height', flexItem({}, { ...row, 'align-items': 'center' })),
  ).toBe('Fit');
  expect(sizingMode('height', flexItem({ 'align-self': 'center' }))).toBe(
    'Fit',
  );

  const block = {
    classes: [],
    own: { display: 'block' },
    parent: { display: 'block' },
  };
  expect(sizingMode('width', block)).toBe('Fill');
  expect(sizingMode('height', block)).toBe('Fit');
  expect(sizingMode('width', { ...block, own: { display: 'inline' } })).toBe(
    'Fit',
  );
  expect(
    sizingMode('width', {
      ...block,
      own: { display: 'block', position: 'absolute' },
    }),
  ).toBe('Fit');
  expect(sizingMode('height', { ...block, parent: { display: 'grid' } })).toBe(
    'Fill',
  );
});

it('reads a block narrower than its parent as Fixed', () => {
  const pick = (width: number, parent: Record<string, string>) => ({
    classes: [],
    own: { display: 'block', 'margin-left': '8px', 'margin-right': '8px' },
    parent: { display: 'block', ...parent },
    width,
  });
  expect(sizingMode('width', pick(320, { width: '1000px' }))).toBe('Fixed');
  expect(sizingMode('width', pick(984, { width: '1000px' }))).toBe('Fill');
  // Inside the parent's padding and border, when its width counts them.
  const inset = {
    width: '1000px',
    'box-sizing': 'border-box',
    'padding-left': '20px',
    'padding-right': '20px',
    'border-left-width': '1px',
    'border-right-width': '1px',
  };
  expect(sizingMode('width', pick(942, inset))).toBe('Fill');
  expect(sizingMode('width', pick(800, inset))).toBe('Fixed');
});

it('links a length to the tokens that give it its value', () => {
  const styles = [
    token('px-400', ['padding-inline'], '16px', 'spacing-400'),
    token('py-200', ['padding-block'], '0.5rem (8px)', 'spacing-200'),
  ];
  expect(lengthReading(styles, /^padding/, ['8px', '16px'])).toEqual({
    token: 'spacing-400, spacing-200',
    off: false,
  });
});

it('finds the side a border is drawn on', () => {
  const side = (css: Record<string, string>) => borderSideOf(css);
  expect(side({})).toBeNull();
  expect(
    side({ 'border-bottom-width': '1px', 'border-bottom-style': 'solid' }),
  ).toBe('bottom');
  expect(
    side({
      'border-top-width': '1px',
      'border-top-style': 'none',
      'border-left-width': '2px',
      'border-left-style': 'dashed',
    }),
  ).toBe('left');
});

it('links a negative length to its token', () => {
  const styles = [token('-mt-200', ['margin-top'], '8px', 'spacing-200')];
  expect(lengthReading(styles, /^margin/, ['-8px']).token).toBe('spacing-200');
});

it('keeps a unit that isn’t pixels', () => {
  expect(sides(['50%', '50%', '50%', '50%'])).toBe('50%');
  expect(number('12.5px')).toBe('12.5');
  expect(number('normal')).toBe('normal');
});

it('reads inset classes as Fill, and an auto class as what the layout does', () => {
  const pick = (classes: string[]) => ({
    classes,
    own: { display: 'block', position: 'absolute' },
    parent: { display: 'block' },
  });
  expect(sizingMode('width', pick(['absolute', 'inset-0']))).toBe('Fill');
  expect(sizingMode('height', pick(['inset-y-0']))).toBe('Fill');
  expect(sizingMode('width', pick(['inset-y-0']))).toBe('Fit');
  const block = {
    classes: ['w-auto'],
    own: { display: 'block' },
    parent: { display: 'block', width: '100px' },
    width: 100,
  };
  expect(sizingMode('width', block)).toBe('Fill');
});

it('links a breakpoint’s class only while it shows', () => {
  const styles = [
    token('md:px-500', ['padding-inline'], '20px', 'spacing-500'),
  ];
  expect(lengthReading(styles, /^padding/, ['20px']).token).toBe('spacing-500');
  expect(lengthReading(styles, /^padding/, ['16px']).token).toBeNull();
});

it('flags a length a class sets by hand, and not a keyword', () => {
  const flagged = (className: string) =>
    lengthReading([byHand(className, ['padding'])], /^padding/, ['13px']).off;
  expect(flagged('p-[13px]')).toBe(true);
  expect(flagged('p-4')).toBe(true);
  expect(flagged('p-0')).toBe(false);
  expect(flagged('hover:p-[13px]')).toBe(false);
  expect(
    lengthReading([byHand('mx-auto', ['margin-inline'])], /^margin/, ['8px'])
      .off,
  ).toBe(false);
  expect(lengthReading([], /^padding/, ['13px'])).toEqual({
    token: null,
    off: false,
  });
});

it('names the token of a colour, and the last class wins', () => {
  const styles = [
    byHand('bg-[#123456]', ['background-color']),
    token('bg-primary', ['background-color'], '#3d82f2', 'color-primary'),
  ];
  expect(namedReading(styles, /^background-color$/)).toEqual({
    token: 'color-primary',
    off: false,
  });
  expect(namedReading(styles.toReversed(), /^background-color$/)).toEqual({
    token: null,
    off: true,
  });
  expect(namedReading([], /^background-color$/)).toEqual({
    token: null,
    off: false,
  });
});

it('names a colour’s token only if it’s what the page shows', () => {
  const styles = [
    token(
      'bg-primary',
      ['background-color'],
      '#3d82f2',
      'color-primary',
      '#112233',
    ),
  ];
  const reading = (colour: string) =>
    shownColour(styles, /^background-color$/, colour).reading.token;
  expect(reading('rgb(61, 130, 242)')).toBe('color-primary');
  // In the dark, and with an opacity on top.
  expect(reading('rgb(17, 34, 51)')).toBe('color-primary');
  expect(reading('rgba(61, 130, 242, 0.5)')).toBe('color-primary');
  // Something else won.
  expect(reading('rgb(239, 239, 239)')).toBeNull();
  // Not comparable as hex: the class is the best there is.
  expect(reading('oklch(0.5 0.1 200)')).toBe('color-primary');
});

it('reads a colour at rest while the pointer holds it in a hover state', () => {
  const styles = [
    token('bg-primary', ['background-color'], '#3d82f2', 'color-primary'),
    token('hover:bg-accent', ['background-color'], '#ffeeaa', 'color-accent'),
  ];
  // The hover's colour, and part way through its transition.
  for (const colour of ['rgb(255, 238, 170)', 'oklab(0.5 0.07 -0.19 / 0.1)']) {
    expect(shownColour(styles, /^background-color$/, colour)).toEqual({
      colour: '#3d82f2',
      text: '#3d82f2',
      reading: { token: 'color-primary', off: false },
    });
  }
});

it('counts a dark or breakpoint class when it’s what the page shows', () => {
  const styles = [
    token('bg-surface', ['background-color'], '#ffffff', 'color-surface'),
    token('dark:bg-ink', ['background-color'], '#101010', 'color-ink'),
  ];
  expect(shownColour(styles, /^background-color$/, 'rgb(16, 16, 16)')).toEqual({
    colour: 'rgb(16, 16, 16)',
    text: '#101010',
    reading: { token: 'color-ink', off: false },
  });
});

it('reads the resting token’s dark value in a dark app', () => {
  const styles = [
    token(
      'bg-primary',
      ['background-color'],
      '#3d82f2',
      'color-primary',
      '#112233',
    ),
    token(
      'group-hover/card:bg-accent',
      ['background-color'],
      '#ffeeaa',
      'color-accent',
    ),
  ];
  expect(
    shownColour(styles, /^background-color$/, 'rgb(255, 238, 170)', true).text,
  ).toBe('#112233');
});

it('writes a plain colour as hex', () => {
  expect(colourText('rgb(61, 130, 242)')).toBe('#3d82f2');
  expect(colourText('rgba(61, 130, 242, 0.5)')).toBe('#3d82f2 50%');
  expect(colourText('oklch(0.5 0.1 200)')).toBe('oklch(0.5 0.1 200)');
});

it('sees through Tailwind’s clear shadow layers', () => {
  const clear = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
  expect(visibleShadow('none')).toBeNull();
  expect(visibleShadow(`${clear}, ${clear}`)).toBeNull();
  const real = 'rgb(0, 0, 0) 0px 2px 4px 0px';
  expect(visibleShadow(`${clear}, ${real}`)).toBe(real);
  expect(visibleShadow('rgb(0, 0, 0) 0px 0px 0px 0px')).toBeNull();
});

it('finds the text style a class names', () => {
  expect(
    textStyleOf([
      token('text-primary', ['color'], '#000000', 'color-primary'),
      token(
        'text-title-md',
        ['font-size', 'line-height'],
        '20px',
        'text-title-md',
      ),
    ]),
  ).toBe('text-title-md');
  expect(textStyleOf([byHand('text-[13px]', ['font-size'])])).toBeNull();
});

it("doesn't flag a clear colour, which has no scale to be off", () => {
  const clear: Style = {
    status: 'value',
    className: 'border-transparent',
    properties: ['border-color'],
    variants: [],
  };
  expect(namedReading([clear], /^border-color$/).off).toBe(false);
});

it('reads CSS keywords in a designer’s words', () => {
  expect(inWords('flex-start')).toBe('Start');
  expect(inWords('space-between')).toBe('Space between');
  expect(fontName('"Times New Roman", serif')).toBe('Times New Roman');
  expect(trackCount('100px 100px 100px')).toBe(3);
  expect(trackCount('none')).toBe(0);
  expect(trackCount('repeat(2, 1fr) 100px')).toBe(2);
  expect(trackCount('[a] 100px [b] 100px [c]')).toBe(2);
});

it('orders sections by the set list, whichever module added them, and drops the rest', () => {
  const section = (id: PropertySectionId, from: string) => ({ id, from });
  const added = [
    section('code', 'a'),
    section('page', 'a'),
    section('layout', 'b'),
    section('selection', 'a'),
    section('layout', 'c'),
    section('text', 'd'),
  ];
  expect(propertySectionsFor('element', added)).toEqual([
    section('selection', 'a'),
    section('layout', 'b'),
    section('layout', 'c'),
    section('text', 'd'),
    section('code', 'a'),
  ]);
  expect(propertySectionsFor('text', added).map(({ id }) => id)).toContain(
    'text',
  );
  expect(propertySectionsFor('page', added)).toEqual([section('page', 'a')]);
});
