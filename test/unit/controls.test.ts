// TRU-3.9: the logic under the panel's controls. Stepping, snapping and the
// nearest tokens are what keep the code on the scale.
import { describe, expect, it } from 'vitest';

import {
  findStep,
  formatValue,
  clampScrub,
  nearestStep,
  parseTyped,
  roomOf,
  scaleOf,
  scrubSteps,
  snapTyped,
  type Step,
  stepBy,
} from '../../src/shell/controls/scale';
import {
  filterRows,
  groupRows,
  nearestRows,
  stepsOf,
  tokenRows,
  type TokenRow,
} from '../../src/shell/controls/token-rows';
import type { Token } from '../../src/tokens/manifest';

const steps = (...values: number[]): Step[] =>
  values.map((value) => ({ value, token: `t${value}` }));

// The spacing tokens around ADR 0004's scale.
const SCALE = steps(0, 2, 4, 8, 12, 16, 20, 24);

describe('scaleOf', () => {
  it('sorts the steps and keeps one per value', () => {
    expect(
      scaleOf([
        { value: 8, token: 'sm' },
        { value: 2, token: 'xs' },
        { value: 8, token: 'md' },
        { value: 0, token: null },
      ]),
    ).toEqual([
      { value: 0, token: null },
      { value: 2, token: 'xs' },
      { value: 8, token: 'sm' },
    ]);
  });

  it('gives a tokenless value the token of its twin', () => {
    expect(
      scaleOf([
        { value: 0, token: null },
        { value: 0, token: 'none' },
      ]),
    ).toEqual([{ value: 0, token: 'none' }]);
  });
});

describe('nearestStep', () => {
  it('finds the closest step', () => {
    expect(nearestStep(SCALE, 17)?.value).toBe(16);
    expect(nearestStep(SCALE, 19)?.value).toBe(20);
  });

  it('gives a tie to the smaller', () => {
    expect(nearestStep(SCALE, 18)?.value).toBe(16);
    expect(nearestStep(SCALE, 10)?.value).toBe(8);
    expect(nearestStep(SCALE, 3)?.value).toBe(2);
  });

  it('keeps past the ends on the ends', () => {
    expect(nearestStep(SCALE, -5)?.value).toBe(0);
    expect(nearestStep(SCALE, 500)?.value).toBe(24);
  });

  it('has nothing on an empty scale', () => {
    expect(nearestStep([], 4)).toBeNull();
  });
});

describe('stepBy', () => {
  it('walks the scale, not the numbers', () => {
    expect(stepBy(SCALE, 8, 1)).toBe(12);
    expect(stepBy(SCALE, 12, 1)).toBe(16);
    expect(stepBy(SCALE, 16, -2)).toBe(8);
  });

  it('stops at the ends', () => {
    expect(stepBy(SCALE, 24, 1)).toBe(24);
    expect(stepBy(SCALE, 0, -1)).toBe(0);
    expect(stepBy(SCALE, 16, 40)).toBe(24);
    expect(stepBy(SCALE, 16, -40)).toBe(0);
  });

  it('takes a value off the scale to its neighbour on that side', () => {
    expect(stepBy(SCALE, 13, 1)).toBe(16);
    expect(stepBy(SCALE, 13, -1)).toBe(12);
    expect(stepBy(SCALE, 13, 2)).toBe(20);
    expect(stepBy(SCALE, 13, -2)).toBe(8);
  });

  it('brings a value past the ends back on', () => {
    expect(stepBy(SCALE, 100, 1)).toBe(24);
    expect(stepBy(SCALE, 100, -1)).toBe(24);
    expect(stepBy(SCALE, -3, 1)).toBe(0);
    expect(stepBy(SCALE, -3, -1)).toBe(0);
  });

  it('leaves the value when it goes nowhere', () => {
    expect(stepBy(SCALE, 13, 0)).toBe(13);
    expect(stepBy([], 13, 1)).toBe(13);
  });
});

