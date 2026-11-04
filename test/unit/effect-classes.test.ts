import { describe, expect, it } from 'vitest';

import type { StagedChange } from '../../src/module';
import {
  BLEND,
  DIRECTIONS,
  filtersOf,
  FILTERS,
  gradientCss,
  gradientGone,
  holdsClassOf,
  innerShadow,
  LINES,
  outerShadow,
  parseGradient,
  readGradient,
  readWord,
  RING_FAMILIES,
  ringOf,
  shapeClass,
  solidToGradient,
  STACK,
  wordChange,
} from '../../src/modules/selection/effect-classes';
import {
  targetOf,
  withStaged,
} from '../../src/modules/selection/layout-classes';

const all = targetOf('desktop', 'all');
const up = targetOf('desktop', 'up');

describe('parseGradient', () => {
  it('reads what Chrome reports for Tailwind 4', () => {
    expect(
      parseGradient(
        'linear-gradient(to right in oklab, rgb(28, 104, 212) 0%, rgb(0, 0, 0) 100%)',
      ),
    ).toEqual({
      kind: 'linear',
      direction: 'to right',
      stops: [
        { colour: 'rgb(28, 104, 212)', position: 0 },
        { colour: 'rgb(0, 0, 0)', position: 100 },
      ],
    });
  });

  it('reads an angle, a shape, and stops with no position', () => {
    expect(parseGradient('linear-gradient(45deg, red, blue)')?.direction).toBe(
      '45deg',
    );
    expect(parseGradient('radial-gradient(red 10%, blue)')).toEqual({
      kind: 'radial',
      direction: null,
      stops: [
        { colour: 'red', position: 10 },
        { colour: 'blue', position: null },
      ],
    });
  });

  it('says nothing of an image or nothing', () => {
    expect(parseGradient('url("a.png")')).toBeNull();
    expect(parseGradient('none')).toBeNull();
  });
});

describe('readGradient', () => {
  const css =
    'linear-gradient(to right in oklab, rgb(1, 2, 3) 0%, rgb(4, 5, 6) 100%)';

  it('reads the app toast: its older spelling, its stops and their tokens', () => {
    const reading = readGradient(
      ['w-full', 'bg-gradient-to-r', 'from-brand-1-500', 'to-brand-2-500'],
      css,
      1440,
    );
    expect(reading.written).toBe(true);
    expect(reading.kind).toBe('linear');
    expect(reading.direction).toBe('r');
    expect(reading.from).toEqual({
      token: 'brand-1-500',
      colour: 'rgb(1, 2, 3)',
      position: 0,
    });
    expect(reading.to.token).toBe('brand-2-500');
    expect(reading.via).toBeNull();
  });

  it('reads positions from their classes, and tells a position from a colour', () => {
    const reading = readGradient(
      ['bg-linear-to-b', 'from-primary', 'from-10%', 'via-red-500', 'to-90%'],
      css,
      1440,
    );
    expect(reading.from.token).toBe('primary');
    expect(reading.from.position).toBe(10);
    expect(reading.via?.token).toBe('red-500');
    expect(reading.to.token).toBeNull();
    expect(reading.to.position).toBe(90);
  });

  it('says a gradient by hand can only be read', () => {
    const reading = readGradient(
      ['bg-[linear-gradient(to_right,red,blue)]'],
      'linear-gradient(to right, rgb(255, 0, 0), rgb(0, 0, 255))',
      1440,
    );
    expect(reading.written).toBe(false);
    expect(reading.direction).toBe('r');
    expect(reading.from.colour).toBe('rgb(255, 0, 0)');
  });

  it('draws what it read', () => {
    expect(
      gradientCss({
        kind: 'linear',
        direction: 'br',
        directionText: '',
        written: true,
        from: { token: null, colour: 'red', position: 0 },
        via: null,
        to: { token: null, colour: 'blue', position: 100 },
      }),
    ).toBe('linear-gradient(to bottom right, red 0%, blue 100%)');
  });

  it('knows every direction Tailwind writes', () => {
    expect(DIRECTIONS.map((entry) => entry.name).sort()).toEqual(
      ['b', 'bl', 'br', 'l', 'r', 't', 'tl', 'tr'].sort(),
    );
  });
});

