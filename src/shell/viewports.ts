export const PRESETS = {
  phone: { id: 'phone', label: 'Phone', width: 390, height: 844 },
  tablet: { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  desktop: { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
} as const;

export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = [
  'phone',
  'tablet',
  'desktop',
] as const satisfies readonly PresetId[];

export type Viewport =
  | { kind: 'preset'; preset: PresetId }
  | { kind: 'custom'; width: number; height: number }
  /** One frame at the canvas's own size, without device chrome (TRU-2.3). */
  | { kind: 'fill' };

export type Size = { width: number; height: number };

export const MIN_SIZE = 240;
export const MAX_SIZE = 3840;

/** A viewport's size; Fill's is the canvas's, never under the smallest frame. */
export function sizeOf(viewport: Viewport, canvas: Size): Size {
  if (viewport.kind === 'custom') {
    return { width: viewport.width, height: viewport.height };
  }
  if (viewport.kind === 'fill') {
    return {
      width: Math.max(MIN_SIZE, canvas.width),
      height: Math.max(MIN_SIZE, canvas.height),
    };
  }
  const { width, height } = PRESETS[viewport.preset];
  return { width, height };
}

export function clampSize(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_SIZE;
  }
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
}

/**
 * The one scale that fits every frame, side by side, in the canvas. Frames
 * are never scaled up; the app inside still lays out at its real width.
 */
export function fitScale(
  frames: readonly Size[],
  available: Size,
  gap: number,
  labelHeight: number,
): number {
  if (frames.length === 0 || available.width <= 0 || available.height <= 0) {
    return 1;
  }

  const totalWidth =
    frames.reduce((sum, frame) => sum + frame.width, 0) +
    gap * (frames.length - 1);
  const tallest = Math.max(...frames.map((frame) => frame.height));
  const byWidth = available.width / totalWidth;
  const byHeight = (available.height - labelHeight) / tallest;

  return Math.min(1, byWidth, byHeight);
}
