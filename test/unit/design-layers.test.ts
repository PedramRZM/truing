// The Design view of the layers (TRU-3.6): collapsing, naming and the nearest row.
import { expect, it } from 'vitest';

import {
  designLayers,
  type DesignRow,
  inWords,
  parseLayersView,
} from '../../src/modules/selection/design-layers';
import { filterLayers } from '../../src/modules/selection/layers-filter';
import type { LayerLook, LayerNode } from '../../src/modules/selection/module';

const PLAIN: LayerLook = { drawn: true, box: false };
const BOX: LayerLook = { drawn: true, box: true };

let nextId = 1;
function element(
  tag: string,
  look: Partial<LayerLook>,
  children: LayerNode[] = [],
  owner?: number,
): LayerNode {
  return {
    id: nextId++,
    name: tag,
    kind: 'element',
    look: { ...PLAIN, ...look },
    owner,
    children,
  };
}
function component(
  name: string,
  children: LayerNode[] = [],
  extra: Partial<LayerNode> = {},
): LayerNode {
  return { id: nextId++, name, kind: 'client', children, ...extra };
}
/** The rows as `name:icon`, nested, for one-glance reading. */
function outline(rows: readonly DesignRow[]): unknown[] {
  return rows.map((row) =>
    row.children.length === 0
      ? `${row.name}:${row.icon}`
      : { [`${row.name}:${row.icon}`]: outline(row.children) },
  );
}

it('removes a chain of providers around the page, with no name to go on', () => {
  const page = element('main', { ...BOX, layout: 'column' });
  const tree = [
    element('body', BOX, [
      component('NextTopLoader'),
      component('Providers', [
        component('AuthProvider', [component('QueryClientProvider', [page])]),
      ]),
    ]),
  ];
  expect(outline(designLayers(tree).nodes)).toEqual(['Frame:column']);
});

it('lifts a pass-through component with several children, since it wrote none of them', () => {
  const layout = component('Layout');
  const first = element('header', BOX, [], layout.id);
  const second = element('main', BOX, [], layout.id);
  layout.children = [component('Provider', [first, second])];
  // Layout wrote both, so it stays, and Provider, which wrote neither, doesn't.
  expect(outline(designLayers([layout]).nodes)).toEqual([
    { 'Layout:component': ['Frame:frame', 'Frame:frame'] },
  ]);
});

it('lifts a provider that only wrote other providers, around several rows', () => {
  const layout = component('Layout');
  const providers = component('Providers', [], { owner: layout.id });
  const auth = component(
    'AuthProvider',
    [
      element('header', BOX, [], layout.id),
      element('main', BOX, [], layout.id),
    ],
    { owner: providers.id },
  );
  providers.children = [auth];
  layout.children = [providers];
  expect(outline(designLayers([layout]).nodes)).toEqual([
    { 'Layout:component': ['Frame:frame', 'Frame:frame'] },
  ]);
});

it('keeps a fragment component whose children it wrote, components included', () => {
  const page = component('Page');
  const header = component('Header', [], { owner: page.id });
  header.children = [element('header', BOX, [], header.id)];
  const footer = component('Footer', [], { owner: page.id });
  footer.children = [element('footer', BOX, [], footer.id)];
  page.children = [header, footer];
  expect(outline(designLayers([page]).nodes)).toEqual([
    { 'Page:component': ['Header:component', 'Footer:component'] },
  ]);
});

it('collapses an element with one child and nothing of its own', () => {
  const heading = element('h1', { text: 'Title' });
  const tree = designLayers([
    element('div', {}, [element('div', {}, [heading])]),
  ]);
  expect(outline(tree.nodes)).toEqual(['Title:text']);
});

it('keeps an element with one child when it draws a box, a button, or a link', () => {
  const icon = () => element('svg', {});
  const tree = designLayers([
    element('div', BOX, [icon()]),
    element('button', {}, [icon()]),
    element('a', { label: 'Home' }, [icon()]),
  ]);
  expect(outline(tree.nodes)).toEqual([
    { 'Frame:frame': ['Icon:icon'] },
    { 'Button:button': ['Icon:icon'] },
    { 'Home:link': ['Icon:icon'] },
  ]);
});

