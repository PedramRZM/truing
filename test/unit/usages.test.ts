// TRU-2.2's codebase search: a component's uses, found through imports.
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createUsagesIndex } from '../../src/modules/selection/usages';

const root = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '../fixtures/usages-project',
);

function index() {
  return createUsagesIndex({ root, source: 'src' });
}

describe('usages', () => {
  it('resolves a tag through a path alias to the module and export', async () => {
    const ref = await index().resolveTag('src/features/toolbar.tsx', 'Button');
    expect(ref).toEqual({
      module: path.join(root, 'src/components/ui/button.tsx'),
      path: ['Button'],
    });
  });

  it('finds every use: aliased, namespaced, in its own file, and in a list', async () => {
    const usages = index();
    const ref = await usages.resolveTag('src/features/toolbar.tsx', 'Button');
    if (!ref) throw new Error('no ref');
    const uses = await usages.usesOf(ref);
    expect(uses.map((use) => `${use.file}:${use.line}:${use.column}`)).toEqual([
      'src/components/ui/button.tsx:7:10',
      'src/features/aliased.tsx:8:7',
      'src/features/aliased.tsx:9:7',
      'src/features/toolbar.tsx:8:7',
      'src/features/toolbar.tsx:9:7',
      'src/features/toolbar.tsx:10:7',
      'src/features/toolbar.tsx:12:9',
    ]);
    const [own, aliased, , literal, expression, spread, listed] = uses;
    expect(own?.attributes).toEqual({ size: 'sm' });
    expect(aliased?.attributes).toEqual({ asChild: 'true' });
    expect(literal?.attributes).toEqual({ variant: 'tonal' });
    expect(expression?.attributes).toEqual({ variant: null });
    expect(spread?.spread).toBe(true);
    expect(literal?.inList).toBe(false);
    expect(listed).toMatchObject({
      inList: true,
      attributes: { key: null, variant: 'ghost' },
    });
  });

  it("doesn't count a component of the same name declared elsewhere", async () => {
    const usages = index();
    const own = await usages.resolveTag(
      'src/features/own-button.tsx',
      'Button',
    );
    expect(own).toEqual({
      module: path.join(root, 'src/features/own-button.tsx'),
      path: ['Button'],
    });
    if (!own) throw new Error('no ref');
    const uses = await usages.usesOf(own);
    expect(uses.map((use) => use.file)).toEqual([
      'src/features/own-button.tsx',
    ]);
  });

  it('follows a default import under another name', async () => {
    const usages = index();
    const ref = await usages.resolveTag('src/features/cards.tsx', 'Panel');
    expect(ref).toEqual({
      module: path.join(root, 'src/features/card.tsx'),
      path: ['default'],
    });
    if (!ref) throw new Error('no ref');
    // Its own file's uses count too, under the name it is declared with.
    expect((await usages.usesOf(ref)).map((use) => use.file)).toEqual([
      'src/features/card.tsx',
      'src/features/card.tsx',
      'src/features/cards.tsx',
    ]);
  });

  it('is null for a tag the file neither imports nor declares', async () => {
    expect(
      await index().resolveTag('src/features/cards.tsx', 'Missing'),
    ).toBeNull();
  });
});

it('counts a use through memo or forwardRef as a use of the component it wraps', async () => {
  const usages = index();
  for (const tag of ['Badge', 'MemoBadge', 'RefBadge']) {
    const ref = await usages.resolveTag('src/features/badges.tsx', tag);
    if (!ref) throw new Error(`no ref for ${tag}`);
    const uses = await usages.usesOf(ref);
    expect(uses.map((use) => `${use.file}:${use.line}`)).toEqual([
      'src/features/badges.tsx:6',
      'src/features/badges.tsx:7',
      'src/features/badges.tsx:8',
    ]);
  }
});

it('follows a default export that wraps the component in memo', async () => {
  const usages = index();
  const ref = await usages.resolveTag('src/features/chips.tsx', 'AnyChip');
  expect(ref).toEqual({
    module: path.join(root, 'src/features/chip.tsx'),
    path: ['default'],
  });
  if (!ref) throw new Error('no ref');
  expect((await usages.usesOf(ref)).map((use) => use.file)).toEqual([
    'src/features/chips.tsx',
  ]);
});
