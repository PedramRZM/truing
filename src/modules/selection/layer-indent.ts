// How far each row of the layers tree is indented. React pages nest forty levels
// deep, mostly wrappers with one child, in a 240 px panel. So a row that is an
// only child steps in a little, a row among siblings a full step, and the CSS
// shrinks the step until the deepest row showing still has room for its name.

/** How far an only child steps in, as a share of a full step. */
const ONLY_CHILD_STEP = 0.25;

/** The level of the rows under a row, given how many there are. */
export function childLevel(level: number, children: number): number {
  return level + (children === 1 ? ONLY_CHILD_STEP : 1);
}

/** The deepest level among the rows showing, through the rows that are open. */
export function deepestLevel<T extends { children: readonly T[] }>(
  nodes: readonly T[],
  isOpen: (node: T, depth: number) => boolean,
  depth = 0,
  level = 0,
): number {
  let deepest = level;
  for (const node of nodes) {
    if (node.children.length === 0 || !isOpen(node, depth)) continue;
    deepest = Math.max(
      deepest,
      deepestLevel(
        node.children,
        isOpen,
        depth + 1,
        childLevel(level, node.children.length),
      ),
    );
  }
  return deepest;
}
