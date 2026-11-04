import { expect, it } from 'vitest';

import type { StagedChange } from '../../src/module';
import {
  activeClass,
  axisOf,
  classChange,
  fromWords,
  hideChange,
  isFlipped,
  parseClass,
  pixels,
  rotateClass,
  SCOPES,
  scopeHolds,
  scopeRank,
  scopeReason,
  sizeClass,
  sizeOfWidth,
  spacingClass,
  stagedFor,
  stagedSizeChoice,
  targetOf,
  withNegatives,
  withStaged,
} from '../../src/modules/selection/layout-classes';

const ALL = targetOf('desktop', 'all');
const TABLET_UP = targetOf('tablet', 'up');
const DESKTOP_UP = targetOf('desktop', 'up');
const PHONE_ONLY = targetOf('phone', 'only');
const TABLET_ONLY = targetOf('tablet', 'only');

it('sorts a frame into a size by the breakpoints', () => {
  expect(sizeOfWidth(390)).toBe('phone');
  expect(sizeOfWidth(767)).toBe('phone');
  expect(sizeOfWidth(768)).toBe('tablet');
  expect(sizeOfWidth(1023)).toBe('tablet');
  expect(sizeOfWidth(1024)).toBe('desktop');
});

it('offers no "up" on Phone and no "only" on Desktop', () => {
  expect(SCOPES.phone).toEqual(['all', 'only']);
  expect(SCOPES.tablet).toEqual(['all', 'up', 'only']);
  expect(SCOPES.desktop).toEqual(['all', 'up']);
});

it('prefixes a change by its size and scope', () => {
  expect(ALL.prefix).toBe('');
  expect(TABLET_UP).toMatchObject({ prefix: 'md:', scope: { from: 'md' } });
  expect(DESKTOP_UP).toMatchObject({ prefix: 'lg:', scope: { from: 'lg' } });
  expect(PHONE_ONLY).toMatchObject({
    prefix: 'max-md:',
    scope: { only: 'Phone' },
  });
  expect(TABLET_ONLY).toMatchObject({
    prefix: 'md:max-lg:',
    scope: { only: 'Tablet' },
  });
});

it('says for Claude which sizes a change is for', () => {
  expect(PHONE_ONLY.words).toContain('Phone size only');
  expect(PHONE_ONLY.words).toContain('keeping every other size');
  expect(TABLET_UP.words).toBe('from Tablet size up');
  expect(ALL.words).toBe('at every size');
});

it('tells which widths a scope holds at', () => {
  expect(scopeHolds('all', 390)).toBe(true);
  expect(scopeHolds({ from: 'md' }, 767)).toBe(false);
  expect(scopeHolds({ from: 'md' }, 768)).toBe(true);
  expect(scopeHolds({ only: 'Phone' }, 390)).toBe(true);
  expect(scopeHolds({ only: 'Phone' }, 768)).toBe(false);
  expect(scopeHolds({ only: 'Tablet' }, 768)).toBe(true);
  expect(scopeHolds({ only: 'Tablet' }, 1024)).toBe(false);
});

it('splits a class into its variants, leaving what is in brackets whole', () => {
  expect(parseClass('md:-mt-200')).toMatchObject({
    variants: ['md'],
    negative: true,
    base: 'mt-200',
  });
  expect(parseClass('min-h-[calc(1px:2px)]')).toMatchObject({
    variants: [],
    base: 'min-h-[calc(1px:2px)]',
  });
  expect(parseClass('md:max-lg:flex-col').variants).toEqual(['md', 'max-lg']);
});

it('writes spacing on the token scale, and the rest in Tailwind units', () => {
  expect(spacingClass('px', { value: 12, token: '400' })).toBe('px-400');
  expect(spacingClass('px', { value: 0, token: null })).toBe('px-0');
  expect(spacingClass('mt', { value: -6, token: '200' })).toBe('-mt-200');
  expect(sizeClass('w', 40)).toBe('w-10');
  expect(sizeClass('h', 2)).toBe('h-0.5');
  expect(rotateClass(45)).toBe('rotate-45');
  expect(rotateClass(-45)).toBe('-rotate-45');
});

it('mirrors a scale below zero, without a second zero', () => {
  expect(
    withNegatives([
      { value: 0, token: null },
      { value: 4, token: '100' },
    ]),
  ).toEqual([
    { value: -4, token: '100' },
    { value: 0, token: null },
    { value: 4, token: '100' },
  ]);
});

it('replaces the class it changes at every size', () => {
  expect(classChange(['px-400', 'py-200'], 'px', 'px-500', ALL)).toEqual({
    add: ['px-500'],
    remove: ['px-400'],
  });
});

it('takes the breakpoints with it at all sizes, as one would still win', () => {
  expect(
    classChange(['px-400', 'md:px-300', 'lg:px-200'], 'px', 'px-500', ALL)
      .remove,
  ).toEqual(['px-400', 'md:px-300', 'lg:px-200']);
});

it("keeps a state's class, whatever the scope", () => {
  expect(
    classChange(['px-400', 'hover:px-300'], 'px', 'px-500', ALL).remove,
  ).toEqual(['px-400']);
});

