import { defineProbe } from '../../module';
import { MODES } from '../../protocol';

import claude from './module';

/**
 * Keeps the prompt on a pick beside its element: where the element is, as the
 * page scrolls and resizes. It asks the page nothing until the panel names one.
 */
export default defineProbe(claude, (ctx) => {
  let selector: string | null = null;
  let frame: number | null = null;

  const report = ctx.guard(() => {
    frame = null;
    const element =
      selector !== null && ctx.mode() === MODES.select
        ? document.querySelector(selector)
        : null;
    if (selector === null || !element) {
      ctx.report('anchor', null);
      return;
    }
    const { x, y, width, height } = element.getBoundingClientRect();
    ctx.report('anchor', { selector, x, y, width, height });
  });

  const soon = (): void => {
    if (selector === null) return;
    frame ??= requestAnimationFrame(report);
  };

  ctx.listen('scroll', soon, { capture: true, passive: true });
  ctx.listen('resize', soon, { passive: true });
  ctx.onMode(report);

  return {
    commands: {
      track: (input) => {
        selector = input.selector;
        report();
        return { ok: true };
      },
    },
  };
});
