// What Truing needs from Next's dev server (ADR 0001: stack-specific
// parts sit behind an adapter). A generated position is mapped to its source
// in one of two ways (TRU-2.1, measured on 16.2.9):
// - Server frames, and webpack's client frames (`webpack-internal:///…`):
//   `POST /__nextjs_original-stack-frames`, the endpoint Next's error overlay
//   uses. It is undocumented, so TRU-1.1's contract test guards it.
// - Turbopack's client frames (`http://…/_next/static/chunks/…`): the endpoint
//   rejects their scheme, or echoes the generated position back when given
//   only the path. The chunk's own source map is read in the frame instead.
// The probe imports it, so it uses no Node APIs; the server takes
// `launchEditorUrl` from it too.
import { forgetChunkMaps, mapChunkPosition } from './source-maps';

/** A frame as V8 reports it: the generated script and position. */
export type RawFrame = {
  url: string;
  line: number;
  column: number;
  fn: string | null;
};

/** Where Next says a frame's code is, as it names the file. */
export type SourceFrame = {
  /** As Next gives it: relative to its project, absolute, or a `file://` URL. */
  file: string;
  line: number;
  column: number;
  /** In Next's ignore list: node_modules and Next's own code. */
  ignored: boolean;
};

const SERVER_PREFIXES = ['about://React/', 'rsc://React/'];

/** A Server Component's frame, which Next maps with the server's chunks. */
export function isServerUrl(url: string): boolean {
  return SERVER_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Flight's frame URL wraps the server chunk: `about://React/Server/<chunk>?N`,
 * where N only tells repeated frames apart. Next wants the chunk.
 */
function serverChunk(url: string): string {
  for (const prefix of SERVER_PREFIXES) {
    if (!url.startsWith(prefix)) continue;
    const envEnd = url.indexOf('/', prefix.length);
    const query = url.lastIndexOf('?');
    const chunk =
      query > envEnd ? url.slice(envEnd + 1, query) : url.slice(envEnd + 1);
    return decodeURIComponent(chunk);
  }
  return url;
}

type Settled =
  | {
      status: 'fulfilled';
      value?: {
        originalStackFrame?: {
          file?: string | null;
          line1?: number | null;
          column1?: number | null;
          ignored?: boolean;
        } | null;
      };
    }
  | { status: 'rejected' };

/** A client chunk the browser loaded by URL (Turbopack), not an eval'd webpack module. */
function isChunkUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/** Maps client chunk frames through the chunks' own source maps, fetched once each. */
function fromChunkMaps(
  frames: readonly RawFrame[],
): Promise<Array<SourceFrame | null>> {
  return Promise.all(
    frames.map(async (frame): Promise<SourceFrame | null> => {
      const mapped = await mapChunkPosition(
        frame.url,
        frame.line,
        frame.column,
      );
      if (!mapped) return null;
      return {
        file: mapped.source,
        line: mapped.line,
        column: mapped.column,
        ignored:
          mapped.ignored ||
          mapped.source.includes('node_modules/') ||
          !isSourceFile(mapped.source),
      };
    }),
  );
}

/** A file a person wrote: not `<anonymous>` or a React-made frame. */
function isSourceFile(file: string): boolean {
  return !file.startsWith('<') && /\.[cm]?[jt]sx?$/.test(file);
}

const cache = new Map<string, Promise<SourceFrame | null>>();

function keyOf(frame: RawFrame): string {
  return `${frame.url}:${frame.line}:${frame.column}`;
}

async function post(
  frames: readonly RawFrame[],
  isServer: boolean,
): Promise<Array<SourceFrame | null>> {
  const response = await fetch('/__nextjs_original-stack-frames', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      frames: frames.map((frame) => ({
        file: isServer ? serverChunk(frame.url) : frame.url,
        methodName: frame.fn ?? '<unknown>',
        line1: frame.line,
        column1: frame.column,
        arguments: [],
      })),
      isServer,
      isEdgeServer: false,
      isAppDirectory: true,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Next's dev server didn't map the frames (HTTP ${response.status}).`,
    );
  }
  const results = (await response.json()) as Settled[];
  return frames.map((_, index) => {
    const result = results[index];
    if (result?.status !== 'fulfilled') return null;
    const original = result.value?.originalStackFrame;
    if (!original?.file) return null;
    return {
      file: original.file,
      line: original.line1 ?? 1,
      column: original.column1 ?? 1,
      // Webpack doesn't ignore-list every frame inside a package; Next's
      // own components (OuterLayoutRouter) come back with ignored false.
      ignored:
        Boolean(original.ignored) ||
        original.file.includes('node_modules/') ||
        !isSourceFile(original.file),
    };
  });
}

/**
 * Maps generated frames to their source, in one request per environment,
 * and remembers the answers until `forgetFrames`. A frame Next can't map
 * comes back null.
 */
export function resolveFrames(
  frames: readonly RawFrame[],
): Promise<Array<SourceFrame | null>> {
  const missing = new Map<string, RawFrame>();
  for (const frame of frames) {
    const key = keyOf(frame);
    if (!cache.has(key)) missing.set(key, frame);
  }

  const all = [...missing.values()];
  const batches: Array<{
    batch: RawFrame[];
    map: (batch: RawFrame[]) => Promise<Array<SourceFrame | null>>;
  }> = [
    {
      batch: all.filter((frame) => isServerUrl(frame.url)),
      map: (batch) => post(batch, true),
    },
    {
      batch: all.filter(
        (frame) => !isServerUrl(frame.url) && !isChunkUrl(frame.url),
      ),
      map: (batch) => post(batch, false),
    },
    { batch: all.filter((frame) => isChunkUrl(frame.url)), map: fromChunkMaps },
  ];
  for (const { batch, map } of batches) {
    if (batch.length === 0) continue;
    const answers = map(batch);
    batch.forEach((frame, index) => {
      const key = keyOf(frame);
      const answer = answers.then((all) => all[index] ?? null);
      cache.set(key, answer);
      // A failed request is retried by the next lookup, not cached.
      answer.catch(() => cache.delete(key));
    });
  }

  // A frame whose request failed reads as unmapped; the inspector says so.
  return Promise.all(
    frames.map((frame) =>
      (cache.get(keyOf(frame)) ?? Promise.resolve(null)).catch(() => null),
    ),
  );
}

/** Next's own way to open a file in the developer's editor (`launch-editor`). */
export function launchEditorUrl(
  appOrigin: string,
  at: { file: string; line: number; column: number },
): string {
  const url = new URL('/__nextjs_launch-editor', appOrigin);
  url.searchParams.set('file', at.file);
  url.searchParams.set('line1', String(at.line));
  url.searchParams.set('column1', String(at.column));
  return url.toString();
}

/**
 * Drops remembered answers. A hot reload keeps a module's URL but changes
 * its code (webpack's `webpack-internal:///…`, Turbopack's chunks, a Server
 * Component's chunk), so the same position can mean another line.
 * `chunkMaps` also drops the client chunks' maps, which are slow to fetch
 * again: only after a Fast Refresh. Next's own answers are cheap.
 */
export function forgetFrames({ chunkMaps }: { chunkMaps: boolean }): void {
  for (const key of cache.keys()) {
    if (chunkMaps || !isChunkUrl(key)) cache.delete(key);
  }
  if (chunkMaps) forgetChunkMaps();
}