describe('typing', () => {
  it('reads a number, with or without px', () => {
    expect(parseTyped('17')).toBe(17);
    expect(parseTyped(' 17 px ')).toBe(17);
    expect(parseTyped('1.5')).toBe(1.5);
    expect(parseTyped('-4')).toBe(-4);
  });

  it('reads nothing else', () => {
    expect(parseTyped('')).toBeNull();
    expect(parseTyped('abc')).toBeNull();
    expect(parseTyped('12 16')).toBeNull();
    expect(parseTyped('Infinity')).toBeNull();
  });

  it('keeps a number on the scale as it is', () => {
    expect(snapTyped(SCALE, '16')).toEqual({ status: 'exact', value: 16 });
  });

  it('snaps one off the scale, and says it did', () => {
    expect(snapTyped(SCALE, '17')).toEqual({ status: 'snapped', value: 16 });
    expect(snapTyped(SCALE, '18')).toEqual({ status: 'snapped', value: 16 });
    expect(snapTyped(SCALE, '1000')).toEqual({ status: 'snapped', value: 24 });
  });

  it('refuses what is not a number', () => {
    expect(snapTyped(SCALE, 'wide')).toEqual({ status: 'invalid' });
    expect(snapTyped([], '4')).toEqual({ status: 'invalid' });
  });
});

describe('the rest', () => {
  it('counts a scrub in whole steps, either way', () => {
    expect(scrubSteps(5)).toBe(0);
    expect(scrubSteps(6)).toBe(1);
    expect(scrubSteps(-13)).toBe(-2);
  });

  it('counts the room each way, on or off the scale', () => {
    expect(roomOf(SCALE, 16)).toEqual({ down: 5, up: 2 });
    expect(roomOf(SCALE, 13)).toEqual({ down: 5, up: 3 });
    expect(roomOf(SCALE, 24)).toEqual({ down: 7, up: 0 });
  });

  it('stops a scrub at the ends, so coming back moves at once', () => {
    const room = { down: 1, up: 2 };
    expect(clampScrub(500, room)).toBe(12);
    expect(clampScrub(-500, room)).toBe(-6);
    expect(clampScrub(7, room)).toBe(7);
    expect(scrubSteps(clampScrub(500, room) - 1)).toBe(1);
  });

  it('forgives what a browser computes', () => {
    expect(findStep(SCALE, 12.000001)?.value).toBe(12);
    expect(findStep(SCALE, 13)).toBeUndefined();
  });

  it('writes a value as a designer reads it', () => {
    expect(formatValue(16)).toBe('16');
    expect(formatValue(1.256)).toBe('1.26');
    expect(formatValue(9999)).toBe('9999');
  });
});

function token(
  key: string,
  origin: Token['origin'],
  resolved: { hex?: string; px?: number; value?: string },
): Token {
  const namespace = key.startsWith('--color') ? '--color' : '--spacing';
  const name = key.slice(namespace.length + 1) || null;
  const value = { value: resolved.value ?? '', ...resolved };
  return {
    key,
    namespace,
    name,
    category: namespace === '--color' ? 'color' : 'spacing',
    origin,
    source: null,
    value: value.value,
    light: value,
    dark: { ...value, hex: resolved.hex ? '#000000' : undefined },
    chain: { light: [], dark: [] },
    replacesDefault: false,
  };
}

const row = (name: string, extra: Partial<TokenRow> = {}): TokenRow => ({
  key: `--color-${name}`,
  name,
  value: extra.hex ?? '',
  kind: 'color',
  hex: null,
  px: null,
  family: /-\d+$/.test(name) ? name.replace(/-\d+$/, '') : null,
  ...extra,
});

describe('tokenRows', () => {
  const tokens = [
    token('--color-red-500', 'ours', { hex: '#f23030' }),
    token('--color-primary', 'alias', { hex: '#1c68d4' }),
    token('--color-lime-500', 'default', { hex: '#7ccf00' }),
    token('--color-card-foreground', 'alias', { hex: '#181b24' }),
    token('--spacing-500', 'ours', { px: 16 }),
    token('--spacing-300', 'ours', { px: 8 }),
    token('--spacing', 'default', { px: 4 }),
  ];

  it("puts semantic tokens first, then families, and leaves Tailwind's out", () => {
    expect(tokenRows(tokens, '--color').map((entry) => entry.name)).toEqual([
      'primary',
      'card-foreground',
      'red-500',
    ]);
  });

  it('orders lengths by size, and leaves the namespace base out', () => {
    expect(tokenRows(tokens, '--spacing').map((entry) => entry.name)).toEqual([
      '300',
      '500',
    ]);
  });

  it("falls back on Tailwind's where the project has none", () => {
    const defaults = [token('--color-lime-500', 'default', { hex: '#7ccf00' })];
    expect(tokenRows(defaults, '--color').map((e) => e.name)).toEqual([
      'lime-500',
    ]);
  });

  it('reads the mode it is given', () => {
    const light = tokenRows(tokens, '--color')[0];
    const dark = tokenRows(tokens, '--color', true)[0];
    expect(light?.hex).toBe('#1c68d4');
    expect(dark?.hex).toBe('#000000');
  });

  it('makes a scale of the lengths, with 0, which has no token', () => {
    expect(stepsOf(tokenRows(tokens, '--spacing'))).toEqual([
      { value: 0, token: null },
      { value: 8, token: '300' },
      { value: 16, token: '500' },
    ]);
  });
});

