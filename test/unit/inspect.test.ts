// The server's half of inspect (TRU-2.1): file names as Next gives them, TRU-1.1's
// rule with the reasons for an absent location, and classes as tokens.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  applyRule,
  type Paths,
  projectPath,
  stylesOf,
  tagAt,
} from '../../src/modules/selection/inspect';
import type { Link, Selection } from '../../src/modules/selection/module';
import type { ClassLookup } from '../../src/tokens/table';

const paths: Paths = {
  root: '/repo',
  appDir: '/repo',
  primitives: 'src/components/ui/',
};

it.each([
  // Turbopack's client maps: a file URL, percent-encoded route groups.
  ['file:///repo/src/app/%28main%29/layout.tsx', 'src/app/(main)/layout.tsx'],
  // Turbopack's server frames, through Next's endpoint.
  ['[project]/src/components/ui/button.tsx', 'src/components/ui/button.tsx'],
  ['src/app/(main)/layout.tsx', 'src/app/(main)/layout.tsx'],
  // webpack, with its layer and without.
  ['webpack-internal:///(app-pages-browser)/./src/x.tsx', 'src/x.tsx'],
  ['(app-pages-browser)/./src/x.tsx', 'src/x.tsx'],
  ['/repo/src/x.tsx', 'src/x.tsx'],
])('reads %s as %s', (file, expected) => {
  expect(projectPath(file, paths)).toBe(expected);
});

it("names files relative to Next's app when it isn't the root", () => {
  expect(
    projectPath('app/page.tsx', { ...paths, appDir: '/repo/test/fixture-app' }),
  ).toBe('test/fixture-app/app/page.tsx');
});

// A monorepo's Turbopack names files from the workspace root, above Next's app.
it.each([
  [
    '[project]/apps/web/app/page.tsx',
    '/repo',
    '/repo/apps/web',
    'apps/web/app/page.tsx',
  ],
  ['apps/web/app/page.tsx', '/repo', '/repo/apps/web', 'apps/web/app/page.tsx'],
  // Truing opened inside the app: the workspace root is above Truing's root too.
  ['apps/web/app/page.tsx', '/repo/apps/web', '/repo/apps/web', 'app/page.tsx'],
])(
  'takes %s from a workspace root (root %s, app %s)',
  (file, root, appDir, expected) => {
    expect(projectPath(file, { ...paths, root, appDir })).toBe(expected);
  },
);

it("doesn't mistake a folder named like the app for the app's own path", () => {
  const root = path.join(
    mkdtempSync(path.join(tmpdir(), 'truing-paths-')),
    'app',
  );
  mkdirSync(path.join(root, 'app'), { recursive: true });
  writeFileSync(path.join(root, 'app/page.tsx'), '');
  expect(projectPath('app/page.tsx', { ...paths, root, appDir: root })).toBe(
    'app/page.tsx',
  );
});

function link(
  name: string,
  kind: Link['kind'],
  file: string | null,
  line = 1,
  extra: Partial<Link> = {},
): Link {
  return {
    name,
    kind,
    env: kind === 'server' ? 'Server' : null,
    at: file
      ? { file, line, column: 1, ignored: file.includes('node_modules') }
      : null,
    unmapped: false,
    capped: false,
    props: { status: 'none' },
    ...extra,
  };
}

function selection(chain: Link[], react = true): Selection {
  return {
    id: 1,
    href: '/',
    identity: null,
    tag: 'button',
    classes: [],
    selector: '',
    react,
    text: null,
    width: 1440,
    chain,
  };
}

it('takes the definition from the primitives folder and the call site from the feature', () => {
  const rule = applyRule(
    selection([
      link('button', 'host', 'src/components/ui/button.tsx', 70),
      link('Button', 'client', 'src/features/search/components/bar.tsx', 42),
      link('SearchBar', 'client', 'src/features/search/components/page.tsx', 9),
    ]),
    paths,
  );

  expect(rule.definition).toEqual({
    status: 'found',
    at: { file: 'src/components/ui/button.tsx', line: 70, column: 1 },
  });
  expect(rule.callSite).toEqual({
    status: 'found',
    at: { file: 'src/features/search/components/bar.tsx', line: 42, column: 1 },
  });
  expect(rule.component?.name).toBe('Button');
  expect(rule.owners.map((owner) => owner.name)).toEqual(['SearchBar']);
});

