// The Design view of the layers (TRU-3.6): the Code tree, read by what is on the
// screen. Everything here comes from measured facts and the page's own words,
// so it holds in any language and for any provider, with no list of names.
import type { LayerNode } from './module';

export type DesignIcon =
  | 'row'
  | 'column'
  | 'grid'
  | 'frame'
  | 'text'
  | 'image'
  | 'icon'
  | 'button'
  | 'input'
  | 'link'
  | 'component';

export type DesignRow = {
  id: number;
  name: string;
  icon: DesignIcon;
  children: DesignRow[];
};

export type DesignTree = {
  nodes: DesignRow[];
  /** Each id's row: its own, or for a removed one the nearest that is shown. */
  shownAs: ReadonlyMap<number, number>;
  /** What a component's row picks, as it draws nothing itself: its first row's element. */
  picks: ReadonlyMap<number, number>;
};

export type LayersView = 'design' | 'code';

/** A stored view; Design when there's none, or it isn't one of the views. */
export function parseLayersView(stored: string | null): LayersView {
  return stored === 'code' ? 'code' : 'design';
}

const KIND_BY_ROLE = new Map<string, DesignIcon>([
  ['button', 'button'],
  ['link', 'link'],
  ['img', 'image'],
  ['textbox', 'input'],
  ['searchbox', 'input'],
  ['combobox', 'input'],
]);

const KIND_BY_TAG = new Map<string, DesignIcon>([
  ['a', 'link'],
  ['button', 'button'],
  ['input', 'input'],
  ['textarea', 'input'],
  ['select', 'input'],
  ['img', 'image'],
  ['picture', 'image'],
  ['video', 'image'],
  ['canvas', 'image'],
  ['svg', 'icon'],
]);

const KIND_NAME = {
  row: 'Frame',
  column: 'Frame',
  grid: 'Frame',
  frame: 'Frame',
  text: 'Text',
  image: 'Image',
  icon: 'Icon',
  button: 'Button',
  input: 'Input',
  link: 'Link',
  component: 'Component',
} as const satisfies Record<DesignIcon, string>;

/** What an element is: by its tag, then its role, then its text, then its layout. */
function kindOf(node: LayerNode): DesignIcon {
  const { look } = node;
  return (
    KIND_BY_TAG.get(node.name) ??
    KIND_BY_ROLE.get(look?.role ?? '') ??
    (look?.text ? 'text' : (look?.layout ?? 'frame'))
  );
}

function isFrame(kind: DesignIcon): boolean {
  return KIND_NAME[kind] === 'Frame';
}

/** `ChatQuestionList` reads "Chat question list"; `SSEProvider`, "SSE provider". */
export function inWords(name: string): string {
  const words = name
    .replace(/[-_.]+/g, ' ')
    .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .trim()
    .split(/\s+/);
  return words
    .map((word, index) => {
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      // An acronym stays as it is written.
      return /^\p{Lu}{2,}/u.test(word)
        ? word
        : word.charAt(0).toLowerCase() + word.slice(1);
    })
    .join(' ');
}

const isDocument = (node: LayerNode): boolean =>
  node.kind === 'element' && node.name === 'body';

export function designLayers(tree: readonly LayerNode[]): DesignTree {
  // Bottom up: what is on the screen, and which components wrote any of it.
  const visible = new Set<number>();
  const owners = new Set<number>();
  const measure = (node: LayerNode): boolean => {
    const kind = node.kind === 'element' ? kindOf(node) : null;
    // A frame with nothing of its own looks empty, however much room it takes.
    let seen =
      kind !== null &&
      node.look?.drawn === true &&
      (node.look.box || !isFrame(kind));
    // An icon is one thing on the screen: its paths aren't rows.
    if (kind !== 'icon') {
      for (const child of node.children) {
        if (measure(child)) seen = true;
      }
    }
    if (seen) {
      visible.add(node.id);
      // Writing a provider isn't writing anything on the screen. Children come
      // first here, so a component already knows if it wrote anything.
      if (node.owner !== undefined && (kind !== null || owners.has(node.id))) {
        owners.add(node.owner);
      }
    }
    return seen;
  };
  for (const node of tree) measure(node);

  /** A component that wrote nothing on the screen only passes its children through. */
  const lifted = (node: LayerNode): boolean =>
    isDocument(node) || (node.kind !== 'element' && !owners.has(node.id));

  /** The rows a list of nodes comes to, with what is lifted replaced by its children. */
  const inside = (nodes: readonly LayerNode[]): LayerNode[] =>
    nodes.flatMap((node) => {
      if (!visible.has(node.id)) return [];
      if (!lifted(node)) return [node];
      const kids = inside(node.children);
      const [only] = kids;
      // An icon has no words of its own, so it reads as what drew it: `PanelLeftOpen`.
      return only?.look &&
        kids.length === 1 &&
        kindOf(only) === 'icon' &&
        !only.look.label
        ? [{ ...only, look: { ...only.look, label: inWords(node.name) } }]
        : kids;
    });

  const shown = new Set<number>();
  const picks = new Map<number, number>();

  const row = (
    node: LayerNode,
    name: string,
    icon: DesignIcon,
    children: DesignRow[],
  ): DesignRow => {
    shown.add(node.id);
    return { id: node.id, name, icon, children };
  };

  /**
   * One node's rows. `passed` holds the components that disappeared on the way
   * to it since the last row: if one of them wrote this element, the element
   * is what that component draws, so it takes the name.
   */
  const arrange = (
    node: LayerNode,
    passed: readonly LayerNode[],
  ): DesignRow[] => {
    if (node.kind !== 'element') {
      const kids = inside(node.children);
      const [only] = kids;
      if (only && kids.length === 1) {
        return arrange(only, [...passed, node]);
      }
      // Parts of one Server Component share an id, and this part may draw nothing.
      if (kids.length === 0) return [];
      const children = kids.flatMap((kid) => arrange(kid, []));
      const [first] = children;
      if (first) picks.set(node.id, picks.get(first.id) ?? first.id);
      return [row(node, inWords(node.name), 'component', children)];
    }

    const kind = kindOf(node);
    const kids = kind === 'icon' ? [] : inside(node.children);
    const [only] = kids;
    if (only && kids.length === 1 && isFrame(kind) && !node.look?.box) {
      return arrange(only, passed);
    }

    const children = kids.flatMap((kid) => arrange(kid, []));
    const drew = passed.findLast((component) => component.id === node.owner);
    if (drew) return [row(node, inWords(drew.name), 'component', children)];
    const words = node.look?.text ?? node.look?.label ?? KIND_NAME[kind];
    return [row(node, words, kind, children)];
  };

  const nodes = inside(tree).flatMap((node) => arrange(node, []));

  // Top down for the nearest row above, bottom up for the first row beneath.
  // With neither, as beside the top rows, the tree's first row.
  const top = nodes[0]?.id ?? null;
  const shownAs = new Map<number, number>();
  const place = (node: LayerNode, above: number | null): number | null => {
    const own = shown.has(node.id) ? node.id : null;
    let first = own;
    for (const child of node.children) {
      const beneath = place(child, own ?? above);
      first ??= beneath;
    }
    const at = first ?? above ?? top;
    if (at !== null) shownAs.set(node.id, at);
    return first;
  };
  for (const node of tree) place(node, null);

  return { nodes, shownAs, picks };
}
