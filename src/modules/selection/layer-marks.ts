// Between a row of the tree and the elements hide and lock work on (TRU-3.7). A
// component draws nothing itself, so its row stands for its outermost elements.
import type { LayerNode } from './module';

/** The outermost elements a node stands for: itself, or those a component holds. */
export function outerElements(node: LayerNode): number[] {
  if (node.kind === 'element') return [node.id];
  return node.children.flatMap(outerElements);
}

/**
 * The outermost elements of a row, from the Code tree, which holds every row
 * of both views. Parts of one Server Component share an id, so a row can be
 * several nodes.
 */
export function elementsOfRow(
  nodes: readonly LayerNode[],
  id: number,
): number[] {
  return nodes.flatMap((node) =>
    node.id === id ? outerElements(node) : elementsOfRow(node.children, id),
  );
}

/**
 * Every row marked: an element in the list, or a component whose outermost
 * elements all are. A child that draws nothing has no say either way.
 */
export function markedRows(
  nodes: readonly LayerNode[],
  elements: readonly number[],
): ReadonlySet<number> {
  if (elements.length === 0) return new Set();
  const marked = new Set(elements);
  const rows = new Map<number, boolean>();
  const note = (id: number, on: boolean): void => {
    rows.set(id, on && rows.get(id) !== false);
  };
  /** Whether the node is marked; null when it stands for no element. */
  const visit = (node: LayerNode): boolean | null => {
    let all: boolean | null = null;
    for (const child of node.children) {
      const on = visit(child);
      if (on !== null) all = on && all !== false;
    }
    if (node.kind === 'element') {
      const on = marked.has(node.id);
      note(node.id, on);
      return on;
    }
    if (all !== null) note(node.id, all);
    return all;
  };
  for (const node of nodes) visit(node);
  return new Set([...rows].flatMap(([id, on]) => (on ? [id] : [])));
}
