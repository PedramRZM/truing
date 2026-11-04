// React 19 keeps, on every element it renders in development, the stack of
// the JSX call that created it (`_debugStack`, an Error). This reads the
// frames out of it (TRU-1.1). Chromium only: it relies on V8's call sites.
import type { RawFrame } from '../../adapters/next';

/** React's sentinel below the frames that belong to the app. */
const BOTTOM_FRAME = 'react_stack_bottom_frame';

export type ParsedStack = {
  frames: RawFrame[];
  /**
   * React's shared "unknown owner" stack: after 10,000 elements in one
   * render, React stops capturing stacks and gives every further element
   * the same empty one (TRU-1.1's cap).
   */
  capped: boolean;
};

type CallSite = {
  getFunctionName(): string | null;
  getScriptNameOrSourceURL(): string | null;
  getLineNumber(): number | null;
  getColumnNumber(): number | null;
};

type ErrorWithTrace = {
  prepareStackTrace?: (error: Error, sites: CallSite[]) => unknown;
};

const parsed = new WeakMap<Error, ParsedStack>();

/** V8's call sites, if this is the stack's first read; null if something read it before. */
function callSitesOf(error: Error): CallSite[] | null {
  let sites: CallSite[] | null = null;
  const ErrorType = Error as unknown as ErrorWithTrace;
  const previous = ErrorType.prepareStackTrace;
  // The string left behind must stay readable: React prints it again in
  // the console's owner stacks.
  ErrorType.prepareStackTrace = (read, callSites) => {
    sites = callSites;
    if (previous) return previous(read, callSites);
    const lines = callSites.map((site) => `    at ${String(site)}`);
    return [`${read.name}: ${read.message}`, ...lines].join('\n');
  };
  try {
    void error.stack;
  } finally {
    ErrorType.prepareStackTrace = previous;
  }
  return sites;
}

/** `    at name (url:line:col)` or `    at url:line:col`, as V8 prints them. */
const STACK_LINE = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/;

function framesFromText(stack: string): Array<RawFrame | 'bottom'> {
  return stack.split('\n').flatMap((line): Array<RawFrame | 'bottom'> => {
    if (line.includes(BOTTOM_FRAME)) return ['bottom'];
    const match = STACK_LINE.exec(line);
    if (!match) return [];
    const [, fn, url, lineText, columnText] = match;
    return [
      {
        url: url ?? '',
        line: Number(lineText),
        column: Number(columnText),
        fn: fn ?? null,
      },
    ];
  });
}

function framesFromSites(sites: CallSite[]): Array<RawFrame | 'bottom'> {
  return sites.map((site) => {
    const fn = site.getFunctionName();
    if (fn?.includes(BOTTOM_FRAME)) return 'bottom';
    return {
      url: site.getScriptNameOrSourceURL() ?? '',
      line: site.getLineNumber() ?? 0,
      column: site.getColumnNumber() ?? 0,
      fn,
    };
  });
}

/**
 * The frames of a debug stack, above React's sentinel. The first frame is
 * React's own (`jsxDEV`, or Flight's fake call site), dropped. Flight's
 * server stacks have no sentinel: they are already trimmed.
 */
export function parseStack(error: Error): ParsedStack {
  const cached = parsed.get(error);
  if (cached) return cached;

  const sites = callSitesOf(error);
  const all = sites
    ? framesFromSites(sites)
    : framesFromText(String(error.stack ?? ''));
  const bottom = all.indexOf('bottom');
  const above = (bottom === -1 ? all : all.slice(0, bottom)).filter(
    (frame): frame is RawFrame => frame !== 'bottom' && frame.url !== '',
  );
  const frames = above.slice(1);
  const result: ParsedStack = {
    frames,
    capped: bottom !== -1 && frames.length === 0,
  };
  parsed.set(error, result);
  return result;
}
