// What the panel's number controls step through (TRU-3.9). Paper's scrub and
// typing write any number; ours stay on the scale, so the designer works in
// numbers and the code gets tokens. Pure, so the unit tests cover it.

/** One value a control may write: a number, and the token that gives it. */
export type Step = { value: number; token: string | null };

/** A press of Shift+arrow, in steps. */
export const FURTHER = 4;

/** How far a scrub travels for one step, in CSS pixels. */
const SCRUB_PX = 6;

/** Half of a hundredth: a computed 12.000001 is 12. */
const SLACK = 0.005;

/** From small to large, one step per value; the first token named keeps it. */
export function scaleOf(steps: readonly Step[]): Step[] {
  const scale: Step[] = [];
  for (const step of [...steps].sort((a, b) => a.value - b.value)) {
    const last = scale.at(-1);
    if (last && Math.abs(last.value - step.value) < SLACK) {
      last.token ??= step.token;
    } else {
      scale.push({ ...step });
    }
  }
  return scale;
}

export function findStep(
  scale: readonly Step[],
  value: number,
): Step | undefined {
  return scale.find((step) => Math.abs(step.value - value) < SLACK);
}

/** The closest step; a tie goes to the smaller. Null on an empty scale. */
export function nearestStep(
  scale: readonly Step[],
  value: number,
): Step | null {
  let nearest: Step | null = null;
  for (const step of scale) {
    if (
      !nearest ||
      Math.abs(step.value - value) < Math.abs(nearest.value - value) - SLACK
    ) {
      nearest = step;
    }
  }
  return nearest;
}

/**
 * `by` steps along the scale, stopping at its ends. A value off the scale
 * counts its neighbour as the first step, so one up from 13 is 16, not 12.
 */
export function stepBy(
  scale: readonly Step[],
  from: number,
  by: number,
): number {
  if (by === 0 || scale.length === 0) return from;
  const at = scale.findIndex((step) => Math.abs(step.value - from) < SLACK);
  let index: number;
  if (at !== -1) {
    index = at + by;
  } else if (by > 0) {
    const above = scale.findIndex((step) => step.value > from);
    index = above === -1 ? scale.length - 1 : above + by - 1;
  } else {
    const below = scale.findLastIndex((step) => step.value < from);
    index = below === -1 ? 0 : below + by + 1;
  }
  const clamped = Math.max(0, Math.min(index, scale.length - 1));
  return scale[clamped]?.value ?? from;
}

/** What a typed number says: `17`, `17px`. Null for anything else. */
export function parseTyped(text: string): number | null {
  const trimmed = text.trim().replace(/px$/i, '').trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export type Typed =
  | { status: 'invalid' }
  | { status: 'exact'; value: number }
  | { status: 'snapped'; value: number };

/** Any number can be typed; what's written is on the scale. */
export function snapTyped(scale: readonly Step[], text: string): Typed {
  const typed = parseTyped(text);
  if (typed === null) return { status: 'invalid' };
  const exact = findStep(scale, typed);
  if (exact) return { status: 'exact', value: exact.value };
  const nearest = nearestStep(scale, typed);
  if (!nearest) return { status: 'invalid' };
  return { status: 'snapped', value: nearest.value };
}

/** How many steps a scrub has travelled; none until it has gone a whole one. */
export function scrubSteps(pixels: number): number {
  return Math.trunc(pixels / SCRUB_PX);
}

/** How many steps there are to go each way from a value, for a scrub. */
export function roomOf(
  scale: readonly Step[],
  from: number,
): { down: number; up: number } {
  return {
    down: scale.filter((step) => step.value < from - SLACK).length,
    up: scale.filter((step) => step.value > from + SLACK).length,
  };
}

/**
 * A scrub's travel, stopped at the scale's ends: coming back from past an end
 * moves the value at once, not after undoing the overshoot.
 */
export function clampScrub(
  pixels: number,
  room: { down: number; up: number },
): number {
  return Math.max(-room.down * SCRUB_PX, Math.min(pixels, room.up * SCRUB_PX));
}

const number = new Intl.NumberFormat('en', {
  maximumFractionDigits: 2,
  useGrouping: false,
});

export function formatValue(value: number): string {
  return number.format(value);
}
