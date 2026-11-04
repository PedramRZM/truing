/**
 * Where the prompt on a pick starts, in the canvas's pixels. It ends at the
 * element's end, as the element's name sits at its start. TRU-5.3: a pick in the
 * page's left part has no room for that, so it stops at the frame's edge.
 */
export function inlineLeft({
  end,
  frameLeft,
  width,
}: {
  end: number;
  frameLeft: number;
  width: number;
}): number {
  return Math.max(end - width, frameLeft);
}

/**
 * Where it starts going down: under the element, or as high as it takes to stay on
 * the frame near the page's foot. All in the canvas's pixels, as its height doesn't
 * zoom with the page. A frame too short for it keeps its top.
 */
export function inlineTop({
  foot,
  frameTop,
  frameFoot,
  height,
}: {
  foot: number;
  frameTop: number;
  frameFoot: number;
  height: number;
}): number {
  return Math.max(Math.min(foot, frameFoot - height), frameTop);
}
