// The spacing overlays' geometry (TRU-2.3): bands, and what Alt-hover measures.
import { expect, it } from 'vitest';

import {
  formatPx,
  formatSize,
  labelTops,
  measureBetween,
  type Spacing,
  spacingBands,
} from '../../src/modules/selection/measure';

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };
const NOT_AUTO = { top: false, right: false, bottom: false, left: false };

function spacing(patch: Partial<Spacing>): Spacing {
  return {
    border: { left: 100, top: 100, width: 200, height: 80 },
    margin: NONE,
    autoMargin: NOT_AUTO,
    borderWidth: NONE,
    padding: NONE,
    ...patch,
  };
}

it('draws a margin band outside each side that has one, and labels an auto margin auto', () => {
  const bands = spacingBands(
    spacing({
      margin: { top: 8, right: 40, bottom: 8, left: 40 },
      autoMargin: { top: false, right: true, bottom: false, left: true },
    }),
  );
  expect(bands).toEqual([
    {
      kind: 'margin',
      side: 'top',
      box: { left: 100, top: 92, width: 200, height: 8 },
      label: '8',
    },
    {
      kind: 'margin',
      side: 'right',
      box: { left: 300, top: 100, width: 40, height: 80 },
      label: 'auto',
    },
    {
      kind: 'margin',
      side: 'bottom',
      box: { left: 100, top: 180, width: 200, height: 8 },
      label: '8',
    },
    {
      kind: 'margin',
      side: 'left',
      box: { left: 60, top: 100, width: 40, height: 80 },
      label: 'auto',
    },
  ]);
});

it('draws padding inside the border, without overlapping corners', () => {
  const bands = spacingBands(
    spacing({
      borderWidth: { top: 1, right: 1, bottom: 1, left: 1 },
      padding: { top: 12, right: 16, bottom: 12, left: 16 },
    }),
  );
  const box = (side: string) =>
    bands.find((band) => band.kind === 'padding' && band.side === side)?.box;
  expect(box('top')).toEqual({ left: 101, top: 101, width: 198, height: 12 });
  expect(box('bottom')).toEqual({
    left: 101,
    top: 167,
    width: 198,
    height: 12,
  });
  // The sides run between the top and bottom bands.
  expect(box('left')).toEqual({ left: 101, top: 113, width: 16, height: 54 });
  expect(box('right')).toEqual({ left: 283, top: 113, width: 16, height: 54 });
});

it('leaves out sides with no spacing, and negative margins, which pull rather than space', () => {
  const bands = spacingBands(
    spacing({ margin: { top: -4, right: 0, bottom: 6, left: 0 } }),
  );
  expect(bands.map((band) => `${band.kind}-${band.side}`)).toEqual([
    'margin-bottom',
  ]);
});

it('measures the gap on each axis between two boxes apart', () => {
  const picked = { left: 0, top: 0, width: 100, height: 40 };
  // Right of the pick and below it, overlapping it on neither axis.
  const other = { left: 124, top: 56, width: 50, height: 20 };
  expect(measureBetween(picked, other)).toEqual([
    {
      axis: 'horizontal',
      from: { x: 100, y: 20 },
      to: { x: 124, y: 20 },
      label: '24',
    },
    {
      axis: 'vertical',
      from: { x: 50, y: 40 },
      to: { x: 50, y: 56 },
      label: '16',
    },
  ]);
});

it('draws a gap only on an axis where the boxes are apart, through their overlap', () => {
  const picked = { left: 0, top: 0, width: 100, height: 40 };
  // Beside the pick, sharing rows 20 to 40.
  const other = { left: 110, top: 20, width: 40, height: 40 };
  expect(measureBetween(picked, other)).toEqual([
    {
      axis: 'horizontal',
      from: { x: 100, y: 30 },
      to: { x: 110, y: 30 },
      label: '10',
    },
  ]);
  // Touching boxes have no distance, and nothing says zero.
  expect(
    measureBetween(picked, { left: 100, top: 0, width: 20, height: 40 }),
  ).toEqual([]);
});

it('draws the four insets when one box contains the other, either way round', () => {
  const outer = { left: 0, top: 0, width: 200, height: 100 };
  const inner = { left: 40, top: 10, width: 100, height: 60 };
  const labels = (lines: ReturnType<typeof measureBetween>) =>
    lines.map((line) => line.label);
  expect(labels(measureBetween(inner, outer))).toEqual([
    '10',
    '60',
    '30',
    '40',
  ]);
  expect(labels(measureBetween(outer, inner))).toEqual([
    '10',
    '60',
    '30',
    '40',
  ]);
});

it('writes lengths in whole pixels, or one decimal, and sizes as W×H', () => {
  expect(formatPx(12)).toBe('12');
  expect(formatPx(12.04)).toBe('12');
  expect(formatPx(12.5)).toBe('12.5');
  expect(formatSize({ width: 120.4, height: 35.6 })).toBe('120×36');
});

const label = { height: 20, gap: 4, inset: 2 };

it('goes above an element with room over it', () => {
  expect(labelTops({ top: 100, bottom: 140 }, label, 800)[0]).toBe(76);
});

it('goes below a nav item at the top of the page, not over it', () => {
  expect(labelTops({ top: 8, bottom: 52 }, label, 800)[0]).toBe(56);
});

it('goes inside only an element that leaves no room around it', () => {
  expect(labelTops({ top: 0, bottom: 800 }, label, 800)[0]).toBe(2);
});

it('has somewhere further out, for chips that take the near places', () => {
  const tops = labelTops({ top: 100, bottom: 140 }, label, 800);
  expect(tops).toContain(144);
  expect(tops).toContain(52);
});
