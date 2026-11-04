// Spacing at a glance (TRU-2.5): the gaps between children, and which class
// names a label's token.
import { expect, it } from 'vitest';

import {
  type Box,
  gapBands,
  MAX_GAPS,
  firstFree,
  OUTWARD,
  spreadOutward,
} from '../../src/modules/selection/measure';
import {
  isSpacingRoot,
  type SpacingClass,
  spacingLabel,
  tokenFor,
} from '../../src/modules/selection/spacing-tokens';

const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): Box => ({
  left,
  top,
  width,
  height,
});

it('draws the gap between children side by side, across both of them', () => {
  // A flex row: 40 wide items 12 apart, the second one taller.
  expect(gapBands([box(0, 0, 40, 20), box(52, 0, 40, 30)])).toEqual([
    { axis: 'horizontal', box: box(40, 0, 12, 30), px: 12 },
  ]);
});

it('draws the gap between stacked children, which a margin makes too', () => {
  // Blocks with margin-bottom: 8, so no `gap` was written.
  expect(gapBands([box(0, 0, 100, 20), box(0, 28, 80, 20)])).toEqual([
    { axis: 'vertical', box: box(0, 20, 100, 8), px: 8 },
  ]);
});

it('measures the space that space-between leaves, from the boxes', () => {
  const bands = gapBands([box(0, 0, 50, 20), box(250, 0, 50, 20)]);
  expect(bands.map((band) => band.px)).toEqual([200]);
});

it('reads a wrapped row: gaps along each row, and one down at the break', () => {
  const bands = gapBands([
    box(0, 0, 40, 20),
    box(48, 0, 40, 20),
    box(0, 32, 40, 20),
  ]);
  expect(bands).toEqual([
    { axis: 'horizontal', box: box(40, 0, 8, 20), px: 8 },
    { axis: 'vertical', box: box(0, 20, 88, 12), px: 12 },
  ]);
});

it('reads a reversed row from where the children are, not their order', () => {
  expect(gapBands([box(60, 0, 40, 20), box(0, 0, 40, 20)])).toEqual([
    { axis: 'horizontal', box: box(40, 0, 20, 20), px: 20 },
  ]);
});

it('draws nothing between children that touch or overlap, or for one child', () => {
  expect(gapBands([box(0, 0, 40, 20), box(40.3, 0, 40, 20)])).toEqual([]);
  expect(gapBands([box(0, 0, 40, 20), box(30, 0, 40, 20)])).toEqual([]);
  expect(gapBands([box(0, 0, 40, 20)])).toEqual([]);
});

it('stops at the cap on a long list', () => {
  const rows = Array.from({ length: 200 }, (_, index) =>
    box(0, index * 30, 100, 20),
  );
  expect(gapBands(rows)).toHaveLength(MAX_GAPS);
});

const classes = (...list: Array<[string, string, number]>): SpacingClass[] =>
  list.map(([className, root, px]) => ({ className, root, px }));

it('names the class whose token equals the value on that side', () => {
  const set = classes(['px-400', 'px', 12], ['py-200', 'py', 8]);
  expect(tokenFor({ kind: 'padding', side: 'left' }, 12, set)).toBe('px-400');
  expect(tokenFor({ kind: 'padding', side: 'top' }, 8, set)).toBe('py-200');
  // The class reaches the side, but the value isn't its token's: bare pixels.
  expect(tokenFor({ kind: 'padding', side: 'top' }, 10, set)).toBeNull();
  // Padding classes never name a margin.
  expect(tokenFor({ kind: 'margin', side: 'left' }, 12, set)).toBeNull();
});

it('prefers the most specific class, as Tailwind orders them', () => {
  const set = classes(['pt-400', 'pt', 12], ['p-400', 'p', 12]);
  expect(tokenFor({ kind: 'padding', side: 'top' }, 12, set)).toBe('pt-400');
  expect(tokenFor({ kind: 'padding', side: 'right' }, 12, set)).toBe('p-400');
});

it('reads the logical sides by the direction', () => {
  const set = classes(['ms-200', 'ms', 8]);
  expect(tokenFor({ kind: 'margin', side: 'left' }, 8, set)).toBe('ms-200');
  expect(tokenFor({ kind: 'margin', side: 'right' }, 8, set, true)).toBe(
    'ms-200',
  );
  expect(tokenFor({ kind: 'margin', side: 'left' }, 8, set, true)).toBeNull();
});

