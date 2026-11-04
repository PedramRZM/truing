import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadModule } from '@tailwindcss/node';
import type * as Tailwind from 'tailwindcss';
import { z } from 'zod';

/**
 * Tailwind's compiler as the editor tools use it (IntelliSense, the Prettier
 * and ESLint plugins), loaded from the project's own installed copy. The API
 * is `__unstable__`, with no semver promise, so this file is the only one that
 * touches it, a project whose copy has no such API opens without tokens, and the
 * manifest's snapshot test fails when an upgrade changes what it returns.
 */
export type DesignSystem = Awaited<
  ReturnType<typeof Tailwind.__unstable__loadDesignSystem>
>;

/** A theme entry's options, as Tailwind's `ThemeOptions` flags. */
export const THEME_OPTION = {
  inline: 1,
  reference: 2,
  default: 4,
} as const;

/** The parts of a package.json Truing reads. */
const packageJsonSchema = z.object({
  version: z.string(),
  style: z.string().optional(),
  exports: z
    .record(
      z.string(),
      z.union([z.string(), z.object({ style: z.string().optional() })]),
    )
    .optional(),
});

function readPackageJson(file: string): z.infer<typeof packageJsonSchema> {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return packageJsonSchema.parse(parsed);
}

function versionOf(packageJson: string): string {
  return readPackageJson(packageJson).version;
}

/** The folder of package `name` as Node would find it from `base`. */
function packageDir(name: string, base: string): string | null {
  for (let dir = path.resolve(base); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * Resolves an `@import` the way Tailwind does for CSS: relative paths as
 * files, bare ones through the package's `style` export (`tailwindcss`,
 * `tw-animate-css`, `tailwindcss/theme.css`).
 */
export function resolveStylesheet(id: string, base: string): string {
  if (id.startsWith('.') || path.isAbsolute(id)) {
    const file = path.resolve(base, id);
    return existsSync(file) || file.endsWith('.css') ? file : `${file}.css`;
  }

  const parts = id.split('/');
  const scoped = id.startsWith('@') ? 2 : 1;
  const name = parts.slice(0, scoped).join('/');
  const subpath = parts.slice(scoped).join('/');
  const dir = packageDir(name, base);
  if (!dir) {
    throw new Error(`Cannot find the stylesheet '${id}' from ${base}.`);
  }

  const pkg = readPackageJson(path.join(dir, 'package.json'));
  const entry = pkg.exports?.[subpath ? `./${subpath}` : '.'];
  const exported = typeof entry === 'string' ? entry : entry?.style;
  const target = exported ?? (subpath || pkg.style || 'index.css');
  return path.join(dir, target);
}

/**
 * The app's own tailwindcss version: Truing compiles with the app's copy, so
 * what it reports is what the app gets. Tailwind v4's compiler API is what
 * this reads, so an older major is refused here and read by other means later.
 */
export function checkTailwindVersion(stylesheet: string): string {
  const appDir = packageDir('tailwindcss', path.dirname(stylesheet));
  if (!appDir) {
    throw new Error(
      `The app has no tailwindcss installed next to ${stylesheet}. Install its dependencies first.`,
    );
  }
  const app = versionOf(path.join(appDir, 'package.json'));
  const major = Number(app.split('.')[0]);
  if (major < 4) {
    throw new Error(
      `The app uses tailwindcss ${app}. Truing reads tokens from Tailwind 4 and up.`,
    );
  }
  return app;
}

/** The compiler the app itself uses, loaded from its own node_modules. */
export async function appCompiler(
  stylesheet: string,
): Promise<typeof Tailwind> {
  const appRequire = createRequire(stylesheet);
  const entry = appRequire.resolve('tailwindcss');
  const loaded = (await import(pathToFileURL(entry).href)) as Partial<
    typeof Tailwind
  > & {
    default?: typeof Tailwind;
  };
  // `require` resolves its CommonJS build, whose exports sit under `default`.
  const compiler = (
    loaded.__unstable__loadDesignSystem ? loaded : loaded.default
  ) as typeof Tailwind | undefined;
  if (!compiler?.__unstable__loadDesignSystem) {
    throw new Error(
      `The tailwindcss at ${entry} has no compiler API Truing can read.`,
    );
  }
  return compiler;
}

/** Loads the design system of the stylesheet at `file` (absolute). */
export async function loadDesignSystem(file: string): Promise<DesignSystem> {
  checkTailwindVersion(file);
  const css = await readFile(file, 'utf8');
  const { __unstable__loadDesignSystem } = await appCompiler(file);

  // @tailwindcss/node's own __unstable__loadDesignSystem drops `from`, and
  // without it no theme entry knows its source line. So Truing calls
  // Tailwind's directly with the same loaders.
  return __unstable__loadDesignSystem(css, {
    base: path.dirname(file),
    from: file,
    async loadStylesheet(id, base) {
      const resolved = resolveStylesheet(id, base);
      return {
        path: resolved,
        base: path.dirname(resolved),
        content: await readFile(resolved, 'utf8'),
      };
    },
    async loadModule(id, base) {
      const loaded = await loadModule(id, base, () => {});
      return loaded;
    },
  });
}
