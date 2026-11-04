// The layers filter (TRU-2.3): the rows whose name, tag or text matches, with
// every ancestor kept so each match sits where it is in the page. In the
// Design view a row's name is what it shows (TRU-3.6).
export type Filterable<T> = {
  id: number;
  name: string;
  text?: string;
  children: T[];
};

export type Filtered<T> = {
  /** The tree with only the matches and their ancestors. */
  nodes: T[];
  /** The matches' ids, top to bottom, for ↑ and ↓. */
  matches: number[];
};

/** What a row is found by: its name (a component's, or an element's tag) and its text. */
function matchesQuery<T>(node: Filterable<T>, query: string): boolean {
  return [node.name, node.text ?? ''].some((value) =>
    value.toLowerCase().includes(query),
  );
}

export function filterLayers<T extends Filterable<T>>(
  nodes: readonly T[],
  query: string,
): Filtered<T> {
  const wanted = query.trim().toLowerCase();
  const matches: number[] = [];
  if (!wanted) return { nodes: [...nodes], matches };

  const keep = (list: readonly T[]): T[] =>
    list.flatMap((node) => {
      const self = matchesQuery(node, wanted);
      // Pre-order, so the matches run in the tree's reading order.
      if (self) matches.push(node.id);
      const children = keep(node.children);
      if (!self && children.length === 0) return [];
      return [{ ...node, children }];
    });

  return { nodes: keep(nodes), matches };
}
