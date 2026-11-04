import { describe, expect, it } from 'vitest';

import {
  boundsOf,
  FRAME_GAP,
  fitCamera,
  layoutFrames,
  stepScale,
  wheelZoomFactor,
  zoomAt,
} from '../../src/shell/camera';

describe('layoutFrames', () => {
  it('puts frames side by side with a gap, tops aligned', () => {
    const rects = layoutFrames([
      { size: { width: 390, height: 844 } },
      { size: { width: 768, height: 1024 } },
    ]);
    expect(rects).toEqual([
      { x: 0, y: 0, width: 390, height: 844 },
      { x: 390 + FRAME_GAP, y: 0, width: 768, height: 1024 },
    ]);
  });

  it('keeps the next frame put when a left edge drag moved the first one', () => {
    // A west grip shrank the first frame by 100 and moved its origin by 100.
    const rects = layoutFrames([
      { size: { width: 290, height: 844 }, offset: { x: 100, y: 0 } },
      { size: { width: 768, height: 1024 } },
    ]);
    expect(rects[0]?.x).toBe(100);
    expect(rects[1]?.x).toBe(390 + FRAME_GAP);
  });
});

describe('fitCamera', () => {
  const safe = { x: 0, y: 0, width: 1600, height: 900 };

  it('never magnifies past 100%', () => {
    const camera = fitCamera({ x: 0, y: 0, width: 390, height: 300 }, safe);
    expect(camera.scale).toBe(1);
  });

  it('shrinks what does not fit, and centres it', () => {
    const bounds = boundsOf(
      layoutFrames([
        { size: { width: 390, height: 844 } },
        { size: { width: 768, height: 1024 } },
        { size: { width: 1440, height: 900 } },
      ]),
    );
    const camera = fitCamera(bounds, safe);
    expect(camera.scale).toBeLessThan(1);
    const left = camera.x + bounds.x * camera.scale;
    const right = camera.x + (bounds.x + bounds.width) * camera.scale;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(safe.width);
    expect(Math.round(left)).toBe(Math.round(safe.width - right));
  });
});

describe('zoom', () => {
  it('keeps the point under the pointer in place', () => {
    const camera = { x: 100, y: 50, scale: 0.5 };
    const at = { x: 400, y: 300 };
    const worldX = (at.x - camera.x) / camera.scale;
    const next = zoomAt(camera, 1, at);
    expect(next.x + worldX * next.scale).toBeCloseTo(at.x);
  });

  it('steps through Chrome-like levels, 10% around 100%', () => {
    expect(stepScale(1, 1)).toBe(1.1);
    expect(stepScale(1, -1)).toBe(0.9);
    expect(stepScale(0.9, -1)).toBe(0.8);
  });

  it('zooms one mouse-wheel notch by about 10%, not a third', () => {
    // A notch reports about 100 px; TRU-1.5 feedback: 100% became 33% in one notch.
    expect(wheelZoomFactor(100)).toBeCloseTo(0.905, 2);
    expect(wheelZoomFactor(-100)).toBeCloseTo(1.105, 2);
    // A pinch sends small deltas, and keeps them.
    expect(wheelZoomFactor(2)).toBeCloseTo(0.98, 2);
  });
});
