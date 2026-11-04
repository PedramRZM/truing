// The layers tree: the page's elements, inside the components that drew
// them. Next's own components and those inside packages (Radix's Presence,
// FocusScope) are left out and their children lifted, so the tree reads as
// the project's JSX does. Server Components come from Flight's records on
// the fibers they rendered (`_debugInfo`).
import { type Fiber, getLatestFiber, isCompositeFiber } from 'bippy';

import {
  type RawFrame,
  resolveFrames,
  type SourceFrame,
} from '../../adapters/next';

import type { Ids } from './describe';
import {
  fiberOfElement,
  isFiber,
  nameOfFiber,
  type ServerInfo,
} from './fibers';
import { HIDDEN_ATTRIBUTE } from './marks';
import type { LayerLook, LayerNode } from './module';
import { parseStack } from './stacks';

/** Elements a designer never sees or styles. */
export const HIDDEN_TAGS = new Set([
  'script',
  'style',
  'link',
  'meta',
  'noscript',
  'template',
]);

/** How much of an element's text names its row. */
const TEXT_LENGTH = 40;

function shorten(value: string | null | undefined): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > TEXT_LENGTH
    ? `${text.slice(0, TEXT_LENGTH - 1).trimEnd()}…`
    : text;
}

/** The text of an element that holds only text (`<li>Beta</li>`), shortened; else null. */
export function textOf(element: Element): string | null {
  if (element.childElementCount > 0) return null;
  return shorten(element.textContent);
}

/** Its words, if any text sits directly in it: `<p>Read <b>this</b></p>` reads whole. */
function wordsOf(element: Element): string | null {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return shorten(element.textContent);
    }
  }
  return null;
}

/** Its image's alt or its accessible name, in the order browsers compute it. */
function labelOf(element: Element): string | null {
  const named =
    element
      .getAttribute('aria-labelledby')
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ') ||
    ['aria-label', 'alt', 'title', 'placeholder']
      .map((name) => element.getAttribute(name))
      .find(Boolean) ||
    (element as HTMLInputElement).labels?.[0]?.textContent ||
    // A button or link is named by what it holds.
    (element.matches('a,button,summary,[role=button],[role=link],[role=tab]')
      ? ((element.closest(`[${HIDDEN_ATTRIBUTE}]`)
          ? null // The eye hid it, and `innerText` skips what's hidden (TRU-3.7).
          : (element as HTMLElement).innerText) ?? element.textContent)
      : null);
  return shorten(named);
}

/** A computed colour with no alpha left: `rgba(0, 0, 0, 0)`, `oklch(… / 0)`. */
const CLEAR = /^rgba.*, 0\)$|\/ 0\)$/;
/** A computed length list with anything but zeros: `1px 0px`. */
const SOME = /[1-9]/;

/**
 * What the Design view needs that only the page knows. It runs on every
 * element of every rebuild, so each read waits until it can decide something:
 * layout and rects cost more than anything else here (TRU-3.6).
 */
export function lookOf(element: Element): LayerLook {
  const style = getComputedStyle(element);
  const { display } = style;
  const text = wordsOf(element) ?? undefined;
  // Words already make it something to show; a box can't add to that.
  const box =
    !text &&
    display !== 'contents' &&
    (!CLEAR.test(style.backgroundColor) ||
      style.backgroundImage !== 'none' ||
      style.boxShadow !== 'none' ||
      SOME.test(style.padding) ||
      SOME.test(style.borderWidth) ||
      SOME.test(style.gap));
  // A plain wrapper shows only through what it holds, so its size decides
  // nothing. These draw themselves, whatever elements they hold.
  let drawn = false;
  if (
    text ||
    box ||
    element.childElementCount === 0 ||
    element.matches('svg,video,select')
  ) {
    const { width, height } = element.getBoundingClientRect();
    // A visually hidden label is 1 by 1 and clipped; a hairline is longer.
    drawn =
      (width * height > 1 || display === 'contents') &&
      // The eye hid it (TRU-3.7): its row stays, so it can be shown again.
      (style.visibility !== 'hidden' ||
        element.closest(`[${HIDDEN_ATTRIBUTE}]`) !== null);
  }
  return {
    drawn,
    box,
    layout: display.endsWith('grid')
      ? 'grid'
      : display.endsWith('flex')
        ? style.flexDirection.startsWith('column')
          ? 'column'
          : 'row'
        : undefined,
    text,
    label: text ? undefined : (labelOf(element) ?? undefined),
    role: element.getAttribute('role') ?? undefined,
  };
}

/** Flight's records of the Server Components that returned this fiber. */
export function serverInfosOf(fiber: Fiber): ServerInfo[] {
  const info = (fiber as { _debugInfo?: unknown })._debugInfo;
  if (!Array.isArray(info)) return [];
  return info.filter(
    (entry): entry is ServerInfo =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as ServerInfo).name === 'string',
  );
}

function frameOf(stack: Error | null | undefined): RawFrame | null {
  return stack ? (parseStack(stack).frames[0] ?? null) : null;
}

export function* children(fiber: Fiber): Generator<Fiber> {
  for (let child = fiber.child; child; child = child.sibling) {
    yield getLatestFiber(child);
  }
}

/** The page's body as React holds it, or null before hydration. */
function bodyFiber(): Fiber | null {
  return document.body ? fiberOfElement(document.body) : null;
}

