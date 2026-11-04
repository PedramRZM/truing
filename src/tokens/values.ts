import Color from 'colorjs.io';

/**
 * A value in one mode, resolved through its `var()` references, with the
 * normalised forms the inspector and the lints compare on.
 */
export interface ResolvedValue {
  /** The value with every resolvable `var()` substituted. */
  value: string;
  /** sRGB hex (#rrggbb or #rrggbbaa), gamut-mapped; colours only. */
  hex?: string;
  /** CSS `oklab()`; colours only. */
  oklab?: string;
  /** Pixels, at a 16 px root; lengths only. */
  px?: number;
}

/** CSS variables by name, as one mode sees them. */
export type Scope = ReadonlyMap<string, string>;

const ROOT_FONT_PX = 16;

/** The index of the parenthesis closing the one opened at `open`. */
function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

/** Splits `--x, fallback` at its first top-level comma. */
function splitVarArgs(args: string): [string, string | null] {
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '(') depth++;
    if (args[i] === ')') depth--;
    if (args[i] === ',' && depth === 0) {
      return [args.slice(0, i).trim(), args.slice(i + 1).trim()];
    }
  }
  return [args.trim(), null];
}

/** `var(--x)` or `--theme(--x)`, Tailwind's own spelling in its defaults. */
const REFERENCE = /(?:\bvar|--theme)\(/g;
const SEPARATOR = /[\s(),]/;

/**
 * Substitutes every `var(--x, fallback)` in `value` from `scope`. A variable
 * the scope lacks keeps its fallback, or stays as written when it has none
 * (`var(--font-inter)` comes from next/font at run time).
 */
export function substitute(
  value: string,
  scope: Scope,
  seen: ReadonlySet<string> = new Set(),
): string {
  let out = '';
  let last = 0;

  for (const match of value.matchAll(REFERENCE)) {
    const start = match.index;
    if (start < last) continue;
    const open = start + match[0].length - 1;
    const close = closingParen(value, open);
    if (close === -1) break;

    const [name, fallback] = splitVarArgs(value.slice(open + 1, close));
    const found = scope.get(name);
    let replacement: string;
    if (found !== undefined && !seen.has(name)) {
      replacement = substitute(found, scope, new Set([...seen, name]));
    } else if (fallback !== null) {
      replacement = substitute(fallback, scope, seen);
    } else {
      replacement = value.slice(start, close + 1);
    }

    // `var(--a)var(--b)` is two tokens; substituted, it must stay two.
    const before = value[start - 1];
    const after = value[close + 1];
    if (before !== undefined && !SEPARATOR.test(before)) {
      replacement = ` ${replacement}`;
    }
    if (after !== undefined && !SEPARATOR.test(after)) {
      replacement = `${replacement} `;
    }

    out += value.slice(last, start) + replacement;
    last = close + 1;
  }

  return out + value.slice(last);
}

const WHOLE_VAR = /^var\(\s*(--[\w-]+)\s*(?:,[\s\S]*)?\)$/;

/**
 * The variables a value passes through while it is a bare `var()`: for
 * `var(--primary)` that is `--primary`, then `--color-brand-1-600`.
 */
export function chainOf(value: string, scope: Scope): string[] {
  const chain: string[] = [];
  let current = value.trim();

  for (;;) {
    const name = WHOLE_VAR.exec(current)?.[1];
    if (!name || chain.includes(name)) return chain;
    const next = scope.get(name);
    if (next === undefined) return chain;
    chain.push(name);
    current = next.trim();
  }
}

type Operand = { n: number; px: boolean };

/**
 * Evaluates a length (`12px`, `0.75rem`, `calc(0.75rem - 4px)`) in pixels.
 * Unitless numbers are allowed in products and quotients, and as the whole
 * value when `unitless` gives their scale (a line height's font size).
 * Anything else, `var()` or `em` included, gives null.
 */
export function toPx(value: string, unitless?: number): number | null {
  const tokens: readonly string[] =
    value
      .replace(/calc\(/g, '(')
      .match(/-?\d*\.?\d+(?:e-?\d+)?(?:px|rem)?|[-+*/()]|\S+/g) ?? [];
  if (tokens.length === 0) return null;

  let i = 0;
  const peek = (): string | undefined => tokens[i];

  function primary(): Operand | null {
    const token = tokens[i++];
    if (token === undefined) return null;
    if (token === '(') {
      const inner = sum();
      if (tokens[i++] !== ')') return null;
      return inner;
    }
    const number = /^(-?\d*\.?\d+(?:e-?\d+)?)(px|rem)?$/.exec(token);
    if (!number) return null;
    const n = Number(number[1]);
    if (number[2] === 'rem') return { n: n * ROOT_FONT_PX, px: true };
    return { n, px: number[2] === 'px' };
  }

  function product(): Operand | null {
    let left = primary();
    while (left && (peek() === '*' || peek() === '/')) {
      const op = tokens[i++];
      const right = primary();
      if (!right) return null;
      if (op === '*') {
        if (left.px && right.px) return null;
        left = { n: left.n * right.n, px: left.px || right.px };
      } else {
        if (right.px || right.n === 0) return null;
        left = { n: left.n / right.n, px: left.px };
      }
    }
    return left;
  }

  function sum(): Operand | null {
    let left = product();
    while (left && (peek() === '+' || peek() === '-')) {
      const op = tokens[i++];
      const right = product();
      if (!right || right.px !== left.px) return null;
      left = {
        n: op === '+' ? left.n + right.n : left.n - right.n,
        px: left.px,
      };
    }
    return left;
  }

  const result = sum();
  if (!result || i !== tokens.length) return null;
  if (result.px) return Math.round(result.n * 1000) / 1000;
  if (unitless === undefined) return null;
  return Math.round(result.n * unitless * 1000) / 1000;
}

/** The hex and oklab forms of a colour, or null if `value` isn't one. */
export function toColor(value: string): { hex: string; oklab: string } | null {
  if (value.includes('var(')) return null;
  try {
    const color = new Color(value);
    const hex = color
      .to('srgb')
      .toGamut({ space: 'srgb' })
      .toString({ format: 'hex', collapse: false });
    return { hex, oklab: color.to('oklab').toString({ precision: 4 }) };
  } catch {
    return null;
  }
}

/** Substitutes `value` in `scope` and adds the normalised forms that apply. */
export function resolveValue(
  value: string,
  scope: Scope,
  kind: { color?: boolean; length?: boolean; unitless?: number },
): ResolvedValue {
  const resolved = substitute(value, scope).trim();
  const out: ResolvedValue = { value: resolved };

  if (kind.color) {
    const color = toColor(resolved);
    if (color) Object.assign(out, color);
  }
  if (kind.length) {
    const px = toPx(resolved, kind.unitless);
    if (px !== null) out.px = px;
  }
  return out;
}
