#!/usr/bin/env node
// Fails if any of Truing's code reached an app build (TRU-1.5, the product spec).
// Truing's runtime and shell carry TRUING_MARKER; nothing else does.
//
// usage: node scripts/check-build.mjs <build dir>...
//   e.g. .vercel/output .next   (.next/cache is skipped: it is not shipped)
//
// Exit codes: 0 clean, 1 marker found, 2 nothing to search or the marker is
// missing from Truing's own runtime (a check that can't find anything
// must not pass).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

import { TRUING_MARKER } from '../src/marker.mjs';

const RUNTIME_ENTRY = fileURLToPath(
  new URL('../src/runtime/index.ts', import.meta.url),
);

/**
 * Bundles Truing's runtime the way it ships and says whether the marker
 * survives in it. If it didn't, a clean scan would prove nothing.
 */
export async function markerInRuntime() {
  const result = await build({
    entryPoints: [RUNTIME_ENTRY],
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    platform: 'browser',
    outfile: 'runtime.js',
    define: { __TRUING_SESSION__: '{}' },
    // The runtime imports the probes the config lists; the marker is in the
    // core, so none are needed here.
    plugins: [
      {
        name: 'no-modules',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^truing:probes$/ }, () => ({
            path: 'probes',
            namespace: 'no-modules',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'no-modules' }, () => ({
            contents: 'export const probes = [];',
            loader: 'js',
          }));
        },
      },
    ],
    logLevel: 'silent',
  });
  return result.outputFiles.some((file) => file.text.includes(TRUING_MARKER));
}

const SKIP = new Set(['cache']);

/** Every file under `dir` that contains the marker, skipping `.next/cache`. */
export function findMarker(dir, marker = TRUING_MARKER) {
  const needle = Buffer.from(marker);
  const hits = [];
  let files = 0;

  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!(SKIP.has(entry.name) && path.basename(current) === '.next')) {
          walk(full);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      files += 1;
      if (readFileSync(full).includes(needle)) hits.push(full);
    }
  };

  walk(dir);
  return { hits, files };
}

async function main(dirs) {
  if (!(await markerInRuntime())) {
    console.error(
      'check-build: Truing runtime no longer contains its marker; this check would pass on anything.',
    );
    return 2;
  }

  const present = dirs.filter(
    (dir) => existsSync(dir) && statSync(dir).isDirectory(),
  );
  if (present.length === 0) {
    console.error(
      `check-build: none of these exist: ${dirs.join(', ') || '(no paths given)'}`,
    );
    return 2;
  }

  let files = 0;
  const hits = [];
  for (const dir of present) {
    const result = findMarker(dir);
    files += result.files;
    hits.push(...result.hits);
  }

  if (files === 0) {
    console.error(`check-build: no files under ${present.join(', ')}`);
    return 2;
  }
  if (hits.length > 0) {
    console.error(
      `check-build: Truing code found in the app build (${hits.length} files):`,
    );
    for (const hit of hits.slice(0, 20)) console.error(`  ${hit}`);
    return 1;
  }

  console.log(
    `check-build: no Truing code in ${files} files under ${present.join(', ')}`,
  );
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(await main(process.argv.slice(2)));
}