describe('writing a gradient', () => {
  it('keeps the spelling the element has, so cn() can merge the two', () => {
    expect(shapeClass(['bg-gradient-to-r'], 'linear', 'l')).toBe(
      'bg-gradient-to-l',
    );
    expect(shapeClass(['bg-primary'], 'linear', 'l')).toBe('bg-linear-to-l');
    expect(shapeClass(['bg-gradient-to-r'], 'radial', 'l')).toBe('bg-radial');
  });

  it('turns a solid fill into a gradient, replacing its class', () => {
    expect(
      solidToGradient(
        ['bg-primary', 'p-400'],
        { own: /^bg-primary$/ },
        'primary',
        all,
      ),
    ).toEqual({
      add: ['bg-linear-to-r', 'from-primary', 'to-transparent'],
      remove: ['bg-primary'],
    });
  });

  it('writes from a size up, leaving the classes below it', () => {
    expect(
      solidToGradient(['bg-primary'], { own: /^bg-primary$/ }, 'primary', up),
    ).toEqual({
      add: ['lg:bg-linear-to-r', 'lg:from-primary', 'lg:to-transparent'],
      remove: [],
    });
  });

  it('takes every part away, and clipped text with it', () => {
    expect(
      gradientGone(
        [
          'bg-gradient-to-r',
          'from-a-500',
          'from-10%',
          'via-b-500',
          'to-c-500',
          'bg-clip-text',
          'text-transparent',
          'p-400',
        ],
        all,
      ).remove.sort(),
    ).toEqual(
      [
        'bg-gradient-to-r',
        'from-a-500',
        'from-10%',
        'via-b-500',
        'to-c-500',
        'bg-clip-text',
        'text-transparent',
      ].sort(),
    );
  });

  it('leaves a text colour that was never clipped', () => {
    expect(
      gradientGone(['bg-linear-to-r', 'text-transparent'], all).remove,
    ).toEqual(['bg-linear-to-r']);
  });
});

describe('a word among a few', () => {
  const normal = BLEND.words[0];

  it('removes the class for the default, and says it at a use', () => {
    if (!normal) throw new Error('No default word.');
    expect(wordChange(BLEND, normal, ['mix-blend-multiply'], all)).toEqual({
      add: [],
      remove: ['mix-blend-multiply'],
    });
    expect(wordChange(BLEND, normal, [], all)).toEqual({
      add: ['mix-blend-normal'],
      remove: [],
    });
    expect(wordChange(BLEND, normal, ['mix-blend-multiply'], up)).toEqual({
      add: ['lg:mix-blend-normal'],
      remove: [],
    });
  });

  it('reads the class, then the page, then what is staged', () => {
    expect(
      readWord(STACK, ['z-10'], { 'z-index': '10' }, 1440, undefined).text,
    ).toBe('10');
    expect(
      readWord(STACK, [], { 'z-index': 'auto' }, 1440, undefined).text,
    ).toBe('Auto');
    expect(readWord(STACK, ['z-10'], {}, 1440, '30').text).toBe('30');
  });

  it('flags a class by hand, and shows its number', () => {
    expect(
      readWord(STACK, ['z-[1350]'], { 'z-index': '1350' }, 1440, undefined),
    ).toEqual({ word: null, text: '1350', off: true });
  });

  it('tells cut-short text from no wrap, which read the same on the page', () => {
    expect(
      readWord(
        LINES,
        ['truncate'],
        { 'white-space': 'nowrap' },
        1440,
        undefined,
      ).text,
    ).toBe('One, cut short');
    expect(
      readWord(LINES, [], { 'white-space': 'nowrap' }, 1440, undefined).text,
    ).toBe('No wrap');
    expect(readWord(LINES, [], {}, 1440, 'clamp-2').text).toBe('2, cut short');
  });
});

