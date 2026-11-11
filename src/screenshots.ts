// Pictures of what's on the canvas (TRU-5.2), for Claude and for a turn's result. It
// crops the shell's own page instead of asking Playwright for the element: that
// would scroll the page and the canvas into view, under the designer's hands.
import type { Frame, Page } from 'playwright';

import type { ScreenshotControl } from './module';
import { FRAME_NAME_PREFIX } from './protocol';

/** Playwright's ARIA roles, which it doesn't export by name. */
type AriaRole = Parameters<Frame['getByRole']>[0];

/** Truing's own marks stay out: the overlay in the frame, the canvas's labels. */
const HIDE_TRUING = [
  'truing-overlay { display: none !important; }',
  '.canvas-chrome { visibility: hidden !important; }',
].join('\n');

const TIMEOUT_MS = 5000;

type Box = { x: number; y: number; width: number; height: number };

/** What two boxes share; null when that's less than a pixel. */
export function overlap(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  return width >= 1 && height >= 1 ? { x, y, width, height } : null;
}

/** Claude reads images up to about this long side best; larger ones are scaled down. */
export const MAX_SIDE = 1568;

export function createScreenshots(shell: Page): ScreenshotControl {
  /** The canvas, where the frames are in view: panels sit beside it, not over it. */
  const canvasBox = (): Promise<Box | null> =>
    shell.locator('.canvas').boundingBox({ timeout: TIMEOUT_MS });

  const iframeOf = (frame: string) =>
    shell.locator(`iframe[name="${FRAME_NAME_PREFIX}${frame}"]`);

  /** Two animation frames: the camera moved, and the canvas drew it. */
  const drawn = (): Promise<unknown> =>
    shell.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );

  const innerOf = (frame: string) =>
    shell
      .frames()
      .find((candidate) => candidate.name() === `${FRAME_NAME_PREFIX}${frame}`);

  return {
    async act(frame, action) {
      const inner = innerOf(frame);
      if (!inner) throw new Error(`Frame "${frame}" has no page loaded.`);
      if (action.kind === 'scroll' && !action.to) {
        const by = action.by ?? 600;
        await inner.evaluate((dy) => window.scrollBy(0, dy), by);
        return `Scrolled frame ${frame} by ${by} pixels.`;
      }
      const target = action.kind === 'scroll' ? action.to : action.target;
      if (!target) throw new Error('Name the element by its role and name.');
      const found = inner.getByRole(target.role as AriaRole, {
        name: target.name,
      });
      const count = await found.count();
      if (count === 0) {
        throw new Error(
          `No ${target.role} named "${target.name}" in frame ${frame}. A screenshot shows what is there.`,
        );
      }
      const element = found.first();
      await shell.evaluate(
        (id) => window.__truingCapture?.show(id) ?? false,
        frame,
      );
      try {
        await element.scrollIntoViewIfNeeded({ timeout: TIMEOUT_MS });
        // The person sees what Claude is about to use: an outline, for a moment.
        await element.evaluate((node) => {
          if (!(node instanceof HTMLElement)) return;
          const before = node.style.outline;
          node.style.outline = '3px solid Highlight';
          setTimeout(() => {
            node.style.outline = before;
          }, 800);
        });
        await drawn();
        const what = `the ${target.role} "${target.name}" in frame ${frame}`;
        // Forced: the frame is scaled on the canvas, where Playwright's own
        // check for what's under the pointer is wrong (.agents/memory/connected-is-not-hydrated.md).
        switch (action.kind) {
          case 'scroll':
            return `Scrolled to ${what}.`;
          case 'hover':
            await element.hover({ force: true, timeout: TIMEOUT_MS });
            return `Pointed at ${what}.`;
          case 'click':
            await element.click({ force: true, timeout: TIMEOUT_MS });
            return `Clicked ${what}.`;
          case 'type':
            await element.fill(action.text, { timeout: TIMEOUT_MS });
            if (action.submit) await element.press('Enter');
            return `Typed into ${what}${action.submit ? ', and pressed Enter' : ''}.`;
        }
      } finally {
        await shell
          .evaluate(() => window.__truingCapture?.restore())
          .catch(() => {});
      }
    },

    async capture(frame, options = {}) {
      const { selector, maxSide = MAX_SIDE } = options;
      const shown = await shell.evaluate(
        ({ id, side }) => window.__truingCapture?.show(id, side) ?? false,
        { id: frame, side: maxSide },
      );
      if (!shown) return null;
      const inner = shell
        .frames()
        .find(
          (candidate) => candidate.name() === `${FRAME_NAME_PREFIX}${frame}`,
        );
      // The page's own scroll, put back after an element was scrolled to.
      const scrolled = selector
        ? await inner
            ?.evaluate((wanted) => {
              const element = document.querySelector(wanted);
              if (!element) return null;
              const before = { x: window.scrollX, y: window.scrollY };
              element.scrollIntoView({ block: 'center', inline: 'center' });
              return before;
            }, selector)
            .catch(() => null)
        : null;
      try {
        await drawn();
        const canvas = await canvasBox();
        const box = selector
          ? await inner
              ?.locator(selector)
              .first()
              .boundingBox({ timeout: TIMEOUT_MS })
          : await iframeOf(frame).boundingBox({ timeout: TIMEOUT_MS });
        const clip = canvas && box && overlap(box, canvas);
        if (!clip) return null;
        // One pixel to a CSS pixel: the camera already kept it within `maxSide`.
        return await shell.screenshot({
          type: 'png',
          clip,
          scale: 'css',
          style: HIDE_TRUING,
          timeout: TIMEOUT_MS,
        });
      } finally {
        if (scrolled) {
          await inner
            ?.evaluate(({ x, y }) => window.scrollTo(x, y), scrolled)
            .catch(() => {});
        }
        await shell
          .evaluate(() => window.__truingCapture?.restore())
          .catch(() => {});
      }
    },

    async element(frame, selector) {
      const inner = shell.frames().find((candidate) => {
        return candidate.name() === `${FRAME_NAME_PREFIX}${frame}`;
      });
      const canvas = await canvasBox();
      if (!inner || !canvas) return null;
      const box = await inner
        .locator(selector)
        .first()
        .boundingBox({ timeout: TIMEOUT_MS });
      const clip = box && overlap(box, canvas);
      if (!clip) return null;
      return shell.screenshot({
        type: 'png',
        clip,
        style: HIDE_TRUING,
        timeout: TIMEOUT_MS,
      });
    },

    async frame(frame) {
      const canvas = await canvasBox();
      const box = await iframeOf(frame).boundingBox({ timeout: TIMEOUT_MS });
      const clip = canvas && box && overlap(box, canvas);
      if (!clip) return null;
      return shell.screenshot({
        type: 'jpeg',
        quality: 60,
        clip,
        style: HIDE_TRUING,
        timeout: TIMEOUT_MS,
      });
    },
  };
}