it('names a gap from gap, gap-x, gap-y and space-*', () => {
  const set = classes(['gap-200', 'gap', 8], ['gap-y-400', 'gap-y', 12]);
  const row = { kind: 'gap', axis: 'horizontal' } as const;
  const column = { kind: 'gap', axis: 'vertical' } as const;
  expect(tokenFor(row, 8, set)).toBe('gap-200');
  expect(tokenFor(column, 12, set)).toBe('gap-y-400');
  expect(tokenFor(column, 8, set)).toBe('gap-200');
  expect(tokenFor(column, 16, classes(['space-y-500', 'space-y', 16]))).toBe(
    'space-y-500',
  );
});

it('keeps a variant as written in the label', () => {
  const set = classes(['p-200', 'p', 8], ['md:p-400', 'p', 12]);
  expect(tokenFor({ kind: 'padding', side: 'top' }, 12, set)).toBe('md:p-400');
  expect(spacingLabel('12', 'md:p-400')).toBe('md:p-400 · 12');
  expect(spacingLabel('12', null)).toBe('12');
});

it('knows which roots set spacing, and nothing that only starts like them', () => {
  for (const root of ['p', 'px', 'pe', 'pbs', 'm', 'mt', 'gap-x', 'space-y']) {
    expect(isSpacingRoot(root), root).toBe(true);
  }
  for (const root of ['pointer-events', 'max-w', 'mask', 'placeholder', 'w']) {
    expect(isSpacingRoot(root), root).toBe(false);
  }
});

it('puts a label in the first of its places that covers no chip, inside the bounds', () => {
  const bounds = { width: 400, height: 300 };
  const above = box(10, 80, 120, 20);
  const below = box(10, 130, 120, 20);
  const inside = box(10, 102, 120, 20);
  // Nothing in the way: above, where it always went.
  expect(firstFree([above, below, inside], [], bounds)).toBe(0);
  // A distance chip above the outline: the label goes below it.
  expect(firstFree([above, below, inside], [box(40, 85, 30, 16)], bounds)).toBe(
    1,
  );
  // Below runs off the frame: inside the top edge.
  expect(
    firstFree(
      [above, box(10, 290, 120, 20), inside],
      [box(40, 85, 30, 16)],
      bounds,
    ),
  ).toBe(2);
});

it('keeps the first place when none is free', () => {
  const chip = box(0, 0, 400, 300);
  expect(
    firstFree([box(10, 80, 120, 20), box(10, 130, 120, 20)], [chip], {
      width: 400,
      height: 300,
    }),
  ).toBe(0);
});

it('reads boxes whose sides are getters, as in a DOMRect', () => {
  class Rect {
    get left() {
      return 40;
    }
    get top() {
      return 85;
    }
    get width() {
      return 30;
    }
    get height() {
      return 16;
    }
  }
  expect(
    firstFree([box(10, 80, 120, 20), box(10, 130, 120, 20)], [new Rect()], {
      width: 400,
      height: 300,
    }),
  ).toBe(1);
});

const NONE = { x: 0, y: 0 };
const way = (side: string) => OUTWARD[side] ?? NONE;

it('leaves side labels centred while they have room', () => {
  // A wide box: its four labels don't meet.
  const moves = spreadOutward(
    [
      { box: box(140, 0, 40, 16), way: way('top') },
      { box: box(0, 50, 40, 16), way: way('left') },
      { box: box(280, 50, 40, 16), way: way('right') },
      { box: box(140, 100, 40, 16), way: way('bottom') },
    ],
    [],
    2,
  );
  expect(moves).toEqual([NONE, NONE, NONE, NONE]);
});

it('spreads crowded side labels outward, each along its own side', () => {
  // A small button: left and right labels meet in its middle, and both
  // touch the top one.
  const moves = spreadOutward(
    [
      { box: box(5, -4, 70, 16), way: way('top') },
      { box: box(-27, 10, 70, 16), way: way('left') },
      { box: box(37, 10, 70, 16), way: way('right') },
      { box: box(5, 24, 70, 16), way: way('bottom') },
    ],
    [],
    2,
  );
  // Left slides left until clear of the top label, which starts at x 5;
  // right slides right past its end at x 75.
  expect(moves).toEqual([NONE, { x: -38, y: 0 }, { x: 38, y: 0 }, NONE]);
});

it('never moves a fixed label, and slides around one', () => {
  const gap = box(40, 0, 30, 16);
  expect(
    spreadOutward([{ box: box(40, 0, 30, 16), way: way('bottom') }], [gap], 2),
  ).toEqual([{ x: 0, y: 16 }]);
});
