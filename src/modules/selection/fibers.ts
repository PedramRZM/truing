// The owner chain of an element, as React 19 keeps it in development
// (TRU-1.1): the host fiber, then `_debugOwner` up to the root, through client
// fibers and Flight's records of Server Components alike. Each link carries
// the frame where its JSX was written, still unmapped.
import { type Fiber, getDisplayName, getFiber, getLatestFiber } from 'bippy';

import type { RawFrame } from '../../adapters/next';

import { parseStack } from './stacks';

/** Flight's record of a Server Component that rendered (`ReactComponentInfo`). */
type ServerInfo = {
  name?: string;
  env?: string;
  owner?: Fiber | ServerInfo | null;
  debugStack?: Error | null;
  props?: Record<string, unknown>;
};

type DebugFields = {
  _debugStack?: Error | null;
  _debugOwner?: Fiber | ServerInfo | null;
};

/** A prop as the inspector can show it: the value, or what kind of thing it is. */
export type PropValue = string | number | boolean | null | { kind: string };

export type PropsView =
  | {
      /** `live` from the client fiber; `snapshot` from Flight's dev copy of a Server Component's. */
      status: 'live' | 'snapshot';
      values: Record<string, PropValue>;
    }
  | { status: 'none' };

export type ChainLink = {
  name: string;
  kind: 'host' | 'client' | 'server';
  /** A Server Component's environment: `Server`, `Prerender`. */
  env: string | null;
  /** Where its JSX was written, unmapped; null when React kept no stack. */
  frame: RawFrame | null;
  /** Past React's 10,000-element stack cap: no location by design. */
  capped: boolean;
  props: PropsView;
};

/** How far up the chain to read: past the app, it is only Next's own components. */
const MAX_LINKS = 80;

function isFiber(value: unknown): value is Fiber {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { tag?: unknown }).tag === 'number'
  );
}

export function nameOfFiber(fiber: Fiber): string {
  if (typeof fiber.type === 'string') return fiber.type;
  return getDisplayName(fiber.type) ?? 'Anonymous';
}

function propValue(value: unknown): PropValue | undefined {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'function') return { kind: 'function' };
  if (Array.isArray(value)) return { kind: 'array' };
  if (typeof value === 'object' && '$$typeof' in value) {
    return { kind: 'element' };
  }
  return { kind: typeof value };
}

function propsView(props: unknown, status: 'live' | 'snapshot'): PropsView {
  if (typeof props !== 'object' || props === null) return { status: 'none' };
  const values: Record<string, PropValue> = {};
  for (const [name, raw] of Object.entries(props)) {
    if (name === 'ref' || name === 'key') continue;
    const value = propValue(raw);
    if (value !== undefined) values[name] = value;
  }
  return { status, values };
}

function frameOf(stack: Error | null | undefined): {
  frame: RawFrame | null;
  capped: boolean;
} {
  if (!stack) return { frame: null, capped: false };
  const parsed = parseStack(stack);
  return { frame: parsed.frames[0] ?? null, capped: parsed.capped };
}

/** The committed fiber of a DOM element, or null before React hydrated it. */
export function fiberOfElement(element: Element): Fiber | null {
  const fiber = getFiber(element);
  return fiber ? getLatestFiber(fiber) : null;
}

/** How long a pick waits for a page that's still hydrating, at most. */
const HYDRATION_WAIT_MS = 5000;
const HYDRATION_POLL_MS = 50;

type DevToolsHook = { renderers?: Map<number, unknown> };

/**
 * Set once a wait runs out: this document has elements React never reaches, such
 * as a widget beside an app's root, so later picks shouldn't wait for them too.
 */
let waitedInVain = false;

/**
 * Scripts still loading, or React loaded and yet to reach this part of the page.
 * It asks about the element's own ancestors, because Next's dev overlay is a
 * React root of its own: other fibers on the page say nothing about hydration.
 */
function reactIsOnItsWay(element: Element): boolean {
  if (document.readyState !== 'complete') return true;
  const { __REACT_DEVTOOLS_GLOBAL_HOOK__: hook } = globalThis as {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook;
  };
  if (!hook?.renderers?.size) return false;
  for (let at = element.parentElement; at; at = at.parentElement) {
    if (fiberOfElement(at)) return false;
  }
  return true;
}

/**
 * The element's fiber, waiting if the page is still hydrating. A frame counts
 * as connected once Truing's probe has loaded, which is before React: a pick in
 * that gap would otherwise read as "not drawn by React" and send an exact edit
 * to Claude (TRU-2.1). A page without React answers at once.
 */
export async function hydratedFiberOf(element: Element): Promise<Fiber | null> {
  const deadline = performance.now() + HYDRATION_WAIT_MS;
  for (;;) {
    const fiber = fiberOfElement(element);
    if (fiber) return fiber;
    if (waitedInVain || !element.isConnected || !reactIsOnItsWay(element)) {
      return null;
    }
    if (performance.now() >= deadline) {
      waitedInVain = true;
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, HYDRATION_POLL_MS));
  }
}

/** The chain from the element's own JSX up through every owner. */
export function chainOf(host: Fiber): ChainLink[] {
  const links: ChainLink[] = [];
  let current: Fiber | ServerInfo | null | undefined = host;

  while (current && links.length < MAX_LINKS) {
    if (isFiber(current)) {
      const fiber = getLatestFiber(current);
      const debug = fiber as Fiber & DebugFields;
      const host = typeof fiber.type === 'string';
      links.push({
        name: nameOfFiber(fiber),
        kind: host ? 'host' : 'client',
        env: null,
        ...frameOf(debug._debugStack),
        props: host
          ? { status: 'none' }
          : propsView(fiber.memoizedProps, 'live'),
      });
      current = debug._debugOwner;
      continue;
    }

    const info: ServerInfo = current;
    links.push({
      name: info.name ?? 'Anonymous',
      kind: 'server',
      env: info.env ?? null,
      ...frameOf(info.debugStack),
      props: info.props
        ? propsView(info.props, 'snapshot')
        : { status: 'none' },
    });
    current = info.owner;
  }

  return links;
}

/**
 * The owner at a place in the chain, walked as `chainOf` walks it: the
 * fiber, or Flight's record of a Server Component; null past the end.
 */
export function ownerAt(host: Fiber, index: number): Fiber | ServerInfo | null {
  let current: Fiber | ServerInfo | null | undefined = host;
  for (let at = 0; current && at < MAX_LINKS; at++) {
    if (isFiber(current)) {
      const fiber = getLatestFiber(current);
      if (at === index) return fiber;
      current = (fiber as Fiber & DebugFields)._debugOwner;
      continue;
    }
    const info: ServerInfo = current;
    if (at === index) return info;
    current = info.owner;
  }
  return null;
}

export { isFiber, frameOf, propsView };
export type { ServerInfo };

/** The names up the chain, without reading any stack: cheap enough for every element. */
export function ownerNames(host: Fiber, count: number): string[] {
  const names: string[] = [];
  let current: Fiber | ServerInfo | null | undefined = host;
  while (current && names.length < count) {
    if (isFiber(current)) {
      const fiber = getLatestFiber(current);
      names.push(nameOfFiber(fiber));
      current = (fiber as Fiber & DebugFields)._debugOwner;
      continue;
    }
    names.push(current.name ?? 'Anonymous');
    current = current.owner;
  }
  return names;
}