describe('filterRows', () => {
  const rows = [
    row('primary', { value: '#1c68d4' }),
    row('red-500', { value: '#f23030' }),
    row('red-600', { value: '#d31b31' }),
  ];

  it('finds by name, either case', () => {
    expect(filterRows(rows, 'RED').map((entry) => entry.name)).toEqual([
      'red-500',
      'red-600',
    ]);
  });

  it('finds by value', () => {
    expect(filterRows(rows, '#1c6').map((entry) => entry.name)).toEqual([
      'primary',
    ]);
  });

  it('keeps everything with nothing typed, and nothing that misses', () => {
    expect(filterRows(rows, '  ')).toHaveLength(3);
    expect(filterRows(rows, 'teal')).toEqual([]);
  });
});

describe('nearestRows', () => {
  it('finds the closest lengths, nearest first', () => {
    const rows = [
      row('8', { px: 8 }),
      row('12', { px: 12 }),
      row('16', { px: 16 }),
      row('60', { px: 60 }),
    ];
    expect(nearestRows(rows, 13, 2).map((entry) => entry.name)).toEqual([
      '12',
      '16',
    ]);
  });

  it('finds the closest colours by eye, from hex or rgb()', () => {
    const rows = [
      row('blue', { hex: '#1c68d4' }),
      row('red', { hex: '#f23030' }),
      row('near-black', { hex: '#181b24' }),
    ];
    expect(nearestRows(rows, '#3d82f2', 1)[0]?.name).toBe('blue');
    expect(nearestRows(rows, 'rgb(240, 40, 50)', 1)[0]?.name).toBe('red');
  });

  it('reads the other forms a colour comes in', () => {
    const rows = [
      row('blue', { hex: '#1c68d4' }),
      row('red', { hex: '#f23030' }),
    ];
    for (const colour of [
      'oklch(0.55 0.15 258)',
      'oklch(55% 0.15 258)',
      'oklab(0.55 -0.03 -0.15)',
      '#26c',
      'rgb(30.5 100.2 210.9)',
    ]) {
      expect(nearestRows(rows, colour, 1)[0]?.name).toBe('blue');
    }
    expect(nearestRows(rows, 'oklch(0.63 0.24 25)', 1)[0]?.name).toBe('red');
  });

  it('skips rows that have nothing to compare', () => {
    const rows = [row('shadow'), row('12', { px: 12 })];
    expect(nearestRows(rows, 13)).toHaveLength(1);
    expect(nearestRows(rows, 'not a colour')).toEqual([]);
  });
});

describe('groupRows', () => {
  const rows = [
    row('primary'),
    row('red-500'),
    row('red-600'),
    row('brand-1-500'),
  ];

  it('puts semantic tokens first, then each family by name', () => {
    expect(groupRows(rows).map((group) => group.title)).toEqual([
      'Semantic',
      'Red',
      'Brand 1',
    ]);
  });

  it("doesn't call a scale of lengths semantic", () => {
    const lengths = [row('400', { kind: 'spacing', px: 12 })];
    expect(groupRows(lengths).map((group) => group.title)).toEqual(['Tokens']);
  });

  it('opens at the nearest, and shows each token once', () => {
    const nearest = rows.slice(1, 2);
    const groups = groupRows(rows, nearest);
    expect(groups[0]?.title).toBe('Nearest');
    expect(groups.flatMap((group) => group.rows).map((r) => r.name)).toEqual([
      'red-500',
      'primary',
      'red-600',
      'brand-1-500',
    ]);
  });
});