it('skips links inside packages: a lucide icon has its call site but no definition here', () => {
  const rule = applyRule(
    selection([
      link('svg', 'host', 'node_modules/lucide-react/dist/icon.js'),
      link('Icon', 'client', 'node_modules/lucide-react/dist/create.js'),
      link('Search', 'client', 'src/components/app-header.tsx', 281),
    ]),
    paths,
  );

  expect(rule.definition).toEqual({ status: 'absent', reason: 'library' });
  expect(rule.callSite).toMatchObject({
    status: 'found',
    at: { file: 'src/components/app-header.tsx', line: 281 },
  });
  expect(rule.component?.name).toBe('Search');
});

it('says a route file has no call site, rather than leaving it empty', () => {
  const rule = applyRule(
    selection([
      link('h1', 'host', 'src/app/(main)/search/page.tsx', 12),
      link('SearchPage', 'server', '<anonymous>', 1, {
        at: { file: '<anonymous>', line: 1, column: 1, ignored: true },
      }),
    ]),
    paths,
  );

  expect(rule.definition.status).toBe('found');
  expect(rule.callSite).toEqual({ status: 'absent', reason: 'route' });
});

it("says when a page is past React's stack cap, and when React didn't draw the element", () => {
  const capped = applyRule(
    selection([link('span', 'host', null, 1, { capped: true })]),
    paths,
  );
  expect(capped.definition).toEqual({ status: 'absent', reason: 'cap' });
  expect(capped.callSite).toEqual({ status: 'absent', reason: 'cap' });

  const unmapped = applyRule(
    selection([link('span', 'host', null, 1, { unmapped: true })]),
    paths,
  );
  expect(unmapped.definition).toEqual({ status: 'absent', reason: 'unmapped' });

  const foreign = applyRule(selection([], false), paths);
  expect(foreign.definition).toEqual({ status: 'absent', reason: 'not-react' });
  expect(foreign.callSite).toEqual({ status: 'absent', reason: 'not-react' });
});

it('shows each class as its property, its token, the chain it resolves through and the value', () => {
  const token = {
    key: '--color-primary',
    chain: { light: ['--primary', '--color-brand-1-600'], dark: ['--primary'] },
    light: { value: '#1c68d4', hex: '#1c68d4' },
    dark: { value: '#3d82f2', hex: '#3d82f2' },
  };
  const lookups: Record<string, ClassLookup> = {
    'hover:bg-primary': {
      status: 'token',
      className: 'hover:bg-primary',
      token: token as never,
      root: 'bg',
      negative: false,
      variants: ['hover'],
    },
    flex: { status: 'compiles', className: 'flex', reason: 'static' },
    nope: { status: 'unknown', className: 'nope' },
  };
  const css: Record<string, string> = {
    'hover:bg-primary':
      '.x { &:hover { @media (hover: hover) { background-color: var(--color-primary); } } }',
    flex: '.flex { display: flex; --tw-x: 1; }',
  };

  const styles = stylesOf(['hover:bg-primary', 'flex', 'nope'], {
    lookup: (name) => lookups[name] as ClassLookup,
    css: (name) => css[name] ?? null,
  });

  expect(styles).toEqual([
    {
      status: 'token',
      className: 'hover:bg-primary',
      properties: ['background-color'],
      variants: ['hover'],
      token: 'color-primary',
      through: ['primary', 'color-brand-1-600'],
      light: '#1c68d4',
      dark: '#3d82f2',
    },
    {
      status: 'value',
      className: 'flex',
      properties: ['display'],
      variants: [],
    },
    { status: 'unknown', className: 'nope', properties: [], variants: [] },
  ]);
});

it('names a component by the tag written at its call site, not the display name it copied', () => {
  // shadcn's sheet.tsx: SheetContent.displayName = DialogPrimitive.Content.displayName.
  const source = ['<Sheet>', '  <SheetContent side="right">', '</Sheet>'].join(
    '\n',
  );
  expect(tagAt(source, 2, 3)).toBe('SheetContent');
  expect(tagAt('<DialogPrimitive.Content>', 1, 1)).toBe(
    'DialogPrimitive.Content',
  );
  expect(tagAt('const x = 1;', 1, 1)).toBeNull();
});

it('reads the variant from the primitive around the definition, when another component wraps it', () => {
  const button = link(
    'Button',
    'client',
    'src/components/ui/sidebar.tsx',
    280,
    {
      props: { status: 'live', values: { variant: 'ghost', size: 'icon' } },
    },
  );
  const rule = applyRule(
    selection([
      link('button', 'host', 'src/components/ui/button.tsx', 70),
      button,
      link('SidebarTrigger', 'client', 'src/features/app/nav.tsx', 12),
    ]),
    paths,
  );

  expect(rule.component?.name).toBe('SidebarTrigger');
  expect(rule.primitive).toBe(button);
  expect(rule.definition).toMatchObject({
    status: 'found',
    at: { file: 'src/components/ui/button.tsx', line: 70 },
  });
});