type DebugOwner = { _debugOwner?: Fiber | ServerInfo | null };

export type Layers = {
  nodes: LayerNode[];
  /** A component row selects its first element. */
  firstElement: Map<number, number>;
  /** Where a component row was used in the code. */
  sites: Map<number, SourceFrame>;
};

export async function buildLayers(ids: Ids): Promise<Layers> {
  const body = bodyFiber();
  if (!body) return { nodes: [], firstElement: new Map(), sites: new Map() };

  // First every component's frame, mapped in one go: which of them the
  // project wrote decides what the tree shows.
  const frames = new Map<object, RawFrame>();
  const visit = (fiber: Fiber): void => {
    if (isCompositeFiber(fiber)) {
      const frame = frameOf((fiber as { _debugStack?: Error })._debugStack);
      if (frame) frames.set(fiber, frame);
    }
    for (const info of serverInfosOf(fiber)) {
      const frame = frameOf(info.debugStack);
      if (frame) frames.set(info, frame);
    }
    // One thing each component wrote, once per component: it says whether the
    // component's own JSX is the project's, or a package's (`Link`, an icon).
    const owner = (fiber as DebugOwner)._debugOwner;
    if (isFiber(owner) && !frames.has(owner.type)) {
      const frame = frameOf((fiber as { _debugStack?: Error })._debugStack);
      if (frame) frames.set(owner.type, frame);
    }
    for (const child of children(fiber)) visit(child);
  };
  visit(body);

  const owners = [...frames.keys()];
  const mapped = await resolveFrames(
    owners.map((owner) => frames.get(owner) as RawFrame),
  );
  const ours = new Map<object, SourceFrame>();
  owners.forEach((owner, index) => {
    const at = mapped[index];
    if (at && !at.ignored) ours.set(owner, at);
  });

  // One answer per owner: a list's rows all ask about the same one, and
  // `getLatestFiber` walks from the root once a fiber has re-rendered.
  const owned = new Map<object, number | undefined>();
  /** The nearest component above a fiber or Server Component whose own JSX is the project's. */
  const ownerOf = (start: Fiber | ServerInfo): number | undefined => {
    const above = (at: Fiber | ServerInfo) =>
      isFiber(at) ? (at as DebugOwner)._debugOwner : at.owner;
    const first = above(start);
    if (!first) return undefined;
    if (owned.has(first)) return owned.get(first);
    let found: number | undefined;
    for (let at: typeof first | null | undefined = first; at; at = above(at)) {
      if (!isFiber(at)) {
        if (ours.has(at)) {
          found = ids.object(at);
          break;
        }
        continue;
      }
      at = getLatestFiber(at);
      if (ours.has(at) && ours.has(at.type)) {
        found = ids.fiber(at);
        break;
      }
    }
    owned.set(first, found);
    return found;
  };

  const firstElement = new Map<number, number>();
  const firstOf = (nodes: readonly LayerNode[]): number | null => {
    for (const node of nodes) {
      if (node.kind === 'element') return node.id;
      const inner = firstElement.get(node.id);
      if (inner !== undefined) return inner;
    }
    return null;
  };
  const sites = new Map<number, SourceFrame>();
  const wrap = (
    from: object,
    id: number,
    name: string,
    kind: 'client' | 'server',
    owner: number | undefined,
    inner: LayerNode[],
  ): LayerNode => {
    const first = firstOf(inner);
    if (first !== null) firstElement.set(id, first);
    const site = ours.get(from);
    if (site) sites.set(id, site);
    return { id, name, kind, owner, children: inner };
  };

  const build = (fiber: Fiber): LayerNode[] => {
    const inner: LayerNode[] = [];
    for (const child of children(fiber)) {
      for (const node of build(child)) {
        // Siblings rendered by one Server Component share its row.
        const last = inner.at(-1);
        if (
          node.kind === 'server' &&
          last?.kind === 'server' &&
          last.id === node.id
        ) {
          last.children.push(...node.children);
          continue;
        }
        inner.push(node);
      }
    }

    let nodes: LayerNode[] = inner;
    if (typeof fiber.type === 'string' && fiber.stateNode instanceof Element) {
      if (HIDDEN_TAGS.has(fiber.type)) return [];
      const text = textOf(fiber.stateNode);
      nodes = [
        {
          id: ids.element(fiber.stateNode),
          name: fiber.type,
          kind: 'element',
          ...(text ? { text } : {}),
          owner: ownerOf(fiber),
          // An icon's paths aren't rows of their own.
          look:
            fiber.stateNode instanceof SVGElement && fiber.type !== 'svg'
              ? undefined
              : lookOf(fiber.stateNode),
          children: inner,
        },
      ];
    } else if (isCompositeFiber(fiber) && ours.has(fiber)) {
      nodes = [
        wrap(
          fiber,
          ids.fiber(fiber),
          nameOfFiber(fiber),
          'client',
          ownerOf(fiber),
          inner,
        ),
      ];
    }

    // Flight lists the Server Components outermost first.
    const infos = serverInfosOf(fiber).filter((info) => ours.has(info));
    for (const info of infos.reverse()) {
      nodes = [
        wrap(
          info,
          ids.object(info),
          info.name ?? 'Anonymous',
          'server',
          ownerOf(info),
          nodes,
        ),
      ];
    }
    return nodes;
  };

  return { nodes: build(body), firstElement, sites };
}
