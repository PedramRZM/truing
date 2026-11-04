import path from 'node:path';

import postcss from 'postcss';

import { type DesignSystem, THEME_OPTION } from './design-system';
import {
  chainOf,
  type ResolvedValue,
  resolveValue,
  type Scope,
} from './values';

export const TOKEN_CATEGORIES = [
  'color',
  'spacing',
  'radius',
  'text',
  'shadow',
  'font',
  'container',
  'animation',
  'other',
] as const;
export type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

/**
 * Where a token comes from:
 * - `ours`: our stylesheet's `@theme`;
 * - `alias`: our `@theme inline` (`--color-primary: var(--primary)`);
 * - `default`: Tailwind's default theme (`bg-red-50`, `p-3`);
 * - `library`: another imported stylesheet's theme (tw-animate-css).
 */
export const TOKEN_ORIGINS = ['ours', 'alias', 'default', 'library'] as const;
export type TokenOrigin = (typeof TOKEN_ORIGINS)[number];

/** A file relative to the project root, and a one-based line. */
export interface SourceRef {
  file: string;
  line: number;
}

export interface Token {
  /** The CSS variable: `--color-primary`. */
  key: string;
  /** Its theme namespace: `--color`. */
  namespace: string;
  /** What a class writes after the utility: `primary` in `bg-primary`. Null for a namespace's own base (`--spacing`). */
  name: string | null;
  category: TokenCategory;
  origin: TokenOrigin;
  /** The declaration Tailwind uses: the last one, when a key is declared twice. */
  source: SourceRef | null;
  /** The effective value as declared. */
  value: string;
  light: ResolvedValue;
  dark: ResolvedValue;
  /** The variables the value passes through in each mode: `--primary`, `--color-brand-1-600`. */
  chain: { light: string[]; dark: string[] };
  /** One of ours (or an alias) that replaces a Tailwind default of the same key. */
  replacesDefault: boolean;
  /** For a text style: its `--x--line-height` and `--x--font-weight`. */
  textStyle?: {
    lineHeight?: ResolvedValue & { source: SourceRef | null };
    fontWeight?: ResolvedValue & { source: SourceRef | null };
  };
}

/** A plain CSS variable from `:root` or `.dark` (shadcn's `--primary`). */
export interface Variable {
  key: string;
  light: (ResolvedValue & { source: SourceRef }) | null;
  dark: (ResolvedValue & { source: SourceRef }) | null;
}

/** A key our stylesheet declares more than once; the last declaration wins. */
export interface ShadowedDeclaration {
  key: string;
  declarations: (SourceRef & {
    value: string;
    block: 'theme' | 'theme inline';
  })[];
}

export interface Manifest {
  /** The token stylesheet, relative to the project root. */
  stylesheet: string;
  tailwindcss: string;
  tokens: Token[];
  variables: Variable[];
  shadowed: ShadowedDeclaration[];
}

/** Longest prefix first, so `--text-shadow` isn't read as a text style. */
const NAMESPACES: readonly (readonly [string, TokenCategory])[] = [
  ['--color', 'color'],
  ['--spacing', 'spacing'],
  ['--radius', 'radius'],
  ['--text-shadow', 'shadow'],
  ['--inset-shadow', 'shadow'],
  ['--drop-shadow', 'shadow'],
  ['--shadow', 'shadow'],
  ['--text', 'text'],
  ['--font-weight', 'other'],
  ['--font', 'font'],
  ['--container', 'container'],
  ['--animate', 'animation'],
  ['--breakpoint', 'other'],
  ['--tracking', 'other'],
  ['--leading', 'other'],
  ['--ease', 'other'],
  ['--blur', 'other'],
  ['--perspective', 'other'],
  ['--aspect', 'other'],
  ['--animation-delay', 'other'],
  ['--animation-repeat', 'other'],
  ['--animation-direction', 'other'],
  ['--animation-fill-mode', 'other'],
  ['--percentage', 'other'],
];