it('leaves a wider class it only refines', () => {
  expect(classChange(['p-400'], 'px', 'px-500', ALL)).toEqual({
    add: ['px-500'],
    remove: [],
  });
});

it('from a size up, replaces that size and larger, and leaves what is below', () => {
  expect(
    classChange(
      ['px-400', 'md:px-300', 'lg:px-200'],
      'px',
      'px-500',
      TABLET_UP,
    ),
  ).toEqual({ add: ['md:px-500'], remove: ['md:px-300', 'lg:px-200'] });
  expect(
    classChange(
      ['px-400', 'md:px-300', 'lg:px-200'],
      'px',
      'px-500',
      DESKTOP_UP,
    ),
  ).toEqual({ add: ['lg:px-500'], remove: ['lg:px-200'] });
});

it('at one size only, touches that size alone', () => {
  expect(
    classChange(
      ['flex-row', 'max-md:flex-col'],
      'direction',
      'flex-row-reverse',
      PHONE_ONLY,
    ),
  ).toEqual({ add: ['max-md:flex-row-reverse'], remove: ['max-md:flex-col'] });
  expect(
    classChange(['flex-row'], 'direction', 'flex-col', TABLET_ONLY),
  ).toEqual({ add: ['md:max-lg:flex-col'], remove: [] });
});

it("doesn't remove the class it adds", () => {
  expect(classChange(['md:px-500'], 'px', 'px-500', TABLET_UP)).toEqual({
    add: ['md:px-500'],
    remove: [],
  });
});

it('with no name, only takes the family away', () => {
  expect(classChange(['hidden', 'flex'], 'hidden', null, ALL)).toEqual({
    add: [],
    remove: ['hidden'],
  });
});

it("doesn't take a neighbour's class for its own", () => {
  expect(classChange(['gap-x-200'], 'gap', 'gap-300', ALL).remove).toEqual([]);
  expect(
    classChange(['justify-items-center'], 'justify', 'justify-end', ALL).remove,
  ).toEqual([]);
  expect(classChange(['flex-1'], 'direction', 'flex-col', ALL).remove).toEqual(
    [],
  );
  expect(classChange(['min-w-0'], 'w', 'w-10', ALL).remove).toEqual([]);
});

it('finds which class gives a value at a width, and where it comes from', () => {
  const classes = ['px-400', 'md:px-500', 'lg:px-600'];
  expect(activeClass(classes, 'px', 390)).toMatchObject({
    className: 'px-400',
    from: null,
  });
  expect(activeClass(classes, 'px', 800)).toMatchObject({
    className: 'md:px-500',
    from: 'md',
  });
  expect(activeClass(classes, 'px', 1440)).toMatchObject({
    className: 'lg:px-600',
    from: 'lg',
  });
});

it('reads a wider class when there is none of its own, and prefers its own', () => {
  expect(activeClass(['p-400'], 'px', 390)?.className).toBe('p-400');
  expect(activeClass(['px-300', 'p-400'], 'px', 390)?.className).toBe('px-300');
  // A breakpoint beats the plain class, though it's the wider one.
  expect(activeClass(['px-300', 'md:p-400'], 'px', 800)?.className).toBe(
    'md:p-400',
  );
});

it('ignores a state, and a class outside its range', () => {
  expect(activeClass(['hover:px-300'], 'px', 390)).toBeNull();
  expect(activeClass(['max-md:px-300'], 'px', 800)).toBeNull();
  expect(activeClass(['max-md:px-300'], 'px', 390)?.from).toBe('max-md');
});

it('flags a value written by hand, even one on the scale', () => {
  expect(activeClass(['min-h-[40px]'], 'min-h', 390)?.arbitrary).toBe(true);
  expect(activeClass(['min-h-10'], 'min-h', 390)?.arbitrary).toBe(false);
});

it('places a computed alignment on the pad', () => {
  expect(axisOf('center')).toBe('center');
  expect(axisOf('flex-end')).toBe('end');
  expect(axisOf('end')).toBe('end');
  expect(axisOf('flex-start')).toBe('start');
  expect(axisOf('normal')).toBe('start');
  expect(axisOf('space-between')).toBe('start');
});

it('reads computed values as a number', () => {
  expect(pixels('12px')).toBe(12);
  expect(pixels('none')).toBe(0);
  expect(pixels(undefined)).toBe(0);
  expect(stagedSizeChoice('fit-content')).toBe('Fit');
  expect(stagedSizeChoice('100%')).toBe('Fill');
  expect(stagedSizeChoice('auto')).toBe('Auto');
  expect(stagedSizeChoice('40px')).toBeNull();
  expect(isFlipped('-1 1', 'x')).toBe(true);
  expect(isFlipped('-1 1', 'y')).toBe(false);
  expect(isFlipped('1 -100%', 'y')).toBe(true);
  expect(isFlipped('none', 'x')).toBe(false);
});

const element = { selector: '#a', href: 'http://x/' };

