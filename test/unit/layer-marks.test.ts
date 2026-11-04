// From a row of the tree to the elements hide and lock work on (TRU-3.7).
import { expect, it } from 'vitest';

import {
  elementsOfRow,
  markedRows,
  outerElements,
} from '../../src/modules/selection/layer-marks';
import type { LayerNode } from '../../src/modules/selection/module';

function element(id: number, children: LayerNode[] = []): LayerNode {
  return { id, name: 'div', kind: 'element', children };
}

function component(id: number, children: LayerNode[]): LayerNode {
  return { id, name: 'Card', kind: 'client', children };
}

const TREE: LayerNode[] = [
  element(1, [
    component(2, [element(3, [element(4)]), component(5, [element(6)])]),
    component(7, []),
    element(8),
  ]),
];

it('an element stands for itself, whatever it holds', () => {
  expect(outerElements(element(3, [element(4)]))).toEqual([3]);
});

it('a component stands for its outermost elements, through nested components', () => {
  expect(elementsOfRow(TREE, 2)).toEqual([3, 6]);
});

it('a component that draws nothing stands for nothing', () => {
  expect(outerElements(component(7, []))).toEqual([]);
});

it('finds a row at any depth, and nothing for an id not in the tree', () => {
  expect(elementsOfRow(TREE, 6)).toEqual([6]);
  expect(elementsOfRow(TREE, 99)).toEqual([]);
});

it('a Server Component split across the tree stands for every part', () => {
  const split: LayerNode[] = [
    element(1, [component(2, [element(3)]), element(4)]),
    component(2, [element(5)]),
  ];
  expect(elementsOfRow(split, 2)).toEqual([3, 5]);
  expect(markedRows(split, [3]).has(2)).toBe(false);
  expect(markedRows(split, [3, 5]).has(2)).toBe(true);
});

it('marks the elements in the list and nothing else', () => {
  expect([...markedRows(TREE, [8])]).toEqual([8]);
});

it("doesn't mark what is inside a marked element: only its own row is", () => {
  expect([...markedRows(TREE, [3])]).toEqual([3]);
});

it('marks a component only once all its outermost elements are', () => {
  expect(markedRows(TREE, [3]).has(2)).toBe(false);
  const both = markedRows(TREE, [3, 6]);
  expect(both.has(5)).toBe(true);
  expect(both.has(2)).toBe(true);
});

it("a child that renders nothing doesn't stop its component reading as marked", () => {
  const tree = [component(2, [component(7, []), element(3)])];
  expect(markedRows(tree, [3]).has(2)).toBe(true);
});

it('never marks a component that draws nothing', () => {
  expect(markedRows(TREE, [8]).has(7)).toBe(false);
});

it('marks nothing with an empty list', () => {
  expect(markedRows(TREE, []).size).toBe(0);
});
