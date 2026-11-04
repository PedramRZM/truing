// What the token menu lists (TRU-3.9): the manifest's tokens as a designer reads
// them, the order they show in and the ones nearest a value off the scale.
// Pure, so the unit tests cover it.
import type { Token, TokenCategory } from '../../tokens/manifest';

import { scaleOf, type Step } from './scale';

export type TokenRow = {
  /** The CSS variable: `--color-primary`. */
  key: string;
  /** What a designer reads: `primary`, `400`. */
  name: string;
  /** Its value in words: `#1c68d4`, `12`. */
  value: string;
  kind: TokenCategory;
  /** A colour's sRGB hex, for its swatch. */
  hex: string | null;
  /** A length's pixels. */
  px: number | null;
  /** The family it steps through: `red` for `red-500`; null for a semantic token. */
  family: string | null;
};

/** `red-500` and `brand-1-600` belong to a family; `primary` and `card-foreground` don't. */
const FAMILY = /^(.+)-(\d+)$/;

/**
 * A namespace's tokens, in the given mode: the project's own, or Tailwind's
 * where the project has none (`--font-weight`). Semantic tokens first, then
 * families in the order the theme names them; lengths by size.
 */
export function tokenRows(
  tokens: readonly Token[],
  namespace: string,
  dark = false,
): TokenRow[] {
  const all = tokens.filter(
    (token) => token.namespace === namespace && token.name !== null,
  );
  const ours = all.filter(
    (token) => token.origin === 'ours' || token.origin === 'alias',
  );
  const rows = (ours.length > 0 ? ours : all).map((token): TokenRow => {
    const resolved = dark ? token.dark : token.light;
    const name = token.name ?? '';
    return {
      key: token.key,
      name,
      value:
        resolved.hex ??
        (resolved.px === undefined ? resolved.value : String(resolved.px)),
      kind: token.category,
      hex: resolved.hex ?? null,
      px: resolved.px ?? null,
      family: FAMILY.exec(name)?.[1] ?? null,
    };
  });
  if (rows.every((row) => row.px !== null)) {
    return rows.sort((a, b) => (a.px ?? 0) - (b.px ?? 0));
  }
  return [
    ...rows.filter((row) => row.family === null),
    ...rows.filter((row) => row.family !== null),
  ];
}

/** The scale a field steps through: its tokens' lengths, with 0, which needs none. */
export function stepsOf(rows: readonly TokenRow[]): Step[] {
  return scaleOf([
    { value: 0, token: null },
    ...rows.flatMap((row) =>
      row.px === null ? [] : [{ value: row.px, token: row.name }],
    ),
  ]);
}

/** By name or value, whichever the designer remembers. */
export function filterRows(
  rows: readonly TokenRow[],
  query: string,
): readonly TokenRow[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return rows;
  return rows.filter((row) =>
    `${row.name} ${row.value}`.toLowerCase().includes(wanted),
  );
}

type Lab = readonly [number, number, number];

const fromSrgb = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Björn Ottosson's sRGB to Oklab, so "nearest" is what an eye would say. */
function oklabOf(colour: string): Lab | null {
  // What a browser may report, or a token declare. Anything else has no nearest.
  const lab = /^ok(lab|lch)\(\s*([\d.]+)(%?)\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(
    colour,
  );
  if (lab) {
    const lightness = Number(lab[2]) / (lab[3] ? 100 : 1);
    const second = Number(lab[4]);
    const third = Number(lab[5]);
    if (lab[1] === 'lab') return [lightness, second, third];
    const hue = (third * Math.PI) / 180;
    return [lightness, second * Math.cos(hue), second * Math.sin(hue)];
  }
  const short = /^#([\da-f])([\da-f])([\da-f])[\da-f]?$/i.exec(colour);
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(colour);
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(colour);
  const parts = short
    ? short.slice(1, 4).map((part) => Number.parseInt(part + part, 16))
    : hex
      ? hex.slice(1, 4).map((part) => Number.parseInt(part, 16))
      : rgb?.slice(1, 4).map(Number);
  if (!parts) return null;
  const [r = 0, g = 0, b = 0] = parts.map(fromSrgb);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** The tokens closest to a length (a number) or a colour (`#…`, `rgb(…)`). */
export function nearestRows(
  rows: readonly TokenRow[],
  near: number | string,
  count = 3,
): TokenRow[] {
  const target = typeof near === 'string' ? oklabOf(near) : null;
  const distance = (row: TokenRow): number | null => {
    if (typeof near === 'number') {
      return row.px === null ? null : Math.abs(row.px - near);
    }
    const lab = row.hex ? oklabOf(row.hex) : null;
    if (!target || !lab) return null;
    return Math.hypot(
      lab[0] - target[0],
      lab[1] - target[1],
      lab[2] - target[2],
    );
  };
  return rows
    .flatMap((row) => {
      const away = distance(row);
      return away === null ? [] : [{ row, away }];
    })
    .sort((a, b) => a.away - b.away)
    .slice(0, count)
    .map(({ row }) => row);
}

export type RowGroup = { title: string; rows: readonly TokenRow[] };

/** `brand-1` reads Brand 1. */
const familyName = (family: string): string => {
  const words = family.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Nearest first when given, then semantic tokens, then each family. A scale of lengths has no semantic tokens: it's just Tokens. */
export function groupRows(
  rows: readonly TokenRow[],
  nearest: readonly TokenRow[] = [],
): RowGroup[] {
  const shown = new Set(nearest.map((row) => row.key));
  const groups = new Map<string, TokenRow[]>();
  for (const row of rows) {
    if (shown.has(row.key)) continue;
    const title =
      row.family !== null
        ? familyName(row.family)
        : row.kind === 'color'
          ? 'Semantic'
          : 'Tokens';
    const group = groups.get(title);
    if (group) group.push(row);
    else groups.set(title, [row]);
  }
  return [
    ...(nearest.length > 0 ? [{ title: 'Nearest', rows: nearest }] : []),
    ...[...groups].map(([title, grouped]) => ({ title, rows: grouped })),
  ];
}