export function namespaceOf(key: string): {
  namespace: string;
  name: string | null;
  category: TokenCategory;
} {
  for (const [namespace, category] of NAMESPACES) {
    if (key === namespace) return { namespace, name: null, category };
    if (key.startsWith(`${namespace}-`)) {
      return { namespace, name: key.slice(namespace.length + 1), category };
    }
  }
  return { namespace: key, name: null, category: 'other' };
}

const LENGTH_CATEGORIES: ReadonlySet<TokenCategory> = new Set([
  'spacing',
  'radius',
  'text',
  'container',
]);

interface StylesheetFacts {
  theme: Map<string, (SourceRef & { value: string; inline: boolean })[]>;
  root: Map<string, SourceRef & { value: string }>;
  dark: Map<string, SourceRef & { value: string }>;
}

/** One PostCSS pass: every `@theme` declaration, and the `:root` and `.dark` variables. */
function readStylesheet(css: string, file: string): StylesheetFacts {
  const facts: StylesheetFacts = {
    theme: new Map(),
    root: new Map(),
    dark: new Map(),
  };
  const ast = postcss.parse(css, { from: file });

  ast.walkAtRules('theme', (rule) => {
    const inline = rule.params.split(/\s+/).includes('inline');
    rule.walkDecls(/^--/, (decl) => {
      const list = facts.theme.get(decl.prop) ?? [];
      list.push({
        file,
        line: decl.source?.start?.line ?? 0,
        value: decl.value,
        inline,
      });
      facts.theme.set(decl.prop, list);
    });
  });

  ast.walkRules((rule) => {
    const selectors = rule.selectors.map((s) => s.trim());
    const target = selectors.includes(':root')
      ? facts.root
      : selectors.includes('.dark')
        ? facts.dark
        : null;
    if (!target) return;
    rule.each((node) => {
      if (node.type !== 'decl' || !node.prop.startsWith('--')) return;
      target.set(node.prop, {
        file,
        line: node.source?.start?.line ?? 0,
        value: node.value,
      });
    });
  });

  return facts;
}

type ThemeEntry =
  ReturnType<DesignSystem['theme']['entries']> extends Iterable<infer T>
    ? T
    : never;

function sourceOf(src: ThemeEntry[1]['src'], root: string): SourceRef | null {
  if (!src) return null;
  const [source, start] = src;
  if (!source.file) return null;
  let line = 1;
  for (let i = 0; i < start; i++) {
    if (source.code.charCodeAt(i) === 10) line++;
  }
  return { file: path.relative(root, source.file), line };
}

export interface BuildManifestInput {
  /** The project root; source files are given relative to it. */
  root: string;
  /** The token stylesheet, absolute. */
  file: string;
  css: string;
  designSystem: DesignSystem;
  /** The keys of Tailwind's default theme, to tell which of ours replace one. */
  defaultKeys: ReadonlySet<string>;
  tailwindcss: string;
}

