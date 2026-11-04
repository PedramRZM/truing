// The context menu's groups and where it opens (TRU-2.4): at the pointer,
// flipped and kept inside the window; a list beside its row.
import { expect, it } from 'vitest';

import {
  groupRows,
  MENU_MARGIN,
  placeAtPoint,
  placeBeside,
  placeUnder,
} from '../../src/shell/menu-layout';

const WINDOW = { width: 1000, height: 800 };
const MENU = { width: 240, height: 300 };

it('puts rows in groups in the order the groups first appear, a list after its group’s actions', () => {
  const rows = [
    { group: 'open', name: 'Open call site' },
    { group: 'copy', name: 'Copy path' },
    { group: 'open', name: 'Open definition' },
    { group: 'select', name: 'Select the parent' },
    { group: 'select', name: 'Select layer' },
    { group: 'copy', name: 'Copy selector' },
  ];
  expect(
    groupRows(rows).map(({ group, rows: grouped }) => [
      group,
      grouped.map((row) => row.name),
    ]),
  ).toEqual([
    ['open', ['Open call site', 'Open definition']],
    ['copy', ['Copy path', 'Copy selector']],
    ['select', ['Select the parent', 'Select layer']],
  ]);
});

it('opens right of and below the pointer where it fits', () => {
  expect(placeAtPoint({ x: 100, y: 120 }, MENU, WINDOW)).toEqual({
    left: 100,
    top: 120,
  });
});

it('flips to the left of the pointer near the right edge, and above it near the bottom', () => {
  expect(placeAtPoint({ x: 900, y: 700 }, MENU, WINDOW)).toEqual({
    left: 900 - MENU.width,
    top: 700 - MENU.height,
  });
});

it('stays inside the window when neither side has room', () => {
  const tall = { width: 240, height: 760 };
  expect(placeAtPoint({ x: 4, y: 400 }, tall, WINDOW)).toEqual({
    left: MENU_MARGIN,
    // Flipped above the pointer, it would start off the top: it starts at the margin.
    top: MENU_MARGIN,
  });
});

it('opens a list right of the menu, level with its row', () => {
  const menu = { left: 100, top: 120, right: 340, bottom: 420 };
  const row = { left: 104, top: 360, right: 336, bottom: 384 };
  expect(placeBeside(row, menu, { width: 240, height: 200 }, WINDOW)).toEqual({
    left: 340,
    top: 360,
  });
});

it('opens a list left of the menu without room on the right, and moves it up to fit', () => {
  const menu = { left: 700, top: 400, right: 940, bottom: 700 };
  const row = { left: 704, top: 660, right: 936, bottom: 684 };
  const list = { width: 240, height: 400 };
  expect(placeBeside(row, menu, list, WINDOW)).toEqual({
    left: 700 - list.width,
    top: WINDOW.height - MENU_MARGIN - list.height,
  });
});

const FIELD = { left: 800, top: 200, right: 980, bottom: 224 };

it('opens under a field, its end edge on the field', () => {
  expect(placeUnder(FIELD, MENU, WINDOW)).toEqual({ left: 740, top: 228 });
});

it('opens above a field with no room below', () => {
  const low = { ...FIELD, top: 700, bottom: 724 };
  expect(placeUnder(low, MENU, WINDOW)).toEqual({ left: 740, top: 396 });
});

it('stays in the window beside a narrow field at its left', () => {
  const left = { left: 10, top: 200, right: 100, bottom: 224 };
  expect(placeUnder(left, MENU, WINDOW).left).toBe(MENU_MARGIN);
});
