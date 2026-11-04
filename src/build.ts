import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

import { TRUING_MARKER } from './marker.mjs';
import { type LoadedModule, panelsEntry, probesEntry } from './module-loader';
import type { Session } from './protocol';
import type { ShellAssets } from './server';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.dirname(here);

/** The generated entries: the probes and panels of the listed modules. */
function modulesPlugin(modules: readonly LoadedModule[]): esbuild.Plugin {
  return {
    name: 'truing-modules',
    setup(build) {
      build.onResolve({ filter: /^truing:(probes|panels)$/ }, (args) => ({
        path: args.path,
        namespace: 'truing-modules',
      }));
      build.onLoad({ filter: /.*/, namespace: 'truing-modules' }, (args) => ({
        contents:
          args.path === 'truing:probes'
            ? probesEntry(modules)
            : panelsEntry(modules),
        loader: 'js',
        resolveDir: here,
      }));
    },
  };
}

/**
 * A project's own module lives outside this package. Its imports of these
 * resolve from Truing's own dependencies, so the shell never carries a
 * second React (or the app's).
 */
const SHARED = /^(react|react-dom|zod|lucide-react)(\/.*)?$/;

const sharedPlugin: esbuild.Plugin = {
  name: 'truing-shared',
  setup(build) {
    build.onResolve({ filter: SHARED }, async (args) => {
      const inside = !path
        .relative(packageDir, args.resolveDir)
        .startsWith('..');
      if (inside) {
        return undefined;
      }
      const resolved = await build.resolve(args.path, {
        kind: args.kind,
        resolveDir: here,
      });
      return resolved.errors.length > 0
        ? { errors: resolved.errors }
        : { path: resolved.path };
    });
  },
};

function plugins(modules: readonly LoadedModule[]): esbuild.Plugin[] {
  return [modulesPlugin(modules), sharedPlugin];
}

/** The marker sits in a banner as well as in the code, so minifying can't drop it. */
const banner = `/* ${TRUING_MARKER} (not part of the app; ADR 0001) */`;

/**
 * bippy's entry imports React for its hooks (`useFiber`), which no probe
 * calls; a probe must never carry React into the app's frame (docs/modules.md).
 * In the runtime, `react` is an empty module.
 */
const noReactPlugin: esbuild.Plugin = {
  name: 'truing-no-react',
  setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({
      path: 'react',
      namespace: 'truing-no-react',
    }));
    build.onLoad({ filter: /.*/, namespace: 'truing-no-react' }, () => ({
      contents: 'export {};',
      loader: 'js',
    }));
  },
};

/** The init script: the runtime bundle with this session compiled into its closure. */
export async function buildRuntime(
  session: Session,
  modules: readonly LoadedModule[],
): Promise<string> {
  const result = await esbuild.build({
    plugins: [noReactPlugin, ...plugins(modules)],
    entryPoints: [path.join(here, 'runtime/index.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    outfile: 'runtime.js',
    platform: 'browser',
    target: 'chrome120',
    // It runs in every frame: minified (61 KB with the inspector, TRU-2.1), with
    // names kept so a probe's stack still reads.
    minify: true,
    keepNames: true,
    banner: { js: banner },
    define: {
      __TRUING_SESSION__: JSON.stringify(session),
      // Folds away what only Truing's process reads (selection's module.ts).
      __TRUING_RUNTIME__: 'true',
    },
    logLevel: 'silent',
  });

  return outputText(result, '.js');
}

const shellOptions: esbuild.BuildOptions = {
  entryPoints: [path.join(here, 'shell/index.tsx')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  // The fonts travel inside shell.css, so the server needs no route for them.
  loader: { '.woff2': 'dataurl' },
  outdir: 'out',
  banner: { js: banner, css: banner },
  // React's development build costs several times the production one on every
  // render, and the shell renders while the app's own page is being used.
  define: { 'process.env.NODE_ENV': '"production"' },
  // React's own check fails without dead code removed. Names stay, so a
  // section's stack still reads.
  minifySyntax: true,
  minifyWhitespace: true,
  logLevel: 'silent',
};

/** `--watch` is for working on Truing itself: React's warnings, and source maps. */
const shellDevOptions: esbuild.BuildOptions = {
  ...shellOptions,
  sourcemap: 'inline',
  define: { 'process.env.NODE_ENV': '"development"' },
  minifySyntax: false,
  minifyWhitespace: false,
};

export function shellHtml(): string {
  return readFileSync(path.join(here, 'shell/index.html'), 'utf8');
}

function toAssets(result: esbuild.BuildResult): ShellAssets {
  return {
    html: shellHtml(),
    js: outputText(result, '.js'),
    css: outputText(result, '.css'),
  };
}

/** The setup screens: their own small bundle, before any project is open. */
export async function buildSetup(): Promise<{ js: string; css: string }> {
  const result = await esbuild.build({
    ...shellOptions,
    entryPoints: [path.join(here, 'setup/ui/index.tsx')],
  });
  return { js: outputText(result, '.js'), css: outputText(result, '.css') };
}

export async function buildShell(
  modules: readonly LoadedModule[],
): Promise<ShellAssets> {
  return toAssets(
    await esbuild.build({ ...shellOptions, plugins: plugins(modules) }),
  );
}

/**
 * Rebuilds the shell whenever its source changes, for working on Truing
 * itself (`--watch`). `onRebuild` runs after each successful build.
 */
export async function watchShell(
  modules: readonly LoadedModule[],
  onRebuild: (assets: ShellAssets) => void,
): Promise<{ assets: ShellAssets; stop: () => Promise<void> }> {
  let first: ((assets: ShellAssets) => void) | null = null;
  const ready = new Promise<ShellAssets>((resolve) => {
    first = resolve;
  });

  const context = await esbuild.context({
    ...shellDevOptions,
    plugins: [
      ...plugins(modules),
      {
        name: 'truing-reload',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length > 0) {
              console.error('[truing] shell build failed', result.errors);
              return;
            }
            const assets = toAssets(result);
            if (first) {
              first(assets);
              first = null;
              return;
            }
            onRebuild(assets);
          });
        },
      },
    ],
  });
  await context.watch();

  return { assets: await ready, stop: () => context.dispose() };
}

function outputText(result: esbuild.BuildResult, extension: string): string {
  const file = result.outputFiles?.find((output) =>
    output.path.endsWith(extension),
  );
  if (!file) {
    throw new Error(`esbuild produced no ${extension} output.`);
  }
  return file.text;
}
