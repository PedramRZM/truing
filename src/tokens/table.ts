import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  appCompiler,
  checkTailwindVersion,
  type DesignSystem,
  loadDesignSystem,
  resolveStylesheet,
} from './design-system';
import {
  type ClassLookup,
  deriveRootNamespaces,
  isRegistered,
  type RootNamespaces,
  tokenForClass,
} from './lookup';
import { buildManifest, type Manifest, type Token } from './manifest';

export { TOKEN_CATEGORIES, TOKEN_ORIGINS } from './manifest';
export type { ClassLookup } from './lookup';
export type {
  Manifest,
  ShadowedDeclaration,
  SourceRef,
  Token,
  TokenCategory,
  TokenOrigin,
  Variable,
} from './manifest';
export type { ResolvedValue } from './values';

/** The token table: the manifest, and lookups against the same design system. */
export interface TokenTable {
  manifest: Manifest;
  /** By key: `--color-primary`. */
  byKey: ReadonlyMap<string, Token>;
  tokenForClass(className: string): ClassLookup;
  isRegistered(className: string): boolean;
  designSystem: DesignSystem;
}

/** The keys of Tailwind's default theme, as the app's tailwindcss ships it. */
async function defaultThemeKeys(stylesheet: string): Promise<Set<string>> {
  const theme = resolveStylesheet(
    'tailwindcss/theme.css',
    path.dirname(stylesheet),
  );
  const css = await readFile(theme, 'utf8');
  const { __unstable__loadDesignSystem } = await appCompiler(stylesheet);
  const designSystem = await __unstable__loadDesignSystem(css, {
    base: path.dirname(theme),
  });
  return new Set([...designSystem.theme.entries()].map(([key]) => key));
}

/**
 * Loads the token table of a project. `stylesheet` is the config's `tokens`,
 * relative to `root`.
 */
export async function loadTokens(
  root: string,
  stylesheet: string,
): Promise<TokenTable> {
  const file = path.resolve(root, stylesheet);
  const tailwindcss = checkTailwindVersion(file);
  const [css, designSystem, defaultKeys] = await Promise.all([
    readFile(file, 'utf8'),
    loadDesignSystem(file),
    defaultThemeKeys(file),
  ]);

  const manifest = buildManifest({
    root,
    file,
    css,
    designSystem,
    defaultKeys,
    tailwindcss,
  });
  const byKey = new Map(manifest.tokens.map((token) => [token.key, token]));
  let roots: RootNamespaces | undefined;

  return {
    manifest,
    byKey,
    designSystem,
    tokenForClass: (className) => {
      // Derived on the first lookup: the manifest alone doesn't need it.
      roots ??= deriveRootNamespaces(designSystem, manifest.tokens);
      return tokenForClass(designSystem, byKey, roots, className);
    },
    isRegistered: (className) => isRegistered(designSystem, className),
  };
}

/**
 * The tailwind-merge class groups our tokens add (`src/lib/utils.ts`): text
 * styles go in `font-size` and shadows in `shadow`. Unknown to tailwind-merge,
 * `text-label-md` reads as a colour and is dropped beside `text-primary`.
 */
export function tailwindMergeGroups(manifest: Manifest): {
  'font-size': string[];
  shadow: string[];
} {
  const ours = manifest.tokens.filter(
    (t) => (t.origin === 'ours' || t.origin === 'alias') && t.name !== null,
  );
  const names = (namespace: string): string[] =>
    ours.flatMap((t) => (t.namespace === namespace && t.name ? [t.name] : []));
  return { 'font-size': names('--text'), shadow: names('--shadow') };
}
