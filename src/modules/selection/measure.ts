// The spacing overlays' geometry (TRU-2.3), in the frame's own CSS pixels: the
// picked element's padding and margin bands, and the distances Alt-hover
// draws to another element. Pure, so it is tested without a page; overlay.ts
// reads the boxes and draws what this returns.

export type Box = { left: number; top: number; width: number; height: number };
export type Point = { x: number; y: number };

export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];
export type Sides = Record<Side, number>;

/** What the page says about one element's box. */
export type Spacing = {
  /** Its border box. */
  border: Box;
  margin: Sides;
  /** The sides whose margin is `auto`, which the label says instead of a number. */
  autoMargin: Record<Side, boolean>;
  borderWidth: Sides;
  padding: Sides;
};

export type Band = {
  kind: 'margin' | 'padding';
  side: Side;
  box: Box;
  label: string;
};

/** A length as the labels write it: whole pixels, or one decimal when it has one. */
export function formatPx(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
}

/** A box's size, as the hover and pick labels write it: `120×36`. */
export function formatSize(box: Pick<Box, 'width' | 'height'>): string {
  return `${Math.round(box.width)}×${Math.round(box.height)}`;
}

/**
 * The bands to hatch: margin outside the border box, padding inside the
 * border, one per side that has any. Corners are left out so no two bands
 * overlap, and a negative margin, which pulls rather than spaces, isn't drawn.
 */
export function spacingBands(spacing: Spacing): Band[] {
  const { border: b, margin: m, padding: p, borderWidth: w } = spacing;
  const right = b.left + b.width;
  const bottom = b.top + b.height;
  const marginLabel = (side: Side): string =>
    spacing.autoMargin[side] ? 'auto' : formatPx(m[side]);

  const inner: Box = {
    left: b.left + w.left,
    top: b.top + w.top,
    width: Math.max(0, b.width - w.left - w.right),
    height: Math.max(0, b.height - w.top - w.bottom),
  };
  const innerRight = inner.left + inner.width;
  const innerBottom = inner.top + inner.height;
  const middle = Math.max(0, inner.height - p.top - p.bottom);

  const bands: Band[] = [
    {
      kind: 'margin',
      side: 'top',
      box: { left: b.left, top: b.top - m.top, width: b.width, height: m.top },
      label: marginLabel('top'),
    },
    {
      kind: 'margin',
      side: 'right',
      box: { left: right, top: b.top, width: m.right, height: b.height },
      label: marginLabel('right'),
    },
    {
      kind: 'margin',
      side: 'bottom',
      box: { left: b.left, top: bottom, width: b.width, height: m.bottom },
      label: marginLabel('bottom'),
    },
    {
      kind: 'margin',
      side: 'left',
      box: {
        left: b.left - m.left,
        top: b.top,
        width: m.left,
        height: b.height,
      },
      label: marginLabel('left'),
    },
    {
      kind: 'padding',
      side: 'top',
      box: {
        left: inner.left,
        top: inner.top,
        width: inner.width,
        height: p.top,
      },
      label: formatPx(p.top),
    },
    {
      kind: 'padding',
      side: 'right',
      box: {
        left: innerRight - p.right,
        top: inner.top + p.top,
        width: p.right,
        height: middle,
      },
      label: formatPx(p.right),
    },
    {
      kind: 'padding',
      side: 'bottom',
      box: {
        left: inner.left,
        top: innerBottom - p.bottom,
        width: inner.width,
        height: p.bottom,
      },
      label: formatPx(p.bottom),
    },
    {
      kind: 'padding',
      side: 'left',
      box: {
        left: inner.left,
        top: inner.top + p.top,
        width: p.left,
        height: middle,
      },
      label: formatPx(p.left),
    },
  ];
  return bands.filter((band) => band.box.width > 0 && band.box.height > 0);
}

export type Measure = {
  axis: 'horizontal' | 'vertical';
  from: Point;
  to: Point;
  label: string;
};

/** Half a pixel either way still counts as inside: rounding, not layout. */
const SLACK = 0.5;

