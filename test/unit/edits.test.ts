// The direct engine (TRU-4.1) over fixture files: each edit kind, every
// "Claude" reason, minimal diffs, Prettier idempotence and the stale-hash
// check. Each test works on a fresh copy of test/fixtures/edit-project.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  createEditEngine,
  escapeText,
  loadPrettier,
  REASONS,
} from '../../src/edits/engine';
import { NOT_WRITTEN } from '../../src/edits/messages';
import {
  type Jsx,
  jsxAt,
  parseSource,
  takesClassName,
} from '../../src/edits/source';
import { matchesGlob } from '../../src/globs.mjs';
import type { Edit, Scope, SourceAt } from '../../src/module';

import { PACKAGE_ROOT } from './temp-modules';

const REPO = PACKAGE_ROOT;
const FIXTURE = path.join(PACKAGE_ROOT, 'test/fixtures/edit-project');
const CARD = 'src/features/card.tsx';
const BUTTON = 'src/components/ui/button.tsx';

// A real project's writable paths and token groups.
const writable = {
  include: ['src/**/*.tsx', 'src/app/globals.css', 'src/stories/**'],
  exclude: ['src/server/**', 'src/app/**/route.ts', 'src/app/actions/**'],
};

let prettier: Awaited<ReturnType<typeof loadPrettier>>;
beforeAll(async () => {
  prettier = await loadPrettier(REPO);
  expect(prettier).not.toBeNull();
});

function project() {
  const root = mkdtempSync(path.join(tmpdir(), 'ds-edits-'));
  cpSync(FIXTURE, root, { recursive: true });
  cpSync(path.join(REPO, '.prettierrc'), path.join(root, '.prettierrc'));
  cpSync(
    path.join(
      REPO,
      'test/fixtures/design-system/src/lib/tailwind-merge-tokens.json',
    ),
    path.join(root, 'tokens.json'),
  );
  const engine = createEditEngine({
    root,
    config: { writable, tailwindMerge: 'tokens.json' },
    prettier,
  });
  const read = (file: string): string =>
    readFileSync(path.join(root, file), 'utf8');
  return { root, engine, read };
}

/** Where the JSX element carrying `id="…"` starts: its `<`, as TRU-1.1 gives it. */
function at(text: string, id: string, file = CARD): SourceAt {
  const marker = text.indexOf(`id="${id}"`);
  if (marker === -1) throw new Error(`no ${id}`);
  const start = text.lastIndexOf('<', marker);
  const before = text.slice(0, start);
  const line = before.split('\n').length;
  const column = start - (before.lastIndexOf('\n') + 1) + 1;
  return { file, line, column };
}

/** Plans and writes one edit; returns the file after it and what the plan said. */
async function apply(edit: Edit, scope: Scope = 'all') {
  const { engine, read } = current;
  const plan = await engine.plan(edit, scope);
  if (plan.status !== 'direct') return { plan, text: null };
  const [outcome] = await engine.write([
    { id: 'one', edit, files: plan.files },
  ]);
  expect(outcome?.result).toEqual({ status: 'applied' });
  return { plan, text: read(edit.kind === 'cva' ? edit.file : edit.at.file) };
}

let current: ReturnType<typeof project>;
const card = (): string => current.read(CARD);
function fresh(): void {
  current = project();
}

/** The original with one exact substitution. */
function replaceOnce(original: string, from: string, to: string): string {
  expect(original).toContain(from);
  return original.replace(from, to);
}

/**
 * What a minimal diff looks like: the original with one exact
 * substitution, then the repo's Prettier (which may wrap or unwrap the line).
 */
async function swapped(
  original: string,
  from: string,
  to: string,
): Promise<string> {
  return formatted(replaceOnce(original, from, to));
}

async function formatted(text: string): Promise<string> {
  return (
    (await prettier?.format(text, {
      singleQuote: true,
      filepath: path.join(current.root, CARD),
    })) ?? text
  );
}