it('names a row by the component that wrote it, in words, and keeps the diamond', () => {
  const list = component('ChatQuestionList');
  list.children = [element('ul', BOX, [], list.id)];
  expect(outline(designLayers([list]).nodes)).toEqual([
    'Chat question list:component',
  ]);
});

it("doesn't name a row after a provider it merely sits inside", () => {
  const shell = component('AppShell');
  const provider = component('SidePanelVariantProvider', [
    element('div', { ...BOX, layout: 'row' }, [], shell.id),
  ]);
  shell.children = [provider];
  expect(outline(designLayers([shell]).nodes)).toEqual(['App shell:component']);
});

it('names a row by its first of text, alt, accessible name and kind', () => {
  const rows = designLayers([
    element('p', { text: 'Hello', label: 'Ignored' }),
    element('img', { label: 'A cat' }),
    element('input', { label: 'Email' }),
    element('img', {}),
    element('section', BOX),
  ]);
  expect(outline(rows.nodes)).toEqual([
    'Hello:text',
    'A cat:image',
    'Email:input',
    'Image:image',
    'Frame:frame',
  ]);
});

it('shows a layout by its icon', () => {
  const rows = designLayers([
    element('div', { ...BOX, layout: 'row' }),
    element('div', { ...BOX, layout: 'column' }),
    element('div', { ...BOX, layout: 'grid' }),
  ]);
  expect(rows.nodes.map((row) => row.icon)).toEqual(['row', 'column', 'grid']);
});

it('takes a role over its layout: a div can be a button', () => {
  const rows = designLayers([
    element('div', { ...BOX, role: 'button', layout: 'row' }),
  ]);
  expect(rows.nodes.map((row) => row.icon)).toEqual(['button']);
});

it('an icon reads as the package component that drew it, keeping its glyph', () => {
  const rows = designLayers([
    component('PanelLeftOpen', [element('svg', {})]),
    component('Mail', [element('svg', { label: 'Inbox' })]),
  ]);
  expect(outline(rows.nodes)).toEqual(['Panel left open:icon', 'Inbox:icon']);
});

it("a package component's row reads by its own words: nothing here wrote it", () => {
  // next/link around its <a>: the <a>'s owner isn't a project component.
  const rows = designLayers([
    component('Link', [element('a', { text: 'Read more' })]),
  ]);
  expect(outline(rows.nodes)).toEqual(['Read more:link']);
});

it('keeps Persian words as they are', () => {
  const rows = designLayers([
    element('p', { text: 'سلام دنیا' }),
    element('img', { label: 'تصویر آزمایشی' }),
    component('گزارش', [element('div', BOX), element('div', BOX)], {
      kind: 'client',
    }),
  ]);
  expect(rows.nodes.map((row) => row.name).slice(0, 2)).toEqual([
    'سلام دنیا',
    'تصویر آزمایشی',
  ]);
});

it('leaves out what is not on the screen, and an empty frame', () => {
  const rows = designLayers([
    element('div', { drawn: false, box: true }),
    element('span', { drawn: false, text: 'Screen readers only' }),
    element('div', {}),
    element('p', { text: 'Stays' }),
  ]);
  expect(outline(rows.nodes)).toEqual(['Stays:text']);
});

it("keeps what's drawn inside a frame with no size of its own", () => {
  const rows = designLayers([
    element('div', { drawn: false, layout: 'column' }, [
      element('p', { text: 'One' }),
      element('p', { text: 'Two' }),
    ]),
  ]);
  expect(outline(rows.nodes)).toEqual([
    { 'Frame:column': ['One:text', 'Two:text'] },
  ]);
});