const staged = (
  property: string,
  value: string,
  scope: StagedChange['scope'] = 'all',
): StagedChange => ({
  version: 5,
  id: `${property}-${value}`,
  module: 'selection',
  label: 'x',
  intent: 'x',
  viewport: { frame: 'desktop', width: 1440 },
  scope,
  reach: { kind: 'use' },
  element: {
    tag: 'div',
    href: element.href,
    selector: element.selector,
    classes: [],
    callSite: null,
    definition: null,
    component: null,
  },
  property,
  before: [],
  after: [{ value, token: null }],
  write: null,
  route: { by: 'claude', reason: 'x', requested: false },
  files: [],
});

it("lays what's staged over what the page reports", () => {
  const own = { 'padding-left': '4px', 'padding-right': '4px', gap: '2px' };
  expect(
    withStaged(own, [staged('padding-inline', '12px')], element, 1440),
  ).toEqual({ 'padding-left': '12px', 'padding-right': '12px', gap: '2px' });
});

it("leaves out what doesn't hold at this width, or isn't this element", () => {
  const own = { gap: '2px' };
  expect(
    withStaged(own, [staged('gap', '8px', { from: 'md' })], element, 390).gap,
  ).toBe('2px');
  expect(
    withStaged(
      own,
      [staged('gap', '8px')],
      { selector: '#other', href: element.href },
      390,
    ).gap,
  ).toBe('2px');
});

it('lets the narrower scope win, whichever was staged first', () => {
  const changes = [staged('gap', '8px', { from: 'md' }), staged('gap', '4px')];
  expect(withStaged({}, changes, element, 800).gap).toBe('8px');
  expect(withStaged({}, changes, element, 390).gap).toBe('4px');
  expect(stagedFor(changes, element, 800, 'gap')?.after[0]?.value).toBe('8px');
  expect(stagedFor(changes, element, 800, 'order')).toBeNull();
});

it('takes one-size classes with it at all sizes, as they would still win', () => {
  expect(
    classChange(
      ['px-400', 'max-md:px-300', 'md:max-lg:px-200'],
      'px',
      'px-500',
      ALL,
    ).remove,
  ).toEqual(['px-400', 'max-md:px-300', 'md:max-lg:px-200']);
});

it('from a size up, takes a one-size class that starts there, and leaves one below', () => {
  expect(
    classChange(
      ['max-md:px-300', 'md:max-lg:px-200'],
      'px',
      'px-500',
      TABLET_UP,
    ).remove,
  ).toEqual(['md:max-lg:px-200']);
});

it('sends a change at one size only to Claude, and leaves the rest to the engine', () => {
  expect(scopeReason({ only: 'Phone' })).toBe(
    'layout change at Phone size needs restructuring',
  );
  expect(scopeReason({ only: 'Tablet' })).toBe(
    'layout change at Tablet size needs restructuring',
  );
  expect(scopeReason('all')).toBeNull();
  expect(scopeReason({ from: 'md' })).toBeNull();
});

it('hiding at all sizes takes a breakpoint display with it, or it stays shown there', () => {
  expect(hideChange(['hidden', 'md:flex'], true, ALL)).toEqual({
    add: ['hidden'],
    remove: ['md:flex'],
  });
});

it('hiding from a size up leaves what is below it', () => {
  expect(hideChange(['flex', 'md:flex', 'lg:hidden'], true, TABLET_UP)).toEqual(
    {
      add: ['md:hidden'],
      remove: ['lg:hidden', 'md:flex'],
    },
  );
});

it('showing at every size only takes hidden away', () => {
  expect(hideChange(['flex', 'hidden', 'md:hidden'], false, ALL)).toEqual({
    add: [],
    remove: ['hidden', 'md:hidden'],
  });
});

it('showing from a size up puts back the display it has, so a flex frame stays one', () => {
  expect(hideChange(['flex', 'md:hidden'], false, TABLET_UP)).toEqual({
    add: ['md:flex'],
    remove: ['md:hidden'],
  });
  expect(hideChange(['md:hidden'], false, TABLET_UP).add).toEqual(['md:block']);
});

it('reads a percentage as no number', () => {
  expect(pixels('100%')).toBe(0);
  expect(pixels('fit-content')).toBe(0);
  expect(pixels('45deg')).toBe(45);
  expect(pixels('-12px')).toBe(-12);
});

it('orders scopes so the narrower come later', () => {
  expect(scopeRank('all')).toBeLessThan(scopeRank({ from: 'md' }));
  expect(scopeRank({ from: 'md' })).toBeLessThan(scopeRank({ from: 'lg' }));
  expect(scopeRank({ from: 'lg' })).toBeLessThan(scopeRank({ only: 'Tablet' }));
});

it('says where a value comes from in sizes, not in code', () => {
  expect(fromWords('md').words).toBe('From Tablet up');
  expect(fromWords('lg').words).toBe('From Desktop up');
  expect(fromWords('xl').words).toBe('From 1280 px up');
  expect(fromWords('max-md').words).toBe('Phone only');
  expect(fromWords('md:max-lg').words).toBe('Tablet only');
});