export function contains(outer: Box, inner: Box): boolean {
  return (
    inner.left >= outer.left - SLACK &&
    inner.top >= outer.top - SLACK &&
    inner.left + inner.width <= outer.left + outer.width + SLACK &&
    inner.top + inner.height <= outer.top + outer.height + SLACK
  );
}

function line(
  axis: Measure['axis'],
  start: number,
  end: number,
  across: number,
): Measure | null {
  const length = end - start;
  if (length <= SLACK) return null;
  return axis === 'horizontal'
    ? {
        axis,
        from: { x: start, y: across },
        to: { x: end, y: across },
        label: formatPx(length),
      }
    : {
        axis,
        from: { x: across, y: start },
        to: { x: across, y: end },
        label: formatPx(length),
      };
}

/** The middle of where two spans overlap, or the first span's middle when they don't. */
function acrossOf(
  aStart: number,
  aSize: number,
  bStart: number,
  bSize: number,
): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aStart + aSize, bStart + bSize);
  return end > start ? (start + end) / 2 : aStart + aSize / 2;
}

/**
 * What Alt-hover draws from the pick to another box: when one contains the
 * other, the four insets from the inner box to the outer; otherwise the gap
 * on each axis where there is one. Boxes that overlap on an axis have no
 * distance on it, so nothing is drawn there rather than a zero.
 */
export function measureBetween(picked: Box, other: Box): Measure[] {
  const outer = contains(picked, other)
    ? picked
    : contains(other, picked)
      ? other
      : null;

  if (outer) {
    const inner = outer === picked ? other : picked;
    const middleX = inner.left + inner.width / 2;
    const middleY = inner.top + inner.height / 2;
    return [
      line('vertical', outer.top, inner.top, middleX),
      line(
        'horizontal',
        inner.left + inner.width,
        outer.left + outer.width,
        middleY,
      ),
      line(
        'vertical',
        inner.top + inner.height,
        outer.top + outer.height,
        middleX,
      ),
      line('horizontal', outer.left, inner.left, middleY),
    ].filter((measure): measure is Measure => measure !== null);
  }

  const across = {
    horizontal: acrossOf(picked.top, picked.height, other.top, other.height),
    vertical: acrossOf(picked.left, picked.width, other.left, other.width),
  };
  const pickedRight = picked.left + picked.width;
  const otherRight = other.left + other.width;
  const pickedBottom = picked.top + picked.height;
  const otherBottom = other.top + other.height;

  const horizontal =
    other.left >= pickedRight
      ? line('horizontal', pickedRight, other.left, across.horizontal)
      : picked.left >= otherRight
        ? line('horizontal', otherRight, picked.left, across.horizontal)
        : null;
  const vertical =
    other.top >= pickedBottom
      ? line('vertical', pickedBottom, other.top, across.vertical)
      : picked.top >= otherBottom
        ? line('vertical', otherBottom, picked.top, across.vertical)
        : null;
  return [horizontal, vertical].filter(
    (measure): measure is Measure => measure !== null,
  );
}

export type GapBand = {
  /** `horizontal` between children side by side, `vertical` between stacked ones. */
  axis: Measure['axis'];
  box: Box;
  /** The distance between the two children's border boxes. */
  px: number;
};

/** A list with more children than this is a list: its first gaps say as much as all of them. */
export const MAX_GAPS = 64;

/** Two boxes are side by side when they share more than half the shorter one's height. */
function sideBySide(a: Box, b: Box): boolean {
  const overlap =
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return overlap > Math.min(a.height, b.height) * 0.5;
}

/**
 * The space between each pair of adjacent children (TRU-2.5), measured between
 * their border boxes rather than read off `gap`, so a grid's gaps, margins
 * between blocks and `space-between` all count. Each band runs across both
 * children on the other axis. Children that touch or overlap have no gap.
 */
export function gapBands(children: readonly Box[]): GapBand[] {
  const bands: GapBand[] = [];
  for (let index = 1; index < children.length; index += 1) {
    if (bands.length >= MAX_GAPS) break;
    const a = children[index - 1];
    const b = children[index];
    if (!a || !b) continue;
    const band = sideBySide(a, b) ? between(a, b, 'x') : between(a, b, 'y');
    if (band) bands.push(band);
  }
  return bands;
}

