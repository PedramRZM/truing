import type { Size } from './viewports';

/** Where the canvas's world sits on screen: frames are laid out at real pixels in world space. */
export type Camera = { x: number; y: number; scale: number };

export type Rect = { x: number; y: number; width: number; height: number };

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;
/**
 * Keyboard zoom steps: Chrome's own page-zoom levels, so Ctrl +/- feel the
 * same as in the browser (10% steps around 100%), plus 10% and 15% below.
 */
const STEPS = [
  0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2,
  2.5, 3, 4,
];

/** Pixels per line, for wheels that report lines (deltaMode 1). */
const LINE_HEIGHT = 16;
/** The most one wheel event may zoom: a notch is about 10%. */
const MAX_WHEEL_DELTA = 10;

/** A wheel's vertical movement in pixels, whatever unit the device reports. */
export function wheelPixels(deltaY: number, deltaMode: number): number {
  return deltaMode === 1 ? deltaY * LINE_HEIGHT : deltaY;
}

/**
 * The zoom factor for one Ctrl/⌘-wheel or pinch event. A mouse notch reports
 * about 100 px, a pinch a few px per event; capping each event keeps a notch
 * at about 10% while a pinch stays continuous.
 */
export function wheelZoomFactor(deltaPixels: number): number {
  const capped = Math.max(
    -MAX_WHEEL_DELTA,
    Math.min(MAX_WHEEL_DELTA, deltaPixels),
  );
  return Math.exp(-capped * 0.01);
}

export const FRAME_GAP = 80;
export const FIT_PADDING = 64;
/** Room above each frame for its label, in screen pixels. */
export const LABEL_SPACE = 28;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Frames side by side from the world's origin, top edges aligned. */
export type Point = { x: number; y: number };

/**
 * Frames side by side, top edges aligned, each placed after the previous
 * frame's actual right edge. `offset` is how far a left or top edge drag moved
 * a frame's origin, so its opposite edge stays put (Airship's convention).
 */
export function layoutFrames(
  frames: ReadonlyArray<{ size: Size; offset?: Point }>,
): Rect[] {
  let next = 0;
  return frames.map(({ size, offset }) => {
    const rect = {
      x: next + (offset?.x ?? 0),
      y: offset?.y ?? 0,
      width: size.width,
      height: size.height,
    };
    next = rect.x + rect.width + FRAME_GAP;
    return rect;
  });
}

export function boundsOf(rects: readonly Rect[]): Rect {
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * The camera that shows `bounds` whole inside `safe` (the canvas minus the
 * bar), never magnified past 100% (Airship's fitTo).
 */
export function fitCamera(bounds: Rect, safe: Rect): Camera {
  const width = Math.max(1, safe.width - FIT_PADDING * 2);
  const height = Math.max(1, safe.height - FIT_PADDING * 2 - LABEL_SPACE);
  const scale = clampScale(
    Math.min(
      1,
      width / Math.max(1, bounds.width),
      height / Math.max(1, bounds.height),
    ),
  );

  return {
    scale,
    x: safe.x + (safe.width - bounds.width * scale) / 2 - bounds.x * scale,
    y:
      safe.y +
      FIT_PADDING +
      LABEL_SPACE +
      Math.max(0, (height - bounds.height * scale) / 2) -
      bounds.y * scale,
  };
}

/** Zooms about a screen point, so what is under the pointer stays under it. */
export function zoomAt(
  camera: Camera,
  scale: number,
  at: { x: number; y: number },
): Camera {
  const next = clampScale(scale);
  const ratio = next / camera.scale;
  return {
    scale: next,
    x: at.x - (at.x - camera.x) * ratio,
    y: at.y - (at.y - camera.y) * ratio,
  };
}

export function stepScale(scale: number, direction: 1 | -1): number {
  if (direction > 0) {
    return STEPS.find((step) => step > scale + 0.001) ?? MAX_SCALE;
  }
  return [...STEPS].reverse().find((step) => step < scale - 0.001) ?? MIN_SCALE;
}