describe('filters', () => {
  const named = (id: string) => {
    const spec = FILTERS.find((entry) => entry.id === id);
    if (!spec) throw new Error(`No filter ${id}.`);
    return spec;
  };

  it('reads each filter in the page as its number', () => {
    const on = filtersOf({
      filter: 'blur(8px) brightness(1.1) grayscale(1)',
      'backdrop-filter': 'blur(12px)',
    });
    expect(on.get(named('blur'))).toBe(8);
    expect(on.get(named('brightness'))).toBe(110);
    expect(on.get(named('grayscale'))).toBe(100);
    expect(on.get(named('backdrop-blur'))).toBe(12);
    expect(on.has(named('contrast'))).toBe(false);
  });

  it('lays what is staged over the page, and none takes it off', () => {
    const on = filtersOf({
      filter: 'blur(8px) contrast(1.25)',
      'filter-blur': 'none',
      'filter-saturate': '150',
    });
    expect(on.has(named('blur'))).toBe(false);
    expect(on.get(named('contrast'))).toBe(125);
    expect(on.get(named('saturate'))).toBe(150);
  });

  it('writes each on Tailwind scale, and tells a blur from a backdrop blur', () => {
    expect(named('blur').classOf(8)).toBe('blur-sm');
    expect(named('blur').classOf(0)).toBe('blur-none');
    expect(named('brightness').classOf(110)).toBe('brightness-110');
    expect(named('backdrop-blur').classOf(64)).toBe('backdrop-blur-3xl');
    expect(named('blur').family.own.test('backdrop-blur-sm')).toBe(false);
    expect(named('blur').family.own.test('blur')).toBe(true);
  });
});

describe('shadows, rings and inner shadows', () => {
  const clear = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
  const ring = 'rgb(1, 2, 3) 0px 0px 0px 2px';
  const outer = 'rgba(0, 0, 0, 0.1) 0px 4px 12px 0px';
  const inner = 'rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset';

  it('tells the three apart in what Tailwind writes', () => {
    const css = [clear, inner, ring, outer].join(', ');
    expect(outerShadow(css)).toBe(outer);
    expect(innerShadow(css)).toBe(inner);
    expect(ringOf(css)).toEqual({ width: 2, colour: 'rgb(1, 2, 3)' });
  });

  it('finds nothing in clear layers', () => {
    expect(outerShadow(`${clear}, ${clear}`)).toBeNull();
    expect(innerShadow(clear)).toBeNull();
    expect(ringOf(clear)).toBeNull();
    expect(outerShadow('none')).toBeNull();
  });

  it('counts a ring that holds, not one behind a state', () => {
    expect(holdsClassOf(['ring-2'], RING_FAMILIES.width)).toBe(true);
    expect(holdsClassOf(['ring'], RING_FAMILIES.width)).toBe(true);
    expect(holdsClassOf(['md:ring-2'], RING_FAMILIES.width)).toBe(true);
    expect(holdsClassOf(['focus:ring-2'], RING_FAMILIES.width)).toBe(false);
    expect(holdsClassOf(['ring-primary'], RING_FAMILIES.width)).toBe(false);
  });
});

describe('an outline staged', () => {
  const staged = (value: string): StagedChange =>
    ({
      module: 'selection',
      property: 'outline-width',
      scope: 'all',
      element: { selector: 'a', href: 'h' },
      after: [{ value, token: null }],
    }) as StagedChange;

  it('reads solid when added, and none when taken away', () => {
    const own = { 'outline-style': 'none', 'outline-width': '3px' };
    const element = { selector: 'a', href: 'h' };
    expect(withStaged(own, [staged('1px')], element, 1440)).toMatchObject({
      'outline-style': 'solid',
      'outline-width': '1px',
    });
    expect(withStaged(own, [staged('0px')], element, 1440)).toMatchObject({
      'outline-style': 'none',
    });
  });
});