/** The band between two boxes along one axis, whichever comes first, or null when they touch. */
function between(a: Box, b: Box, along: 'x' | 'y'): GapBand | null {
  const [start, size, crossStart, crossSize] =
    along === 'x'
      ? (['left', 'width', 'top', 'height'] as const)
      : (['top', 'height', 'left', 'width'] as const);
  const [first, second] = a[start] <= b[start] ? [a, b] : [b, a];
  const from = first[start] + first[size];
  const px = second[start] - from;
  if (px <= SLACK) return null;
  const crossFrom = Math.min(a[crossStart], b[crossStart]);
  const crossTo = Math.max(
    a[crossStart] + a[crossSize],
    b[crossStart] + b[crossSize],
  );
  const box: Box =
    along === 'x'
      ? { left: from, top: crossFrom, width: px, height: crossTo - crossFrom }
      : { left: crossFrom, top: from, width: crossTo - crossFrom, height: px };
  return { axis: along === 'x' ? 'horizontal' : 'vertical', box, px };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left) >
      SLACK &&
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top) >
      SLACK
  );
}

/**
 * The first of a label's candidate places that is inside the bounds and
 * covers nothing already drawn (TRU-2.5), or the first place when none is free.
 * The hover and pick labels move to stay off the spacing chips, which stay
 * on their bands.
 */
export function firstFree(
  candidates: readonly Box[],
  taken: readonly Box[],
  /** None for labels the frame's edge brings back inside afterwards. */
  bounds?: { width: number; height: number },
): number {
  const index = candidates.findIndex(
    (box) =>
      (!bounds ||
        (box.left >= -SLACK &&
          box.top >= -SLACK &&
          box.left + box.width <= bounds.width + SLACK &&
          box.top + box.height <= bounds.height + SLACK)) &&
      !taken.some((other) => overlaps(box, other)),
  );
  return Math.max(0, index);
}

/**
 * Where a label may go, nearest the element first, in screen-independent frame
 * pixels. Outside it while there's room, so the element stays in full view: above,
 * then below (a nav bar at the page's top has no room above). Inside its edges only
 * when it fills the frame, then further out, for chips in a thin band.
 */
export function labelTops(
  rect: { top: number; bottom: number },
  label: { height: number; gap: number; inset: number },
  frameHeight: number,
): number[] {
  const { height, gap, inset } = label;
  const above = rect.top - height - gap;
  const below = rect.bottom + gap;
  const step = height + gap;
  const outside = [above, below].filter(
    (top) => top >= 0 && top + height <= frameHeight,
  );
  return [
    ...outside,
    Math.max(0, rect.top) + inset,
    rect.bottom - height - inset,
    ...[1, 2, 3].flatMap((k) => [above - k * step, below + k * step]),
  ];
}

/** Which way each side's label slides when it must: away from the box. */
export const OUTWARD: Readonly<Record<string, Point>> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/**
 * Spreads the padding and margin labels apart (TRU-2.5). Each stays centred on
 * its band while that's free; one that would cover a label already placed
 * slides outward from its side (`way`), a step at a time, until it is clear:
 * the top one up, the left one left. The fixed labels (gaps, distances)
 * never move. Returns how far each moves, in order; one that finds no free
 * place stays.
 */
export function spreadOutward(
  labels: ReadonlyArray<{ box: Box; way: Point }>,
  fixed: readonly Box[],
  step: number,
  maxSteps = 60,
): Point[] {
  const placed = [...fixed];
  return labels.map(({ box, way }) => {
    const moves = Array.from({ length: maxSteps + 1 }, (_, k) => ({
      // `+ 0` turns the -0 of a zero step into 0.
      x: way.x * k * step + 0,
      y: way.y * k * step + 0,
    }));
    const boxes = moves.map((move) => ({
      left: box.left + move.x,
      top: box.top + move.y,
      width: box.width,
      height: box.height,
    }));
    const index = firstFree(boxes, placed);
    placed.push(boxes[index] ?? box);
    return moves[index] ?? { x: 0, y: 0 };
  });
}
