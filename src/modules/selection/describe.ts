// What the probe knows about one element: its owner chain with every frame
// mapped through Next, its classes, and the ids the layers tree shares.
import type { Fiber } from 'bippy';

import { resolveFrames } from '../../adapters/next';

import {
  type ChainLink,
  chainOf,
  fiberOfElement,
  hydratedFiberOf,
  ownerNames,
} from './fibers';
import type { Link, Selection } from './module';

/** Ids for the page's elements and components, stable while they live. */
export function createIds() {
  let next = 1;
  const ofObject = new WeakMap<object, number>();
  const elements = new Map<number, WeakRef<Element>>();

  return {
    /** An element's id, made on first use. */
    element(element: Element): number {
      const known = ofObject.get(element);
      if (known) return known;
      const id = next++;
      ofObject.set(element, id);
      elements.set(id, new WeakRef(element));
      return id;
    },
    /** A component's id: a fiber and its alternate share one. */
    fiber(fiber: Fiber): number {
      const known =
        ofObject.get(fiber) ??
        (fiber.alternate ? ofObject.get(fiber.alternate) : undefined);
      if (known) return known;
      const id = next++;
      ofObject.set(fiber, id);
      return id;
    },
    /** A Server Component's record, which has no fiber of its own. */
    object(value: object): number {
      const known = ofObject.get(value);
      if (known) return known;
      const id = next++;
      ofObject.set(value, id);
      return id;
    },
    lookup(id: number): Element | null {
      const element = elements.get(id)?.deref();
      if (!element?.isConnected) {
        elements.delete(id);
        return null;
      }
      return element;
    },
  };
}
export type Ids = ReturnType<typeof createIds>;

/**
 * A selector that finds only this element on the page now: its id when that
 * is unique, else tags with `:nth-of-type` from the element up, as few as it
 * takes.
 */
export function selectorOf(element: Element): string {
  const parts: string[] = [];
  for (
    let at: Element | null = element;
    at && at !== document.documentElement;
    at = at.parentElement
  ) {
    if (at.id) {
      const byId = `#${CSS.escape(at.id)}`;
      if (document.querySelectorAll(byId).length === 1) {
        parts.unshift(byId);
        return parts.join(' > ');
      }
    }
    const tag = at.tagName.toLowerCase();
    const same = at.parentElement
      ? [...at.parentElement.children].filter(
          (other) => other.tagName === at?.tagName,
        )
      : [];
    parts.unshift(
      same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(at) + 1})` : tag,
    );
    const selector = parts.join(' > ');
    if (document.querySelectorAll(selector).length === 1) return selector;
  }
  return parts.join(' > ');
}

export function classesOf(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

/** Maps each link's frame through Next, in one request per environment. */
export async function resolveChain(
  chain: readonly ChainLink[],
): Promise<Link[]> {
  const withFrames = chain.flatMap((link) => (link.frame ? [link.frame] : []));
  const mapped = await resolveFrames(withFrames);
  let index = 0;
  return chain.map((link): Link => {
    const at = link.frame ? (mapped[index++] ?? null) : null;
    return {
      name: link.name,
      kind: link.kind,
      env: link.env,
      at,
      unmapped: link.frame !== null && at === null,
      capped: link.capped,
      props: link.props,
    };
  });
}

/** An element's text when it holds only text, as the page shows it; null otherwise. */
function textOf(element: Element): string | null {
  if (element.children.length > 0) return null;
  const text = element.textContent ?? '';
  return text.trim() === '' ? null : text;
}

export async function describe(element: Element, ids: Ids): Promise<Selection> {
  const fiber = await hydratedFiberOf(element);
  const base = {
    id: ids.element(element),
    href: location.href.split('#')[0] ?? location.href,
    identity: fiber ? identityOf(element) : null,
    tag: element.tagName.toLowerCase(),
    classes: classesOf(element),
    selector: selectorOf(element),
    text: textOf(element),
    width: window.innerWidth,
  };
  if (!fiber) return { ...base, react: false, chain: [] };
  return { ...base, react: true, chain: await resolveChain(chainOf(fiber)) };
}

/**
 * What says "this is the same element" across a hot reload, when React may
 * have replaced the node: its tag, its owners' names, and which one it is
 * among the page's elements with both.
 */
export type Identity = { tag: string; owners: string[]; index: number };

const IDENTITY_OWNERS = 12;

function ownersOf(element: Element): string[] | null {
  const fiber = fiberOfElement(element);
  if (!fiber) return null;
  return ownerNames(fiber, IDENTITY_OWNERS);
}

function sameOwners(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

export function identityOf(element: Element): Identity | null {
  const owners = ownersOf(element);
  if (!owners) return null;
  const tag = element.tagName.toLowerCase();
  let index = 0;
  for (const other of document.getElementsByTagName(tag)) {
    if (other === element) return { tag, owners, index };
    const otherOwners = ownersOf(other);
    if (otherOwners && sameOwners(otherOwners, owners)) index++;
  }
  return null;
}

/** The element an identity names on the page now, if it still exists. */
export function findIdentity(identity: Identity): Element | null {
  let index = 0;
  for (const element of document.getElementsByTagName(identity.tag)) {
    const owners = ownersOf(element);
    if (!owners || !sameOwners(owners, identity.owners)) continue;
    if (index === identity.index) return element;
    index++;
  }
  return null;
}
