import { defineProbe } from '../../src/module';

import elementCount from './module';

export default defineProbe(elementCount, (ctx) => {
  const count = (selector?: string): number =>
    document.querySelectorAll(selector ?? '*').length;

  // At most one report every 250 ms while the page changes.
  let timer: ReturnType<typeof setTimeout> | null = null;
  const report = ctx.guard(() => {
    timer = null;
    ctx.report('count', { elements: count() });
  });
  const soon = (): void => {
    timer ??= setTimeout(report, 250);
  };

  ctx.listen('load', () => {
    report();
    // guard: if the callback ever throws, the module stops, not the frame.
    new MutationObserver(ctx.guard(soon)).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });

  return {
    commands: {
      count: ({ selector }) => ({ elements: count(selector) }),
    },
  };
});
