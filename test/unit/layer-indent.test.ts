// How the layers tree works out its indent (TRU-3.3).
import { expect, it } from 'vitest';

import {
  childLevel,
  deepestLevel,
} from '../../src/modules/selection/layer-indent';
import type { LayerNode } from '../../src/modules/selection/module';

function node(id: number, children: LayerNode[] = []): LayerNode {
  return { id, name: `n${id}`, kind: 'element', children } as LayerNode;
}

const allOpen = () => true;

it('steps a little for an only child and a full step among siblings', () => {
  expect(childLevel(2, 1)).toBe(2.25);
  expect(childLevel(2, 3)).toBe(3);
});

it('counts a chain of wrappers as far less than the same depth of branches', () => {
  const chain = node(1, [node(2, [node(3, [node(4)])])]);
  expect(deepestLevel([chain], allOpen)).toBe(0.75);

  const branches = node(1, [node(2), node(3, [node(4), node(5)])]);
  expect(deepestLevel([branches], allOpen)).toBe(2);
});

it('counts only the rows that are showing', () => {
  const tree = node(1, [node(2), node(3, [node(4), node(5)])]);
  expect(deepestLevel([tree], (candidate) => candidate.id !== 3)).toBe(1);
  expect(deepestLevel([tree], () => false)).toBe(0);
});

it('is 0 for an empty or flat tree', () => {
  expect(deepestLevel([], allOpen)).toBe(0);
  expect(deepestLevel([node(1), node(2)], allOpen)).toBe(0);
});