describe('classes', () => {
  it('replaces classes in place in a className literal, breakpoint prefixes included', async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'card'),
      add: ['px-500', 'md:px-600'],
      remove: [],
    });
    expect(text).toBe(
      await swapped(
        original,
        'gap-200 px-400 md:px-500',
        'gap-200 px-500 md:px-600',
      ),
    );
  });

  it('adds a breakpoint class beside the unprefixed one it would otherwise replace', async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'title'),
      add: ['md:text-title-s'],
      remove: [],
    });
    expect(text).toBe(
      await swapped(
        original,
        "'text-title-m text-primary'",
        "'text-title-m text-primary md:text-title-s'",
      ),
    );
  });

  it("uses the repo's tailwind-merge groups: a text style replaces a text style, not the colour", async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'title'),
      add: ['text-title-s'],
      remove: [],
    });
    expect(text).toBe(
      await swapped(
        original,
        "'text-title-m text-primary'",
        "'text-title-s text-primary'",
      ),
    );
  });

  it('removes a class and the space before it', async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'card'),
      add: [],
      remove: ['gap-200'],
    });
    expect(text).toBe(
      await swapped(original, 'flex-col gap-200 px-400', 'flex-col px-400'),
    );
  });

  it('drops the attribute when its last class goes, rather than leave it empty', async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'card'),
      add: [],
      remove: ['flex', 'flex-col', 'gap-200', 'px-400', 'md:px-500'],
    });
    expect(text).not.toContain('className=""');
    expect(text).toContain('<section id="card">');
  });

  it('adds a className to an element that has none', async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'plain'),
      add: ['gap-100'],
      remove: [],
    });
    expect(text).toBe(
      await swapped(
        original,
        '<div id="plain" />',
        '<div id="plain" className="gap-100" />',
      ),
    );
  });

  it("edits cn()'s unconditional string", async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'cn'),
      add: ['p-400'],
      remove: ['rounded-200'],
    });
    expect(text).toBe(
      await swapped(original, "cn('rounded-200 p-300',", "cn('p-400',"),
    );
  });

  it('inserts a string before the pass-through className when cn() has no unconditional one', async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'cn-no-literal'),
      add: ['rounded-100'],
      remove: [],
    });
    expect(text).toBe(
      await swapped(
        original,
        "cn(active && 'border', className)",
        "cn(active && 'border', 'rounded-100', className)",
      ),
    );
  });
});

describe('cva', () => {
  it("changes one variant's classes inside the config", async () => {
    fresh();
    const original = current.read(BUTTON);
    const { text } = await apply({
      kind: 'cva',
      file: BUTTON,
      component: 'Button',
      variant: 'size',
      value: 'sm',
      add: ['px-400'],
      remove: [],
    });
    expect(text).toBe(
      await swapped(original, "sm: 'h-8 px-300'", "sm: 'h-8 px-400'"),
    );
  });

  it('a quoted variant key works the same', async () => {
    fresh();
    const original = current.read(BUTTON);
    const { text } = await apply({
      kind: 'cva',
      file: BUTTON,
      component: 'Button',
      variant: 'variant',
      value: 'tonal-neutral',
      add: ['bg-neutral-200'],
      remove: [],
    });
    expect(text).toBe(
      await swapped(original, "'bg-neutral-100 text", "'bg-neutral-200 text"),
    );
  });
});

describe('variant', () => {
  const variant = (
    text: string,
    id: string,
    value: string,
    name = 'variant',
  ): Edit => ({
    kind: 'variant',
    at: at(text, id),
    definition: BUTTON,
    component: 'Button',
    name,
    value,
  });

  it('replaces variant="…"', async () => {
    fresh();
    const original = card();
    const { text } = await apply(variant(original, 'save', 'solid'));
    expect(text).toBe(
      await swapped(
        original,
        'id="save" variant="tonal-neutral"',
        'id="save" variant="solid"',
      ),
    );
  });

  it('adds the prop when the call site leaves it to the default', async () => {
    fresh();
    const original = card();
    const { text } = await apply(variant(original, 'default', 'lg', 'size'));
    expect(text).toBe(
      await swapped(
        original,
        '<Button id="default">',
        '<Button id="default" size="lg">',
      ),
    );
  });
});

