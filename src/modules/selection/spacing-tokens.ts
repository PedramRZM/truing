// Which spacing class set a label's value (TRU-2.5), so the label can name the
// token: `px-400 · 12`. The server keeps an element's classes that read a
// spacing token with a length; the overlay asks, for each band, which of them
// sets that side to that value. Pure, and imported by both, so it imports
// nothing but types.
import type { Side } from './measure';

/** A class that reads a spacing token, as the server sends it to the frame. */
export type SpacingClass = {
  /** As written, variants included (`md:px-400`). */
  className: string;
  /** Tailwind's utility root (`px`). */
  root: string;
  /** The token's value in pixels. */
  px: number;
};

/** What a label measures: a padding or margin side, or the gaps between children. */
export type SpacingTarget =
  | { kind: 'padding' | 'margin'; side: Side }
  | { kind: 'gap'; axis: 'horizontal' | 'vertical' };

/**
 * What a root sets, written short because the table ships in every frame:
 * `[rank, letters]`. The rank says which wins, higher first (`pt` over `py`
 * over `p`, as in Tailwind's own order). The letters are the sides it sets
 * (`t`op, `r`ight, `b`ottom, `l`eft, or `s`tart and `e`nd, which follow the
 * element's direction) or the gaps (`h`orizontal, `v`ertical).
 */
type Reach = readonly [rank: number, letters: string];

/** The box roots, by what follows the `p` or `m`. */
const BOX_REACH: Readonly<Record<string, Reach>> = {
  '': [0, 'trbl'],
  x: [1, 'lr'],
  y: [1, 'tb'],
  t: [2, 't'],
  r: [2, 'r'],
  b: [2, 'b'],
  l: [2, 'l'],
  bs: [2, 't'],
  be: [2, 'b'],
  s: [2, 's'],
  e: [2, 'e'],
};

const GAP_REACH: Readonly<Record<string, Reach>> = {
  gap: [0, 'hv'],
  'gap-x': [1, 'h'],
  'gap-y': [1, 'v'],
  // Margins on the children; the gap between them is what they make.
  'space-x': [1, 'h'],
  'space-y': [1, 'v'],
};

function reachOf(
  root: string,
): { kind: SpacingTarget['kind']; reach: Reach } | null {
  const gap = GAP_REACH[root];
  if (gap) return { kind: 'gap', reach: gap };
  const kind = root[0] === 'p' ? 'padding' : root[0] === 'm' ? 'margin' : null;
  const box = kind ? BOX_REACH[root.slice(1)] : undefined;
  return kind && box ? { kind, reach: box } : null;
}

/** Whether a utility root sets spacing a label can show: the server keeps only these. */
export function isSpacingRoot(root: string): boolean {
  return reachOf(root) !== null;
}

/** Half a pixel either way is rounding. */
const SLACK = 0.5;

/**
 * The class that set a label's value: the most specific one that reaches
 * that side and whose token equals the value; the later one on a tie. Null
 * when none does, and the label shows bare pixels.
 */
export function tokenFor(
  target: SpacingTarget,
  px: number,
  classes: readonly SpacingClass[],
  rtl = false,
): string | null {
  // The target's letter; a logical side's letter, by the direction.
  const letter = target.kind === 'gap' ? target.axis[0] : target.side[0];
  const start = rtl ? 'r' : 'l';
  const end = rtl ? 'l' : 'r';
  let best: { className: string; rank: number } | null = null;
  for (const spacing of classes) {
    const found = reachOf(spacing.root);
    if (found?.kind !== target.kind) continue;
    const [rank, letters] = found.reach;
    const reaches = [...letters].some(
      (c) => (c === 's' ? start : c === 'e' ? end : c) === letter,
    );
    if (!reaches || Math.abs(spacing.px - px) > SLACK) continue;
    if (!best || rank >= best.rank) {
      best = { className: spacing.className, rank };
    }
  }
  return best?.className ?? null;
}

/** A label as the overlay writes it: the token's class, then the pixels. */
export function spacingLabel(px: string, className: string | null): string {
  return className ? `${className} · ${px}` : px;
}
