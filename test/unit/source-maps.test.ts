// The chunk source-map reader the probe uses on Turbopack (TRU-2.1), against a
// map made by a real encoder's rules: an index map with two sections.
import { afterEach, expect, it, vi } from 'vitest';

import { mapChunkPosition } from '../../src/adapters/source-maps';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Line 0: column 0 → a.tsx 0:0, column 6 → a.tsx 1:4. Line 1: column 2 → a.tsx 2:2.
const first = {
  version: 3,
  sources: ['a.tsx'],
  mappings: 'AAAA,MACI;EACF',
  names: [],
};
// One segment: column 0 → node_modules/x.js 9:0, which the map ignore-lists.
const second = {
  version: 3,
  sources: ['node_modules/x.js'],
  mappings: 'AASA',
  names: [],
  ignoreList: [0],
};
const index = {
  version: 3,
  sections: [
    { offset: { line: 0, column: 0 }, map: first },
    { offset: { line: 10, column: 4 }, map: second },
  ],
};

function serve(maps: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url in maps
        ? new Response(JSON.stringify(maps[url]))
        : new Response('', { status: 404 }),
    ),
  );
}

it('maps a position through the section that holds it', async () => {
  serve({ 'http://app/chunk.js.map': index });

  expect(await mapChunkPosition('http://app/chunk.js', 1, 8)).toEqual({
    source: 'a.tsx',
    line: 2,
    column: 5,
    ignored: false,
  });
  expect(await mapChunkPosition('http://app/chunk.js', 2, 3)).toEqual({
    source: 'a.tsx',
    line: 3,
    column: 3,
    ignored: false,
  });
  expect(await mapChunkPosition('http://app/chunk.js', 11, 5)).toEqual({
    source: 'node_modules/x.js',
    line: 10,
    column: 1,
    ignored: true,
  });
});

it('finds the map through the chunk when none sits next to it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url === 'http://app/other.js') {
        return new Response('code();\n//# sourceMappingURL=maps/other.map\n');
      }
      if (url === 'http://app/maps/other.map')
        return new Response(JSON.stringify(first));
      return new Response('', { status: 404 });
    }),
  );

  expect(await mapChunkPosition('http://app/other.js', 1, 1)).toMatchObject({
    source: 'a.tsx',
    line: 1,
    column: 1,
  });
});