describe('text', () => {
  const text = (
    source: string,
    id: string,
    before: string,
    after: string,
  ): Edit => ({
    kind: 'text',
    at: at(source, id),
    before,
    after,
  });

  it('replaces the words and keeps the whitespace around them', async () => {
    fresh();
    const original = card();
    const result = await apply(
      text(original, 'title', 'Your changes', 'Your edits'),
    );
    expect(result.text).toBe(
      await swapped(original, '        Your changes\n', '        Your edits\n'),
    );
  });

  it.each([
    ['rtl', 'سلام دنیا', 'درود بر دنیا'],
    ['cjk', '設計を確認', 'デザインを確認する'],
    ['after-emoji', 'Bold', 'Bolder'],
  ])(
    'finds and edits %s text, columns counted in UTF-16 units',
    async (id, before, after) => {
      fresh();
      const original = card();
      const result = await apply(text(original, id, before, after));
      expect(result.text).toBe(
        await swapped(
          original,
          `id="${id}">${before}<`,
          `id="${id}">${after}<`,
        ),
      );
    },
  );

  it('matches text the page shows decoded (&amp;)', async () => {
    fresh();
    const original = card();
    const result = await apply(
      text(original, 'entity', 'Fish & chips', 'Fish & peas'),
    );
    expect(result.plan.status).toBe('direct');
    // The page shows the same text; a bare & needs no entity in JSX.
    expect(result.text).toContain('<p id="entity">Fish & peas</p>');
  });

  it('escapes { } < > in the new text', () => {
    expect(escapeText('a {b} <c>')).toBe("a {'{'}b{'}'} {'<'}c{'>'}");
    expect(escapeText('one\n  two')).toBe('one two');
    expect(escapeText('R&D &amp; more')).toBe("R&D {'&'}amp; more");
  });
});

describe('routes to Claude, with the reason', () => {
  const cases: Array<[string, (text: string) => Edit, string, Scope?]> = [
    [
      'a class built at runtime',
      (text) => ({
        kind: 'classes',
        at: at(text, 'runtime'),
        add: ['p-200'],
        remove: [],
      }),
      REASONS.runtimeClass,
    ],
    [
      'a class in a condition',
      (text) => ({
        kind: 'classes',
        at: at(text, 'cn'),
        add: [],
        remove: ['bg-primary'],
      }),
      REASONS.conditionalClass,
    ],
    [
      'an addition a condition would override',
      (text) => ({
        kind: 'classes',
        at: at(text, 'cn'),
        add: ['bg-white'],
        remove: [],
      }),
      REASONS.conditionalClass,
    ],
    [
      "a class this call site doesn't write",
      (text) => ({
        kind: 'classes',
        at: at(text, 'title'),
        add: [],
        remove: ['font-bold'],
      }),
      REASONS.notHere,
    ],
    [
      'an element from a .map()',
      (text) => ({
        kind: 'classes',
        at: at(text, 'item'),
        add: ['py-200'],
        remove: [],
      }),
      REASONS.list,
    ],
    [
      'a position with no element',
      () => ({
        kind: 'classes',
        at: { file: CARD, line: 2, column: 3 },
        add: ['p-1'],
        remove: [],
      }),
      REASONS.noElement,
    ],
    [
      'text from an expression',
      (text) => ({
        kind: 'text',
        at: at(text, 'dynamic-text'),
        before: 'x',
        after: 'y',
      }),
      REASONS.runtimeText,
    ],
    [
      'text among other elements',
      (text) => ({
        kind: 'text',
        at: at(text, 'mixed'),
        before: 'Hello world',
        after: 'Hi',
      }),
      REASONS.mixedText,
    ],
    [
      'text that differs from the page',
      (text) => ({
        kind: 'text',
        at: at(text, 'title'),
        before: 'Something else',
        after: 'Hi',
      }),
      REASONS.textDiffers,
    ],
    [
      'text at one size only',
      (text) => ({
        kind: 'text',
        at: at(text, 'title'),
        before: 'Your changes',
        after: 'Hi',
      }),
      REASONS.textAtSize,
      { from: 'md' },
    ],
    [
      'a variant set by an expression',
      (text) => ({
        kind: 'variant',
        at: at(text, 'expr'),
        definition: BUTTON,
        component: 'Button',
        name: 'variant',
        value: 'solid',
      }),
      REASONS.runtimeVariant,
    ],
    [
      'a variant the component lacks',
      (text) => ({
        kind: 'variant',
        at: at(text, 'save'),
        definition: BUTTON,
        component: 'Button',
        name: 'variant',
        value: 'ghost',
      }),
      "“ghost” isn't one of its variant variants",
    ],
    [
      'a variant prop the component lacks',
      (text) => ({
        kind: 'variant',
        at: at(text, 'save'),
        definition: BUTTON,
        component: 'Button',
        name: 'tone',
        value: 'x',
      }),
      'the component has no tone variant',
    ],
    [
      'a variant at one size only',
      (text) => ({
        kind: 'variant',
        at: at(text, 'save'),
        definition: BUTTON,
        component: 'Button',
        name: 'variant',
        value: 'solid',
      }),
      REASONS.variantAtSize,
      { from: 'lg' },
    ],
    [
      'a variant whose classes are built from code',
      () => ({
        kind: 'cva',
        file: BUTTON,
        component: 'Button',
        variant: 'variant',
        value: 'raised',
        add: ['bg-neutral-100'],
        remove: [],
      }),
      REASONS.runtimeCvaClasses,
    ],
    [
      'a file outside the UI paths (src/server/**)',
      () => ({
        kind: 'classes',
        at: { file: 'src/server/report.tsx', line: 3, column: 5 },
        add: ['p-200'],
        remove: [],
      }),
      REASONS.notWritable,
    ],
  ];

  it.each(cases)('%s', async (_name, make, reason, scope = 'all') => {
    fresh();
    const original = card();
    const plan = await current.engine.plan(make(original), scope);
    expect(plan).toMatchObject({ status: 'claude', reason });
    expect(card()).toBe(original);
  });
});

