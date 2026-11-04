// The contract's types: what a module declares is what its parts may use.
// tsc checks the @ts-expect-error lines; vitest runs the one real assertion.
import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';

import {
  defineModule,
  definePanel,
  defineProbe,
  defineServer,
} from '../../src/module';

const toy = defineModule({
  id: 'toy',
  title: 'Toy',
  probe: {
    reports: { count: z.object({ elements: z.number() }) },
    commands: {
      count: {
        input: z.object({}),
        output: z.object({ elements: z.number() }),
      },
    },
  },
  panel: { docks: ['left'] },
  server: {
    ops: { total: { input: z.object({}), output: z.number() } },
    direct: { rename: { input: z.object({ to: z.string() }) } },
  },
  claude: {
    tools: { count_elements: { description: 'Counts.', input: z.object({}) } },
  },
});

const reportOnly = defineModule({
  id: 'report-only',
  title: 'Report only',
  probe: { reports: { ping: z.object({}) } },
});

describe('the contract types', () => {
  it('ties each part to its declaration', () => {
    defineProbe(toy, (ctx) => {
      ctx.report('count', { elements: 1 });
      // @ts-expect-error an undeclared report
      ctx.report('total', { elements: 1 });
      // @ts-expect-error a payload of the wrong shape
      ctx.report('count', { elements: 'one' });
      return { commands: { count: () => ({ elements: 1 }) } };
    });

    // @ts-expect-error a declared command needs its handler
    defineProbe(toy, () => ({ commands: {} }));

    // A module with no commands returns nothing from its probe.
    defineProbe(reportOnly, (ctx) => ctx.report('ping', {}));

    definePanel(toy, {
      left: ({ reports, call }) => {
        const count: number | undefined = reports.count['main']?.elements;
        void call('total', {});
        // @ts-expect-error an undeclared op
        void call('counts', {});
        return count;
      },
    });

    // @ts-expect-error a section for a dock the module doesn't declare
    definePanel(toy, { left: () => null, right: () => null });

    // @ts-expect-error every declared dock needs its section
    definePanel(toy, {});

    defineServer(toy, (ctx) => {
      void ctx.stage({
        label: 'Rename',
        intent: 'Rename it',
        viewport: { frame: null, width: null },
        property: 'name',
        write: { by: 'op', op: 'rename', input: { to: 'b' } },
      });
      void ctx.stage({
        label: 'Rename',
        intent: 'Rename it',
        viewport: { frame: null, width: null },
        property: 'name',
        // @ts-expect-error a direct operation the module doesn't declare
        write: { by: 'op', op: 'delete', input: {} },
      });
      return {
        ops: { total: () => 1 },
        direct: { rename: () => ({ status: 'applied' }) },
        tools: { count_elements: () => ({ main: 1 }) },
      };
    });

    // @ts-expect-error every declared op, direct operation and tool needs a handler
    defineServer(toy, () => ({ ops: { total: () => 1 } }));

    expect(toy.id).toBe('toy');
  });

  it('refuses an id that is not kebab-case, and a tool name that is not snake_case', () => {
    expect(() => defineModule({ id: 'Toy', title: 'Toy' })).toThrow(
      /kebab-case/,
    );
    expect(() =>
      defineModule({
        id: 'toy',
        title: 'Toy',
        claude: {
          tools: { countElements: { description: 'x', input: z.object({}) } },
        },
      }),
    ).toThrow(/snake_case/);
  });
});
