import { type DesignSystem, THEME_OPTION } from './design-system';
import type { Token } from './manifest';

/** Which theme namespaces each utility root reads: `text` reads `--text` and `--color`. */
export type RootNamespaces = ReadonlyMap<string, readonly string[]>;

/**
 * Tailwind inlines shadow values (wrapping their colours in
 * `var(--tw-shadow-color, …)`), so no `var(--shadow-*)` shows which root
 * reads them.
 */
const SHADOW_ROOTS: Readonly<Record<string, string>> = {
  shadow: '--shadow',
  'inset-shadow': '--inset-shadow',
  'drop-shadow': '--drop-shadow',
  'text-shadow': '--text-shadow',
};

/** Whether Tailwind writes the token as `var(--key)` (not inline, not reference). */
function isEmitted(designSystem: DesignSystem, key: string): boolean {
  const options = designSystem.theme.getOptions(key);
  return !(options & (THEME_OPTION.inline | THEME_OPTION.reference));
}

/**
 * Asks the design system which namespaces each functional utility reads:
 * every root is compiled with one emitted token of each namespace, and reads
 * it if the CSS has `var(--namespace-name)`. Derived rather than listed, so
 * a root Tailwind adds (`pbs-*`, `mask-x-from-*`) or a plugin's is never
 * mistaken for off-token. About 120 ms for 344 roots.
 */
export function deriveRootNamespaces(
  designSystem: DesignSystem,
  tokens: Iterable<Token>,
): RootNamespaces {
  const samples = new Map<string, string>();
  for (const token of tokens) {
    if (token.name === null || !isEmitted(designSystem, token.key)) continue;
    if (!samples.has(token.namespace)) samples.set(token.namespace, token.name);
  }

  const table = new Map<string, string[]>();
  for (const root of designSystem.utilities.keys('functional')) {
    const namespaces: string[] = [];
    for (const [namespace, name] of samples) {
      const css = designSystem.candidatesToCss([`${root}-${name}`])[0];
      if (css?.includes(`var(${namespace}-${name})`))
        namespaces.push(namespace);
    }
    const shadow = SHADOW_ROOTS[root];
    if (shadow) namespaces.unshift(shadow);
    if (namespaces.length > 0) table.set(root, namespaces);
  }
  return table;
}

/**
 * What a class means in token terms:
 * - `token`: it reads a theme token (ours, an alias, a library's or a Tailwind default: check `token.origin`);
 * - `compiles`: it generates CSS but reads no token (`px-401` through the
 *   spacing multiplier, `w-100/2` as a fraction, `bg-[#1c68d4]`, `flex`);
 * - `unknown`: it generates no CSS.
 */
export type ClassLookup =
  | {
      status: 'token';
      className: string;
      token: Token;
      /** Tailwind's utility root, the sign included (`px`, `-mt`). */
      root: string;
      /** A colour's `/50` as 0.5. */
      opacity?: number;
      /** Any other modifier, as written (`text-sm/6`). */
      modifier?: string;
      negative: boolean;
      variants: string[];
    }
  | {
      status: 'compiles';
      className: string;
      reason: 'arbitrary' | 'bare-value' | 'static' | 'unmapped';
    }
  | { status: 'unknown'; className: string };

/** The class's CSS, or null if it generates none. */
function cssOf(designSystem: DesignSystem, className: string): string | null {
  return designSystem.candidatesToCss([className])[0] ?? null;
}

export function isRegistered(
  designSystem: DesignSystem,
  className: string,
): boolean {
  // getClassList() is the editor's suggestion list, not a registry:
  // `px-401` and `bg-[#123]` compile without being in it.
  return cssOf(designSystem, className) !== null;
}

function opacityOf(modifier: { kind: string; value: string }): number | null {
  const text = modifier.value.trim();
  const percent = /^(\d*\.?\d+)%$/.exec(text);
  if (percent) return Number(percent[1]) / 100;
  if (!/^\d*\.?\d+$/.test(text)) return null;
  const n = Number(text);
  // `/50` is a percentage, `/[0.5]` a fraction.
  return modifier.kind === 'named' || n > 1 ? n / 100 : n;
}

export function tokenForClass(
  designSystem: DesignSystem,
  tokens: ReadonlyMap<string, Token>,
  roots: RootNamespaces,
  className: string,
): ClassLookup {
  const css = cssOf(designSystem, className);
  if (css === null) {
    return { status: 'unknown', className };
  }

  const candidate = designSystem.parseCandidate(className)[0];
  if (!candidate || candidate.kind === 'arbitrary') {
    return { status: 'compiles', className, reason: 'arbitrary' };
  }
  if (candidate.kind === 'static') {
    return { status: 'compiles', className, reason: 'static' };
  }
  if (candidate.value?.kind === 'arbitrary') {
    return { status: 'compiles', className, reason: 'arbitrary' };
  }

  const namespaces = roots.get(candidate.root);
  if (!namespaces || !candidate.value) {
    return { status: 'compiles', className, reason: 'unmapped' };
  }

  const value = candidate.value.value;
  for (const namespace of namespaces) {
    const token = tokens.get(`${namespace}-${value}`);
    if (!token) continue;

    // `w-100/2` parses as value 100 with modifier 2, but Tailwind reads it as
    // the fraction 100/2 (`calc(100 / 2 * 100%)`): an emitted token that
    // isn't in the CSS was not used.
    if (
      candidate.value.fraction &&
      isEmitted(designSystem, token.key) &&
      !css.includes(`var(${token.key})`)
    ) {
      return { status: 'compiles', className, reason: 'bare-value' };
    }

    const result: ClassLookup = {
      status: 'token',
      className,
      token,
      root: candidate.root,
      negative: candidate.root.startsWith('-'),
      // Tailwind keeps them innermost first; these read as written.
      variants: candidate.variants
        .map((v) => designSystem.printVariant(v))
        .reverse(),
    };
    if (candidate.modifier) {
      const opacity =
        token.category === 'color' ? opacityOf(candidate.modifier) : null;
      if (opacity !== null) result.opacity = opacity;
      else result.modifier = candidate.modifier.value;
    }
    return result;
  }

  return { status: 'compiles', className, reason: 'bare-value' };
}