it('resolves every removed id to its nearest shown row', () => {
  const path = element('path', { drawn: true });
  const icon = element('svg', {}, [path]);
  const hidden = element('span', { drawn: false, text: 'Hidden' });
  const shown = element('section', BOX, [hidden, icon]);
  const wrapper = element('div', {}, [shown]);
  const provider = component('Provider', [wrapper]);
  const body = element('body', BOX, [provider]);
  const tree = designLayers([body]);

  expect(tree.shownAs.get(body.id)).toBe(shown.id);
  expect(tree.shownAs.get(provider.id)).toBe(shown.id);
  expect(tree.shownAs.get(wrapper.id)).toBe(shown.id);
  expect(tree.shownAs.get(shown.id)).toBe(shown.id);
  // Removed with nothing beneath: the row above.
  expect(tree.shownAs.get(hidden.id)).toBe(shown.id);
  // An icon's paths are the icon.
  expect(tree.shownAs.get(path.id)).toBe(icon.id);
});

it('resolves an empty frame beside the top rows to the first row', () => {
  const first = element('p', { text: 'One' });
  const empty = element('div', {});
  const body = element('body', BOX, [
    first,
    empty,
    element('p', { text: 'Two' }),
  ]);
  expect(designLayers([body]).shownAs.get(empty.id)).toBe(first.id);
});

it('draws no empty row for a part of a Server Component with nothing drawn', () => {
  const server = (children: LayerNode[]): LayerNode => ({
    id: 900,
    name: 'Shell',
    kind: 'server',
    children,
  });
  const rows = designLayers([
    server([
      element('p', { text: 'Drawn' }, [], 900),
      element('p', { text: 'Too' }, [], 900),
    ]),
    element('section', BOX),
    server([element('div', { drawn: false })]),
  ]);
  expect(outline(rows.nodes)).toEqual([
    { 'Shell:component': ['Drawn:text', 'Too:text'] },
    'Frame:frame',
  ]);
});

it('resolves every id of a large tree, and each to a row that exists', () => {
  const build = (depth: number): LayerNode =>
    depth === 0
      ? element('p', { text: 'Leaf' })
      : element('div', depth % 2 ? {} : BOX, [
          build(depth - 1),
          build(depth - 1),
        ]);
  const root = build(8);
  const tree = designLayers([root]);
  const rows = new Set<number>();
  const collect = (list: readonly DesignRow[]): void => {
    for (const row of list) {
      rows.add(row.id);
      collect(row.children);
    }
  };
  collect(tree.nodes);
  const visit = (node: LayerNode): void => {
    expect(rows.has(tree.shownAs.get(node.id) ?? -1)).toBe(true);
    node.children.forEach(visit);
  };
  visit(root);
});

it("a component's row picks its first shown element, skipping what isn't drawn", () => {
  const group = component('Group');
  const gone = element('div', { drawn: false }, [], group.id);
  const first = element('p', { text: 'One' }, [], group.id);
  const second = element('p', { text: 'Two' }, [], group.id);
  group.children = [gone, first, second];
  const tree = designLayers([group]);
  expect(tree.nodes[0]?.id).toBe(group.id);
  expect(tree.picks.get(group.id)).toBe(first.id);
});

it('filters on what the row shows, not on its tag', () => {
  const tree = designLayers([
    element('p', { text: 'Hello there' }),
    element('section', BOX),
  ]);
  expect(filterLayers(tree.nodes, 'hello').matches).toHaveLength(1);
  expect(filterLayers(tree.nodes, 'section').matches).toHaveLength(0);
  expect(filterLayers(tree.nodes, 'frame').matches).toHaveLength(1);
});

it('reads a component name in words', () => {
  expect(inWords('ChatQuestionList')).toBe('Chat question list');
  expect(inWords('SSEConnectivityProvider')).toBe('SSE connectivity provider');
  expect(inWords('AppHeader')).toBe('App header');
  expect(inWords('H1Title')).toBe('H1 title');
  expect(inWords('page')).toBe('Page');
  expect(inWords('side_panel-item')).toBe('Side panel item');
  expect(inWords('گزارش')).toBe('گزارش');
});

it('defaults to the Design view', () => {
  expect(parseLayersView(null)).toBe('design');
  expect(parseLayersView('nonsense')).toBe('design');
  expect(parseLayersView('code')).toBe('code');
});