describe('writing', () => {
  it('applies several edits to one file in one pass, earlier positions unharmed', async () => {
    fresh();
    const original = card();
    const edits: Edit[] = [
      {
        kind: 'text',
        at: at(original, 'title'),
        before: 'Your changes',
        after: 'Edits',
      },
      {
        kind: 'classes',
        at: at(original, 'plain'),
        add: ['gap-100'],
        remove: [],
      },
      {
        kind: 'classes',
        at: at(original, 'title'),
        add: ['text-title-s'],
        remove: [],
      },
      {
        kind: 'text',
        at: at(original, 'after-emoji'),
        before: 'Bold',
        after: 'Bolder',
      },
    ];
    const plans = await Promise.all(
      edits.map((edit) => current.engine.plan(edit, 'all')),
    );
    const outcomes = await current.engine.write(
      edits.map((edit, index) => ({
        id: String(index),
        edit,
        files: plans[index]?.files ?? [],
      })),
    );
    expect(outcomes.map((outcome) => outcome.result.status)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
    let expected = replaceOnce(
      original,
      "'text-title-m text-primary'}>\n        Your changes",
      "'text-title-s text-primary'}>\n        Edits",
    );
    expected = replaceOnce(
      expected,
      '<div id="plain" />',
      '<div id="plain" className="gap-100" />',
    );
    expected = replaceOnce(expected, '>Bold<', '>Bolder<');
    expect(card()).toBe(await formatted(expected));
  });

  it("formats with the project's Prettier, and formatting again changes nothing", async () => {
    fresh();
    const original = card();
    const { text } = await apply({
      kind: 'classes',
      at: at(original, 'cn-no-literal'),
      add: ['rounded-100', 'bg-neutral-100', 'shadow-floating-card'],
      remove: [],
    });
    // Too long for one line now: Prettier wraps it, with the repo's single quotes.
    expect(text).toContain(
      "className={cn(\n          active && 'border',\n          'rounded-100 bg-neutral-100 shadow-floating-card',\n          className,\n        )}",
    );
    const again = await prettier?.format(text ?? '', {
      singleQuote: true,
      filepath: path.join(current.root, CARD),
    });
    expect(again).toBe(text);
  });

  it('stops with "the file changed; reload" when the file moved on since staging, and writes nothing', async () => {
    fresh();
    const original = card();
    const edit: Edit = {
      kind: 'classes',
      at: at(original, 'card'),
      add: ['px-500'],
      remove: [],
    };
    const plan = await current.engine.plan(edit, 'all');
    const cva: Edit = {
      kind: 'cva',
      file: BUTTON,
      component: 'Button',
      variant: 'size',
      value: 'sm',
      add: ['px-400'],
      remove: [],
    };
    const cvaPlan = await current.engine.plan(cva, 'all');
    const button = current.read(BUTTON);

    writeFileSync(
      path.join(current.root, CARD),
      original.replace('Your changes', 'Changed by a developer'),
    );
    const outcomes = await current.engine.write([
      { id: 'button', edit: cva, files: cvaPlan.files },
      { id: 'card', edit, files: plan.files },
    ]);
    expect(outcomes).toEqual([
      {
        id: 'button',
        result: {
          status: 'failed',
          message: NOT_WRITTEN,
        },
      },
      {
        id: 'card',
        result: {
          status: 'failed',
          message: `${CARD} was edited after you made this change. Reload, then redo it.`,
        },
      },
    ]);
    // All or none: the other file is untouched too.
    expect(current.read(BUTTON)).toBe(button);
  });

  it('refuses to write src/server/** even when a change names it as direct', async () => {
    fresh();
    const report = 'src/server/report.tsx';
    const text = current.read(report);
    const edit: Edit = {
      kind: 'classes',
      at: at(text, 'report', report),
      add: ['p-200'],
      remove: [],
    };
    const outcomes = await current.engine.write([{ id: 'x', edit, files: [] }]);
    expect(outcomes).toEqual([
      {
        id: 'x',
        result: {
          status: 'failed',
          message: `${report} isn't a UI file Truing may change.`,
        },
      },
    ]);
    expect(current.read(report)).toBe(text);
  });
});

describe('from the task review', () => {
  it('refuses a stale position: a line added above makes it name another element', async () => {
    fresh();
    const original = card();
    const edit: Edit = {
      kind: 'classes',
      at: at(original, 'rtl'),
      tag: 'p',
      add: ['p-200'],
      remove: [],
    };
    // A developer adds a line above; the old position now points at a <span>.
    writeFileSync(
      path.join(current.root, CARD),
      original.replace(
        '      <p id="rtl">',
        '      <span id="note">New</span>\n      <p id="rtl">',
      ),
    );
    const plan = await current.engine.plan(edit, 'all');
    expect(plan).toMatchObject({ status: 'claude', reason: REASONS.noElement });
  });

  it('adds after the last argument when cn() ends with a trailing comma', async () => {
    fresh();
    const file = 'src/features/trailing.tsx';
    writeFileSync(
      path.join(current.root, file),
      [
        'export function Trailing({ active }: { active: boolean }) {',
        '  return (',
        '    <div',
        '      id="trailing"',
        '      className={cn(',
        "        active && 'border',",
        '      )}',
        '    />',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const text = current.read(file);
    const { text: written } = await apply({
      kind: 'classes',
      at: at(text, 'trailing', file),
      add: ['p-400'],
      remove: [],
    });
    expect(written).toContain("className={cn(active && 'border', 'p-400')}");
  });

  it("puts a new class before a className passed inside another call, so the consumer's still wins", async () => {
    fresh();
    const button = current.read(BUTTON);
    const { text } = await apply({
      kind: 'classes',
      at: at(button.replace('<button', '<button id="b"'), 'b', BUTTON),
      add: ['px-500'],
      remove: [],
    });
    expect(text).toContain(
      "className={cn('px-500', buttonVariants({ variant, size, className }))}",
    );
  });

  it('never takes an inherited name for a variant', async () => {
    fresh();
    const plan = await current.engine.plan(
      {
        kind: 'variant',
        at: at(card(), 'save'),
        definition: BUTTON,
        component: 'Button',
        name: 'constructor',
        value: 'name',
      },
      'all',
    );
    expect(plan).toMatchObject({
      status: 'claude',
      reason: 'the component has no constructor variant',
    });
  });

  it('routes a className added to a component to Claude: only its own JSX says if it takes one', async () => {
    fresh();
    const plan = await current.engine.plan(
      {
        kind: 'classes',
        at: at(card(), 'default'),
        add: ['mt-200'],
        remove: [],
      },
      'all',
    );
    expect(plan).toMatchObject({
      status: 'claude',
      reason: REASONS.noClassName,
    });
  });

  it('adds a className to a component known to pass one on (TRU-4.2)', async () => {
    const { text, plan } = await apply({
      kind: 'classes',
      at: at(card(), 'default'),
      add: ['mt-200'],
      remove: [],
      takesClassName: true,
    });
    expect(plan.status).toBe('direct');
    expect(text).toContain('className="mt-200"');
  });
});

describe('takesClassName (TRU-4.2)', () => {
  const jsx = (text: string): Jsx => {
    const node = jsxAt(parseSource(text, 'a.tsx'), text.indexOf('<div'));
    if (!node) throw new Error('no JSX');
    return node;
  };

  it.each([
    ['in cn()', "const a = <div className={cn('x', className)} />;", true],
    [
      'nested in a call',
      'const a = <div className={cn(variants({ className }))} />;',
      true,
    ],
    ['from props', 'const a = <div className={props.className} />;', true],
    ['in a spread', 'const a = <div {...props} />;', true],
    [
      'a literal after a spread',
      'const a = <div {...p} className="x" />;',
      false,
    ],
    [
      'a literal before a spread',
      'const a = <div className="x" {...p} />;',
      false,
    ],
    ['a literal', 'const a = <div className="x" />;', false],
    ["cn() that doesn't", "const a = <div className={cn('x')} />;", false],
    ['nothing', 'const a = <div />;', false],
  ])('%s', (_name, text, expected) => {
    expect(takesClassName(jsx(text))).toBe(expected);
  });
});

describe('writable paths', () => {
  it.each([
    ['src/features/card.tsx', true],
    ['src/components/ui/button.tsx', true],
    ['src/app/globals.css', true],
    ['src/stories/button.stories.tsx', true],
    ['src/server/report.tsx', false],
    ['src/server/deep/a.tsx', false],
    ['src/app/api/x/route.ts', false],
    ['src/lib/utils.ts', false],
    ['../outside/src/a.tsx', false],
    ['/etc/passwd', false],
    ['package.json', false],
  ])('%s → %s', (file, allowed) => {
    fresh();
    expect(current.engine.writable(file)).toBe(allowed);
  });

  it('matches ** across folders and * within one', () => {
    expect(matchesGlob('src/a.tsx', 'src/**/*.tsx')).toBe(true);
    expect(matchesGlob('src/a/b/c.tsx', 'src/**/*.tsx')).toBe(true);
    expect(matchesGlob('src/a/b.ts', 'src/**/*.tsx')).toBe(false);
    expect(matchesGlob('srcx/a.tsx', 'src/**/*.tsx')).toBe(false);
    expect(matchesGlob('src/app/x/route.ts', 'src/app/**/route.ts')).toBe(true);
  });
});

// TRU-4.5: an edit the designer chose for every item, and classes kept apart from JSX.
const TOAST = 'src/features/toast.tsx';
it('writes an edit in a list once the designer chose every item', async () => {
  const { engine, read } = project();
  const edit: Edit = {
    kind: 'classes',
    at: at(read(CARD), 'item'),
    tag: 'li',
    add: ['py-200'],
    remove: ['py-100'],
  };
  const left = await engine.plan(edit, 'all');
  expect(left.status === 'claude' && left.reason).toBe(REASONS.list);
  const chosen = await engine.plan({ ...edit, list: true }, 'all');
  expect(chosen.status).toBe('direct');
  await engine.write([
    { id: 'c', edit: { ...edit, list: true }, files: chosen.files },
  ]);
  expect(read(CARD)).toContain('<li id="item" key={item} className="py-200">');
});

it("writes in a tones[tone] entry that holds what's removed, leaving the others", async () => {
  const { engine, read } = project();
  const edit: Edit = {
    kind: 'classes',
    at: at(read(TOAST), 'toast', TOAST),
    tag: 'div',
    add: ['from-primary'],
    remove: ['from-brand-1-500'],
  };
  const plan = await engine.plan(edit, 'all');
  expect(plan.status).toBe('direct');
  await engine.write([{ id: 'c', edit, files: plan.files }]);
  const written = read(TOAST);
  expect(written).toContain(
    "info: 'bg-gradient-to-r to-brand-2-500 from-primary'",
  );
  expect(written).toContain("error: 'bg-destructive'");
  expect(written).toContain("cn('w-full', tones[tone])");
});

it('sends a change to a tones[tone] entry to Claude when nothing says which', async () => {
  const { engine, read } = project();
  const plan = await engine.plan(
    {
      kind: 'classes',
      at: at(read(TOAST), 'toast', TOAST),
      tag: 'div',
      add: [],
      remove: ['not-in-any-entry'],
    },
    'all',
  );
  expect(plan.status === 'claude' && plan.reason).toBe(REASONS.notHere);
});

it("writes a cva call's base string in this file", async () => {
  const { engine, read } = project();
  const edit: Edit = {
    kind: 'classes',
    at: at(read(TOAST), 'tab', TOAST),
    tag: 'span',
    add: ['px-400'],
    remove: ['px-300'],
  };
  const plan = await engine.plan(edit, 'all');
  expect(plan.status).toBe('direct');
  await engine.write([{ id: 'c', edit, files: plan.files }]);
  expect(read(TOAST)).toContain("cva('flex px-400', {");
});

it('sends a class a cva variant sets to Claude, as it comes from a condition', async () => {
  const { engine, read } = project();
  const plan = await engine.plan(
    {
      kind: 'classes',
      at: at(read(TOAST), 'tab', TOAST),
      tag: 'span',
      add: ['text-info'],
      remove: ['text-grey-700'],
    },
    'all',
  );
  expect(plan.status === 'claude' && plan.reason).toBe(
    REASONS.conditionalClass,
  );
});
