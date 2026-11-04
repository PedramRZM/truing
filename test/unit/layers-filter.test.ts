// The layers filter (TRU-2.3): matches keep their ancestors, in reading order.
import { expect, it } from 'vitest';

import { filterLayers } from '../../src/modules/selection/layers-filter';
import type { LayerNode } from '../../src/modules/selection/module';

function node(
  id: number,
  name: string,
  children: LayerNode[] = [],
  extra: Partial<LayerNode> = {},
): LayerNode {
  return { id, name, kind: 'element', children, ...extra };
}

const TREE: LayerNode[] = [
  node(1, 'main', [
    node(
      2,
      'ClientPanel',
      [
        node(3, 'button', [], { text: 'Pressed 0 times' }),
        node(4, 'ul', [
          node(5, 'li', [], { text: 'Alpha' }),
          node(6, 'li', [], { text: 'Beta' }),
        ]),
      ],
      { kind: 'client' },
    ),
    node(7, 'h1', [], { text: 'Inspect fixture' }),
  ]),
];

it('keeps a match and every ancestor, and drops the rest', () => {
  const { nodes, matches } = filterLayers(TREE, 'beta');
  expect(matches).toEqual([6]);
  expect(nodes).toEqual([
    node(1, 'main', [
      node(
        2,
        'ClientPanel',
        [node(4, 'ul', [node(6, 'li', [], { text: 'Beta' })])],
        {
          kind: 'client',
        },
      ),
    ]),
  ]);
});

it('matches names and text without case, and lists the matches top to bottom', () => {
  // ClientPanel holds “li” too; it comes first, as it does in the tree.
  expect(filterLayers(TREE, 'LI').matches).toEqual([2, 5, 6]);
  // A component by its name; its children go unless they match too.
  const panel = filterLayers(TREE, 'clientpanel');
  expect(panel.matches).toEqual([2]);
  expect(panel.nodes[0]?.children[0]?.children).toHaveLength(0);
  expect(filterLayers(TREE, 'pressed').matches).toEqual([3]);
});

it('says nothing matched with an empty tree', () => {
  expect(filterLayers(TREE, 'zzz')).toEqual({ nodes: [], matches: [] });
});

it('leaves the tree as it is for an empty or blank query', () => {
  expect(filterLayers(TREE, '  ')).toEqual({ nodes: TREE, matches: [] });
});
