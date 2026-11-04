// Maps a position in a client chunk the browser loaded by URL to its source,
// through the chunk's own source map. Turbopack serves one next to every
// chunk (`<chunk>.js.map`), as an index map with a section per module.
// Written here rather than taken from bippy/source, which brings React into
// the init script (TRU-2.1): this needs only fetch and a VLQ decoder.

export type MappedPosition = {
  source: string;
  /** One-based. */
  line: number;
  /** One-based. */
  column: number;
  /** In the map's ignore list (packages, the framework). */
  ignored: boolean;
};

type StandardMap = {
  sources: string[];
  sourceRoot?: string;
  mappings: string;
  ignoreList?: number[];
  x_google_ignoreList?: number[];
};

type IndexMap = {
  sections: Array<{
    offset: { line: number; column: number };
    map: StandardMap | IndexMap;
  }>;
};

type SourceMap = StandardMap | IndexMap;

/** One decoded line: [generated column, source, source line, source column], zero-based. */
type Segment = [number, number, number, number];

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIGIT = new Map([...BASE64].map((char, index) => [char, index]));

/** The `mappings` string of a standard map, decoded once, line by line. */
function decode(mappings: string): Segment[][] {
  const lines: Segment[][] = [];
  let source = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  for (const text of mappings.split(';')) {
    const line: Segment[] = [];
    let column = 0;
    for (const segment of text.split(',')) {
      if (segment === '') continue;
      const fields: number[] = [];
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = DIGIT.get(char) ?? 0;
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
          continue;
        }
        fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
        value = 0;
        shift = 0;
      }
      column += fields[0] ?? 0;
      if (fields.length < 4) continue;
      source += fields[1] ?? 0;
      sourceLine += fields[2] ?? 0;
      sourceColumn += fields[3] ?? 0;
      line.push([column, source, sourceLine, sourceColumn]);
    }
    lines.push(line);
  }
  return lines;
}

const decoded = new WeakMap<StandardMap, Segment[][]>();

function lookupStandard(
  map: StandardMap,
  line: number,
  column: number,
): MappedPosition | null {
  let lines = decoded.get(map);
  if (!lines) {
    lines = decode(map.mappings);
    decoded.set(map, lines);
  }
  const segments = lines[line];
  if (!segments || segments.length === 0) return null;
  let found: Segment | null = null;
  for (const segment of segments) {
    if (segment[0] > column) break;
    found = segment;
  }
  found ??= segments[0] ?? null;
  if (!found) return null;
  const name = map.sources[found[1]];
  if (name === undefined) return null;
  const ignoreList = map.ignoreList ?? map.x_google_ignoreList ?? [];
  return {
    source: map.sourceRoot ? `${map.sourceRoot}${name}` : name,
    line: found[2] + 1,
    column: found[3] + 1,
    ignored: ignoreList.includes(found[1]),
  };
}

function lookup(
  map: SourceMap,
  line: number,
  column: number,
): MappedPosition | null {
  if (!('sections' in map)) return lookupStandard(map, line, column);
  let section: IndexMap['sections'][number] | null = null;
  for (const candidate of map.sections) {
    const { offset } = candidate;
    if (
      offset.line > line ||
      (offset.line === line && offset.column > column)
    ) {
      break;
    }
    section = candidate;
  }
  if (!section) return null;
  const { offset } = section;
  return lookup(
    section.map,
    line - offset.line,
    line === offset.line ? column - offset.column : column,
  );
}

const maps = new Map<string, Promise<SourceMap | null>>();

async function fetchMap(chunk: string): Promise<SourceMap | null> {
  const next = await fetch(`${chunk}.map`);
  if (next.ok) return (await next.json()) as SourceMap;
  // Not next to the chunk: the chunk says where, in its last comment.
  const script = await fetch(chunk);
  if (!script.ok) return null;
  const text = await script.text();
  const match = /\/\/# sourceMappingURL=(\S+)\s*$/.exec(text);
  if (!match?.[1] || match[1].startsWith('data:')) return null;
  const map = await fetch(new URL(match[1], chunk));
  return map.ok ? ((await map.json()) as SourceMap) : null;
}

function mapOf(chunk: string): Promise<SourceMap | null> {
  let map = maps.get(chunk);
  if (!map) {
    map = fetchMap(chunk).catch(() => {
      maps.delete(chunk);
      return null;
    });
    maps.set(chunk, map);
  }
  return map;
}

/** Where a one-based position in a chunk comes from, or null if its map doesn't say. */
export async function mapChunkPosition(
  chunk: string,
  line: number,
  column: number,
): Promise<MappedPosition | null> {
  const map = await mapOf(chunk.split('?')[0] ?? chunk);
  return map ? lookup(map, line - 1, column - 1) : null;
}

/** Drops every map: after a hot reload a chunk keeps its URL but not its code. */
export function forgetChunkMaps(): void {
  maps.clear();
}