export function buildManifest(input: BuildManifestInput): Manifest {
  const { root, file, designSystem } = input;
  const stylesheet = path.relative(root, file);
  const facts = readStylesheet(input.css, stylesheet);
  const entries = [...designSystem.theme.entries()];

  // What `var(--x)` finds in each mode: the theme variables Tailwind emits
  // (inline and reference ones are never emitted), then `:root`, then `.dark`.
  const emitted = new Map<string, string>();
  for (const [key, entry] of entries) {
    if (entry.options & (THEME_OPTION.inline | THEME_OPTION.reference)) {
      continue;
    }
    emitted.set(key, entry.value);
  }
  const light: Scope = new Map([
    ...emitted,
    ...[...facts.root].map(([k, v]) => [k, v.value] as const),
  ]);
  const dark: Scope = new Map([
    ...light,
    ...[...facts.dark].map(([k, v]) => [k, v.value] as const),
  ]);

  const subKeys = new Map<string, Map<string, ThemeEntry[1]>>();
  for (const [key, entry] of entries) {
    const split = key.indexOf('--', 2);
    if (split === -1) continue;
    const parent = key.slice(0, split);
    const map = subKeys.get(parent) ?? new Map<string, ThemeEntry[1]>();
    map.set(key.slice(split + 2), entry);
    subKeys.set(parent, map);
  }

  const tokens: Token[] = [];
  for (const [key, entry] of entries) {
    if (key.indexOf('--', 2) !== -1) continue;

    const { namespace, name, category } = namespaceOf(key);
    const source = sourceOf(entry.src, root);
    const origin: TokenOrigin =
      entry.options & THEME_OPTION.default
        ? 'default'
        : source?.file !== stylesheet
          ? 'library'
          : entry.options & THEME_OPTION.inline
            ? 'alias'
            : 'ours';
    const kind = {
      color: category === 'color',
      length: LENGTH_CATEGORIES.has(category),
    };
    // An emitted variable can be overridden in `:root` or `.dark`
    // (`.dark { --color-grey-100: … }`), so each mode reads it by name. An
    // inline one exists only in the utilities, as its value.
    const own = emitted.has(key) ? `var(${key})` : entry.value;
    const lightValue = resolveValue(own, light, kind);
    const darkValue = resolveValue(own, dark, kind);

    const token: Token = {
      key,
      namespace,
      name,
      category,
      origin,
      source,
      value: entry.value,
      light: lightValue,
      dark: darkValue,
      chain: {
        light: chainOf(own, light).filter((k) => k !== key),
        dark: chainOf(own, dark).filter((k) => k !== key),
      },
      replacesDefault: origin !== 'default' && input.defaultKeys.has(key),
    };

    const subs = subKeys.get(key);
    if (category === 'text' && subs) {
      const lineHeight = subs.get('line-height');
      const fontWeight = subs.get('font-weight');
      token.textStyle = {};
      if (lineHeight) {
        token.textStyle.lineHeight = {
          ...resolveValue(lineHeight.value, light, {
            length: true,
            unitless: lightValue.px,
          }),
          source: sourceOf(lineHeight.src, root),
        };
      }
      if (fontWeight) {
        token.textStyle.fontWeight = {
          ...resolveValue(fontWeight.value, light, {}),
          source: sourceOf(fontWeight.src, root),
        };
      }
    }

    tokens.push(token);
  }

  // A theme variable overridden in `.dark` (`--color-grey-100`) is a token,
  // with its dark value already; only plain variables are listed here. A
  // reference-only theme key Tailwind never emits (its `--radius`) doesn't
  // make our `:root { --radius }` a token.
  const variableKeys = new Set(
    [...facts.root.keys(), ...facts.dark.keys()].filter(
      (key) => !emitted.has(key),
    ),
  );
  const variables: Variable[] = [...variableKeys].map((key) => {
    const inLight = facts.root.get(key);
    const inDark = facts.dark.get(key) ?? inLight;
    const kind = { color: true, length: true };
    return {
      key,
      light: inLight
        ? {
            ...resolveValue(inLight.value, light, kind),
            source: { file: inLight.file, line: inLight.line },
          }
        : null,
      dark: inDark
        ? {
            ...resolveValue(inDark.value, dark, kind),
            source: { file: inDark.file, line: inDark.line },
          }
        : null,
    };
  });

  const shadowed: ShadowedDeclaration[] = [...facts.theme]
    .filter(([, declarations]) => declarations.length > 1)
    .map(([key, declarations]) => ({
      key,
      declarations: declarations.map((d) => ({
        file: d.file,
        line: d.line,
        value: d.value,
        block: d.inline ? ('theme inline' as const) : ('theme' as const),
      })),
    }));

  return {
    stylesheet,
    tailwindcss: input.tailwindcss,
    tokens,
    variables,
    shadowed,
  };
}
