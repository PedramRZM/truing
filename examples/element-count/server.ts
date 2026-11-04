import { defineServer } from '../../src/module';

import elementCount from './module';

export default defineServer(elementCount, (ctx) => ({
  ops: {
    counts: () =>
      Object.fromEntries(
        Object.entries(ctx.reports('count')).map(([frame, latest]) => [
          frame,
          latest.elements,
        ]),
      ),
  },
  tools: {
    // Asks every frame's probe now, rather than reading the last reports, so
    // a selector works too.
    count_elements: async ({ selector }) => {
      const frames = ctx.frames();
      if (frames.length === 0) {
        throw new Error('No frame of the app is open in Truing.');
      }
      const counts = await Promise.all(
        frames.map(async (frame) => {
          const { elements } = await ctx.command(frame, 'count', { selector });
          return [frame, elements] as const;
        }),
      );
      return Object.fromEntries(counts);
    },
  },
}));
