// Every instance of a component on the page (TRU-2.2), grouped by where its JSX
// was written. "The same component" is the same resolved type: bippy's
// `getType` unwraps `memo` and `forwardRef`, so `memo(Card)` and `Card` are
// one component. A Server Component has no fiber; Flight's records of it are
// grouped by name, and joined to the client's by it. Instances drawn from one
// `.map()` share their call site, so a list is one call site drawn N times.
import { type Fiber, getType } from 'bippy';

import { type RawFrame, resolveFrames } from '../../adapters/next';

import type { Ids } from './describe';
import {
  fiberOfElement,
  frameOf,
  isFiber,
  nameOfFiber,
  ownerAt,
  type ServerInfo,
} from './fibers';
import { children, serverInfosOf } from './layers';

// React's work tags for the fibers that render a component. A full memo
// (14) is left out: its child fiber renders the inner component and is
// counted instead, so a memo is never counted twice.
const FUNCTION_COMPONENT = 0;
const CLASS_COMPONENT = 1;
const HOST_COMPONENT = 5;
const FORWARD_REF = 11;
const MEMO = 14;
const SIMPLE_MEMO = 15;
const RENDERS = new Set([
  FUNCTION_COMPONENT,
  CLASS_COMPONENT,
  FORWARD_REF,
  SIMPLE_MEMO,
]);

export type Instance = {
  /** Its outermost elements, by the page's ids: what an outline draws. */
  elements: number[];
  /** Its props of the names asked for: the string set, or null for any other value. */
  props: Record<string, string | null>;
  /** The pick is drawn by this one. */
  picked: boolean;
};

export type CallSiteGroup = {
  /** Where the instances' JSX was written, mapped by Next; null when it couldn't be. */
  at: { file: string; line: number; column: number; ignored: boolean } | null;
  instances: Instance[];
};

/** Every fiber of the tree the element is in, from its root down. */
function* allFibers(from: Fiber): Generator<Fiber> {
  let root = from;
  while (root.return) root = root.return;
  // The root's FiberRoot knows which of the two root fibers is committed.
  const current = (root.stateNode as { current?: Fiber } | null)?.current;
  const stack: Fiber[] = [current ?? root];
  while (stack.length > 0) {
    const fiber = stack.pop();
    if (!fiber) break;
    yield fiber;
    stack.push(...[...children(fiber)].reverse());
  }
}

/** A fiber's outermost DOM elements, through portals (a Dialog's content). */
function topElements(fiber: Fiber): Element[] {
  if (fiber.tag === HOST_COMPONENT && fiber.stateNode instanceof Element) {
    return [fiber.stateNode];
  }
  return [...children(fiber)].flatMap(topElements);
}

type Found = {
  owner: Fiber | ServerInfo;
  frame: RawFrame | null;
  elements: Element[];
  props: unknown;
};

type WithStack = Fiber & { _debugStack?: Error | null };

/**
 * Every instance of the component at a place in the element's owner chain
 * (`link`, as the server's rule picked it), grouped by call site; null when
 * the element or that owner is gone.
 */
export async function instancesOf(
  element: Element,
  link: number,
  propNames: readonly string[],
  ids: Ids,
): Promise<CallSiteGroup[] | null> {
  const host = fiberOfElement(element);
  const owner = host ? ownerAt(host, link) : null;
  if (!host || !owner) return null;

  // The same component drawn on the client (a fiber, matched by type) and
  // on the server (Flight's record, which has only a name): a primitive
  // without 'use client' is both on one page.
  const type = isFiber(owner) ? getType(owner.type) : null;
  const name = isFiber(owner) ? nameOfFiber(owner) : owner.name;
  if (!type && !name) return null;
  const found: Found[] = [];
  const byInfo = new Map<ServerInfo, Element[]>();
  for (const fiber of allFibers(host)) {
    if (
      RENDERS.has(fiber.tag) &&
      (type ? getType(fiber.type) === type : nameOfFiber(fiber) === name)
    ) {
      // A full memo's inner fiber is made by React, not by JSX: its call
      // site is the memo's.
      const parent = fiber.return;
      const stack =
        (fiber as WithStack)._debugStack ??
        (parent?.tag === MEMO ? (parent as WithStack)._debugStack : null);
      found.push({
        owner: fiber,
        frame: frameOf(stack).frame,
        elements: topElements(fiber),
        props: fiber.memoizedProps,
      });
    }
    // Flight's record sits on each fiber the Server Component returned:
    // their elements are its own.
    for (const info of serverInfosOf(fiber)) {
      if (info.name !== name) continue;
      byInfo.set(info, [...(byInfo.get(info) ?? []), ...topElements(fiber)]);
    }
  }
  for (const [info, elements] of byInfo) {
    found.push({
      owner: info,
      frame: frameOf(info.debugStack).frame,
      elements,
      props: info.props,
    });
  }

  const groups = new Map<string, { frame: RawFrame | null; found: Found[] }>();
  for (const entry of found) {
    const { frame } = entry;
    const key = frame ? `${frame.url}:${frame.line}:${frame.column}` : '';
    const group = groups.get(key) ?? { frame, found: [] };
    group.found.push(entry);
    groups.set(key, group);
  }
  const ordered = [...groups.values()];
  const mapped = await resolveFrames(
    ordered.flatMap((group) => (group.frame ? [group.frame] : [])),
  );
  let index = 0;
  return ordered.map((group): CallSiteGroup => {
    const at = group.frame ? (mapped[index++] ?? null) : null;
    return {
      at,
      instances: group.found.map((entry) => {
        const props: Record<string, string | null> = {};
        const set = (entry.props ?? {}) as Record<string, unknown>;
        for (const name of propNames) {
          const value = set[name];
          if (value !== undefined) {
            props[name] = typeof value === 'string' ? value : null;
          }
        }
        return {
          elements: entry.elements.map((drawn) => ids.element(drawn)),
          props,
          // The same fiber, whichever of it and its alternate each side holds.
          picked:
            entry.owner === owner ||
            (isFiber(entry.owner) && entry.owner.alternate === owner),
        };
      }),
    };
  });
}
