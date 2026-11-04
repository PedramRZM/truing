import * as z from 'zod/mini';

import { defineModule } from '../../src/module';

/**
 * A toy module with all four parts, the example in MODULES.md: each frame's
 * probe counts the page's elements, the panel shows the counts, the server
 * answers with them, and Claude can ask for a count.
 */
export default defineModule({
  id: 'element-count',
  title: 'Element count',
  probe: {
    reports: {
      /** Sent when the page loads, and again whenever its DOM changes. */
      count: z.object({ elements: z.number() }),
    },
    commands: {
      /** Counts now, all elements or those matching a CSS selector. */
      count: {
        input: z.object({ selector: z.optional(z.string()) }),
        output: z.object({ elements: z.number() }),
      },
    },
  },
  panel: { docks: ['left'], tab: 'design' },
  server: {
    ops: {
      /** The latest count, by frame. */
      counts: {
        input: z.object({}),
        output: z.record(z.string(), z.number()),
      },
    },
  },
  claude: {
    tools: {
      count_elements: {
        description:
          'Counts the elements on the page shown in each frame of Truing. Give a CSS selector to count only the elements that match it. Returns the count by frame.',
        input: z.object({ selector: z.optional(z.string()) }),
      },
    },
  },
});
