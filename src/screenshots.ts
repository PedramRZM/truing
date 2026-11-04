// Pictures of what's on the canvas (TRU-5.2), for Claude and for a turn's result. It
// crops the shell's own page instead of asking Playwright for the element: that
// would scroll the page and the canvas into view, under the designer's hands.
import type { Page } from 'playwright';

import type { ScreenshotControl } from './module';
import { FRAME_NAME_PREFIX } from './protocol';

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

export function createScreenshots(shell: Page): ScreenshotControl {
  /** The canvas, where the frames are in view: panels sit beside it, not over it. */
  const canvasBox = (): Promise<Box | null> =>
    shell.locator('.canvas').boundingBox({ timeout: TIMEOUT_MS });

  const iframeOf = (frame: string) =>
    shell.locator(`iframe[name="${FRAME_NAME_PREFIX}${frame}"]`);

  return {
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
