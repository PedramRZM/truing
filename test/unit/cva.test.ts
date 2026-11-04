// The cva parser against the real thing: every `cva()` call in the design-system
// fixture's primitives is caught as the module loads, and the parsed config must match
// what cva received. A variant the parser misses or misreads fails here.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import {
  configFor,
  parseCvaFile,
  variantsOf,
} from '../../src/modules/selection/cva';

type Captured = {
  variants?: Record<string, Record<string, string | string[]>>;
  defaultVariants?: Record<string, unknown>;
};

const captured = vi.hoisted(() => [] as Captured[]);
vi.mock('class-variance-authority', () => ({
  cva: (_base: unknown, config: Captured = {}) => {
    captured.push(config);
    return () => '';
  },
}));

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../fixtures/design-system',
);
const PRIMITIVES = ['alert', 'badge', 'button', 'sheet', 'tabs'];

const squash = (classes: string | string[]): string =>
  (Array.isArray(classes) ? classes.join(' ') : classes)
    .replace(/\s+/g, ' ')
    .trim();

it.each(PRIMITIVES)(
  'parses every cva() config in %s.tsx as cva receives it',
  async (name) => {
    const file = path.join(root, 'src/components/ui', `${name}.tsx`);
    captured.length = 0;
    await import(file);
    const parsed = parseCvaFile(readFileSync(file, 'utf8'), file);

    expect(parsed.configs.length).toBe(captured.length);
    parsed.configs.forEach((config, index) => {
      const real = captured[index] ?? {};
      expect(config.dynamic).toEqual([]);
      const realVariants = Object.fromEntries(
        Object.entries(real.variants ?? {}).map(([variant, values]) => [
          variant,
          Object.fromEntries(
            Object.entries(values).map(([value, classes]) => [
              value,
              squash(classes),
            ]),
          ),
        ]),
      );
      expect(config.variants).toEqual(realVariants);
      expect(config.defaultVariants).toEqual(
        Object.fromEntries(
          Object.entries(real.defaultVariants ?? {}).map(([k, v]) => [
            k,
            String(v),
          ]),
        ),
      );
    });
  },
);

it("reads a Button's variant from its props, and the default for one it wasn't given", () => {
  const file = path.join(root, 'src/components/ui/button.tsx');
  const parsed = parseCvaFile(readFileSync(file, 'utf8'), file);
  const config = configFor(parsed, 'Button');

  if (!config) throw new Error('No cva config for Button in button.tsx.');
  expect(config.name).toBe('buttonVariants');
  expect(
    variantsOf(config, { variant: 'tonal-neutral', onClick: () => {} }),
  ).toEqual([
    { name: 'variant', value: 'tonal-neutral', from: 'prop' },
    { name: 'size', value: 'default', from: 'default' },
  ]);
});

it('reads template literals over same-file constants, and reports anything else as dynamic', () => {
  const parsed = parseCvaFile(
    [
      "const small = 'h-6 px-200';",
      'const chip = cva("rounded", { variants: {',
      "  size: { sm: `${small} text-xs`, md: ['h-8', 'px-300'] },",
      '  tone: { live: someFunction() },',
      "}, defaultVariants: { size: 'sm' } });",
      'function Chip() { return chip({}); }',
    ].join('\n'),
    'chip.tsx',
  );

  expect(parsed.configs[0]).toMatchObject({
    name: 'chip',
    line: 2,
    variants: { size: { sm: 'h-6 px-200 text-xs', md: 'h-8 px-300' } },
    defaultVariants: { size: 'sm' },
    dynamic: ['tone'],
  });
  expect(parsed.usedBy).toEqual({ Chip: 'chip' });
});
