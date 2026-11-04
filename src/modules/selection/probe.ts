import { forgetFrames } from '../../adapters/next';
import { defineProbe } from '../../module';
import { MODES } from '../../protocol';

import {
  classesOf,
  createIds,
  describe,
  findIdentity,
  type Identity,
  identityOf,
  resolveChain,
} from './describe';
import { chainOf, fiberOfElement } from './fibers';
import { createHoverIntent } from './hover-intent';
import { createInlineText } from './inline-text';
import { instancesOf } from './instances';
import {
  buildLayers,
  HIDDEN_TAGS,
  type Layers,
  lookOf,
  textOf,
} from './layers';
import { createMarks } from './marks';
import selection, { type Selection } from './module';
import { createOverlay } from './overlay';
import { onFastRefresh } from './refresh';
import { similarTo } from './similar';
import type { SpacingClass } from './spacing-tokens';

/** How long the page must be quiet before the tree is rebuilt. */
const LAYERS_QUIET_MS = 400;
/**
 * How long the pointer must rest on an element before its component is looked
 * up. A sweep across the page outlines everything it passes, and names only
 * what it stops on.
 */
const NAME_AFTER_MS = 60;
/** How long a restore waits for the element to appear after a reload. */
const RESTORE_WAIT_MS = 10_000;

/** A path or a group inside an `<svg>` is the icon: it resolves to the `<svg>`. */
function resolveSvg(element: Element): Element {
  if (element instanceof SVGElement && !(element instanceof SVGSVGElement)) {
    return element.closest('svg') ?? element;
  }
  return element;
}

const MEDIA_TAGS = new Set(['img', 'picture', 'video', 'canvas', 'svg']);
const CONTROL_TAGS = new Set([
  'input',
  'textarea',
  'select',
  'button',
  'iframe',
]);

/**
 * An image, or an empty box, laid over content that isn't its own: a page's
 * background picture, a gradient. The browser hands it every click there
 * (a chat page's background can cover the logo, the tagline and the
 * disclaimer), but the designer is pointing at what shows through it.
 */
function isVeil(element: Element, below: Element): boolean {
  if (below.contains(element)) return false;
  // A logo over its card's gradient is what it looks like: only a layer that
  // covers what is under it is a veil.
  if (!covers(element, below)) return false;
  const tag = element.tagName.toLowerCase();
  if (MEDIA_TAGS.has(tag)) return true;
  return (
    !CONTROL_TAGS.has(tag) &&
    element.childElementCount === 0 &&
    !(element.textContent ?? '').trim()
  );
}

/** Half a pixel either way still counts: rounding, not layout. */
function covers(outer: Element, inner: Element): boolean {
  const a = outer.getBoundingClientRect();
  const b = inner.getBoundingClientRect();
  return (
    b.left >= a.left - 0.5 &&
    b.top >= a.top - 0.5 &&
    b.right <= a.right + 0.5 &&
    b.bottom <= a.bottom + 0.5
  );
}

function containsPoint(element: Element, x: number, y: number): boolean {
  if (getComputedStyle(element).visibility === 'hidden') return false;
  return [...element.getClientRects()].some(
    (rect) =>
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
  );
}

/** Whether a layer's lock covers an element: a pick falls through it (TRU-3.7). */
type IsLocked = (element: Element) => boolean;

/** The browser's hit test at a point, top first, without our overlay, `<html>` or what's locked. */
function browserStack(x: number, y: number, locked: IsLocked): Element[] {
  return document
    .elementsFromPoint(x, y)
    .filter(
      (element) =>
        element.nodeName !== 'TRUING-OVERLAY' &&
        element !== document.documentElement &&
        !locked(element),
    );
}

/**
 * The element drawn under a point, as the designer sees it. The browser's own
 * hit test skips `pointer-events: none`, so a disabled Button (shadcn sets it)
 * hands its click to the row around it; this goes down to the element drawn
 * there, the last child on top. It stops at an icon inside a control: the
 * click picks the Button, and Enter goes in to its icon.
 */
function elementAt(x: number, y: number, locked: IsLocked): Element | null {
  const stack = browserStack(x, y, locked);
  const top = stack.find((element, index) => {
    const below = stack[index + 1];
    return !below || !isVeil(element, below);
  });
  if (!top) return null;
  return resolveSvg(drawnChildren(top, x, y, false, locked).at(-1) ?? top);
}

/**
 * The children drawn at a point inside an element that the browser skipped
 * for `pointer-events: none`, outermost first, the last child on top of its
 * siblings; with `icons` false it stops at an `<svg>`.
 */
function drawnChildren(
  parent: Element,
  x: number,
  y: number,
  icons: boolean,
  locked: IsLocked,
): Element[] {
  const found: Element[] = [];
  for (let at: Element | undefined = parent; at;) {
    at = [...at.children]
      .reverse()
      .find(
        (child) =>
          (icons || !(child instanceof SVGElement)) &&
          !locked(child) &&
          getComputedStyle(child).pointerEvents === 'none' &&
          containsPoint(child, x, y),
      );
    if (at) found.push(at);
  }
  return found;
}

/**
 * Every element drawn at a point, top first, for Select layer (TRU-2.4): the
 * browser's stack, with the children it skips for `pointer-events: none`
 * above their parent (a disabled Button and its icon), and an `<svg>`'s
 * paths as the `<svg>`.
 */
function stackAt(x: number, y: number, locked: IsLocked): Element[] {
  const stack = new Set<Element>();
  for (const element of browserStack(x, y, locked)) {
    for (const drawn of [
      ...drawnChildren(element, x, y, true, locked).reverse(),
      element,
    ]) {
      stack.add(resolveSvg(drawn));
    }
  }
  return [...stack];
}

/** An element the keys can move the pick to: drawn, and not a script or our overlay. */
function navigable(element: Element): boolean {
  if (HIDDEN_TAGS.has(element.tagName.toLowerCase())) return false;
  if (element.nodeName === 'TRUING-OVERLAY') return false;
  return element.getClientRects().length > 0;
}

function sibling(element: Element, step: 'next' | 'previous'): Element | null {
  let at =
    step === 'next'
      ? element.nextElementSibling
      : element.previousElementSibling;
  while (at && !navigable(at)) {
    at = step === 'next' ? at.nextElementSibling : at.previousElementSibling;
  }
  return at;
}

/** Enter, ⇧Enter, Tab and ⇧Tab from the pick: its first child, parent, next and previous sibling. */
function stepFrom(
  element: Element,
  to: 'child' | 'parent' | 'next' | 'previous',
): Element | null {
  switch (to) {
    case 'child':
      // An <svg> is a leaf: its paths aren't picked on their own.
      if (element instanceof SVGSVGElement) return null;
      return [...element.children].find(navigable) ?? null;
    case 'parent': {
      const parent = element.parentElement;
      return parent && parent !== document.documentElement ? parent : null;
    }
    case 'next':
    case 'previous':
      return sibling(element, to);
  }
}

/** The colour behind an element; null when an image is, or nothing paints one. */
function backdropOf(element: Element): string | null {
  for (let at = element.parentElement; at; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (style.backgroundImage !== 'none') return null;
    const colour = style.backgroundColor;
    if (!/^transparent$|, 0\)$/.test(colour)) return colour;
  }
  return null;
}

export default defineProbe(selection, (ctx) => {
  const ids = createIds();
  const marks = createMarks(ids, (view) => ctx.report('marks', view));
  /**
   * A lock, what's inside it, and a plain wrapper around nothing but a lock:
   * it looks the same, and the Design view shows it as the lock's own row, so
   * a pick landing on it would seem not to have fallen through.
   */
  const fallsThrough: IsLocked = (element) => {
    if (marks.isLocked(element)) return true;
    if (!marks.hasLocks()) return false;
    for (let at: Element | null = element; at?.childElementCount === 1;) {
      const look = lookOf(at);
      if (look.box || look.text) return false;
      at = at.firstElementChild;
      if (at && marks.isLocked(at)) return true;
    }
    return false;
  };
  const pointAt = (x: number, y: number): Element | null =>
    elementAt(x, y, fallsThrough);
  // Each element's classes that read a spacing token, once the server has said.
  const spacing = new Map<number, readonly SpacingClass[]>();
  const overlay = createOverlay({
    spacingClasses: (element) => spacing.get(ids.element(element)) ?? [],
  });
  overlay.scale(ctx.view().scale);
  let hovered: Element | null = null;
  let picked: Element | null = null;
  let identity: Identity | null = null;
  let layers: Layers = { nodes: [], firstElement: new Map(), sites: new Map() };
  // The component each element's label names, once the server has said.
  const names = new Map<number, string | null>();
  // Alt held at the last pointer move: the overlay measures to the hover.
  let altHeld = false;
  /** Hovering shows the box model and the distances: Spacing is on, or Alt is held. */
  const measuring = (): boolean => altHeld || ctx.view().spacing;

  function labelOf(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const component = names.get(ids.element(element));
    return component ? `${tag} · ${component}` : tag;
  }
  // Each pick or reload bumps it, so a slow lookup never reports over a newer one.
  let generation = 0;

  const sent = new Map<string, string>();
  /** Sends a report only when it says something new: each one has panels read the page. */
  const reportNews: typeof ctx.report = (name, payload) => {
    const text = JSON.stringify(payload);
    if (sent.get(name) === text) return;
    sent.set(name, text);
    ctx.report(name, payload);
  };

  function reportOverPick(): void {
    reportNews(
      'overPick',
      picked && hovered === picked ? ids.element(picked) : null,
    );
  }

  const pick = ctx.guard((element: Element | null) => {
    // A new pick's instances are the inspector's to outline again (TRU-2.2);
    // the same pick keeps them.
    if (element !== picked) overlay.instances([]);
    picked = element;
    identity = element ? identityOf(element) : null;
    overlay.picked(element, element ? labelOf(element) : null);
    reportOverPick();
    const current = ++generation;
    if (!element) {
      reportNews('selected', null);
      return;
    }
    void describe(element, ids).then(
      ctx.guard((described: Selection) => {
        if (current === generation) reportNews('selected', described);
      }),
    );
  });

  /**
   * The hover label: the tag at once, and the component once the server has
   * named it from the mapped chain, by the same rule as the inspector.
   */
  let naming: ReturnType<typeof setTimeout> | undefined;
  const label = ctx.guard((element: Element) => {
    overlay.hover(element, labelOf(element));
    clearTimeout(naming);
    naming = setTimeout(
      ctx.guard(() => {
        const fiber = fiberOfElement(element);
        if (!fiber) return;
        const id = ids.element(element);
        void resolveChain(chainOf(fiber)).then(
          ctx.guard((chain) => {
            if (hovered !== element || ctx.mode() !== MODES.select) return;
            ctx.report('hovered', { id, chain, classes: classesOf(element) });
          }),
        );
      }),
      NAME_AFTER_MS,
    );
  });

  const intent = createHoverIntent<Element>({
    contains: (ancestor, node) => ancestor.contains(node),
    apply: ctx.guard((element: Element | null) => {
      hovered = element;
      reportOverPick();
      if (element) label(element);
      else overlay.hover(null, null);
    }),
  });

  ctx.listen(
    'pointermove',
    (event) => {
      if (ctx.mode() !== MODES.select) return;
      altHeld = event.altKey;
      intent.move(pointAt(event.clientX, event.clientY));
      // Alt pressed or let go over the same element.
      overlay.measuring(measuring());
    },
    { capture: true, passive: true },
  );
  // Alt can be let go out of sight of this frame: leaving it ends the measure.
  ctx.listen(
    'pointerout',
    (event) => {
      if (event.relatedTarget) return;
      altHeld = false;
      overlay.measuring(measuring());
    },
    { capture: true, passive: true },
  );
  ctx.listen('scroll', overlay.redraw, { capture: true, passive: true });
  ctx.listen('resize', () => {
    overlay.redraw();
    // What's drawn depends on the width: `hidden md:flex` (TRU-3.6).
    soon();
  });
  ctx.onView((view) => {
    overlay.scale(view.scale);
    overlay.measuring(measuring());
  });
  const inline = createInlineText({
    onCommit: ctx.guard((element: Element, text: string, before: string) => {
      ctx.report('edited', { id: ids.element(element), text, before });
    }),
  });
  // A double-click on an element that holds only text edits it in place.
  ctx.onDoubleClick((event) => {
    const element = pointAt(event.clientX, event.clientY);
    if (!element) return;
    if (element !== picked) pick(element);
    inline.start(element);
  });

  ctx.onPick((event) => {
    const element = pointAt(event.clientX, event.clientY);
    // Select stops the mousedown, so focus stays: a pick elsewhere keeps the typed text.
    if (inline.editing() && element !== inline.editing()) inline.commit();
    // Shift+click while measuring keeps the measurement on screen; the pick stays.
    if (event.shiftKey && (event.altKey || ctx.view().spacing) && element) {
      if (overlay.pin(element)) return;
    }
    pick(element);
  });
  // A right-click picks what is under it; the shell opens its menu for it.
  ctx.onContextMenu((event) => {
    const element = pointAt(event.clientX, event.clientY);
    if (element !== picked) pick(element);
  });
  // Esc clears the pinned measurements first, then the pick.
  ctx.onEscape(() => {
    if (overlay.clearPins()) return true;
    if (!picked) return false;
    pick(null);
    return true;
  });
  ctx.onMode((mode) => {
    inline.commit();
    hovered = null;
    reportOverPick();
    altHeld = false;
    intent.reset();
    overlay.hover(null, null);
    overlay.measuring(measuring());
    // Interact is the app's own: nothing of Select's stays on it.
    if (mode === MODES.interact) {
      overlay.clearPins();
      if (picked) pick(null);
    }
  });

  // The tree, and the pick, follow the page: after a hot reload React may
  // replace the picked node, or change its classes.
  let rebuild: ReturnType<typeof setTimeout> | null = null;
  const refresh = ctx.guard(() => {
    rebuild = null;
    // The page changed: a hot reload may have moved code under the same
    // URLs, so Next is asked again (cheap). Chunk maps go on Fast Refresh.
    forgetFrames({ chunkMaps: false });
    overlay.redraw();
    if (picked && !picked.isConnected && identity) {
      pick(findIdentity(identity));
    } else if (picked) {
      const element = picked;
      const current = generation;
      void describe(element, ids).then(
        ctx.guard((described: Selection) => {
          if (current === generation && picked === element) {
            reportNews('selected', described);
          }
        }),
      );
    }
    void buildLayers(ids).then(
      ctx.guard((built: Layers) => {
        layers = built;
        marks.sync();
        // Most changes to a page (a class, a state) don't change its tree.
        reportNews('layers', {
          href: location.href.split('#')[0] ?? location.href,
          nodes: built.nodes,
        });
      }),
    );
  });
  const soon = (): void => {
    if (rebuild) clearTimeout(rebuild);
    rebuild = setTimeout(refresh, LAYERS_QUIET_MS);
  };
  const observer = new MutationObserver(
    ctx.guard((records: MutationRecord[]) => {
      // Our own overlay is outside React's tree; its changes don't count.
      const ours = records.every(
        (record) =>
          record.target.nodeName === 'TRUING-OVERLAY' ||
          [...record.addedNodes].some(
            (node) => node.nodeName === 'TRUING-OVERLAY',
          ),
      );
      if (!ours) soon();
    }),
  );
  onFastRefresh(
    ctx.guard(() => {
      forgetFrames({ chunkMaps: true });
      soon();
    }),
  );
  // An image has no size until it loads (TRU-3.6); this fires for each, not for the page.
  ctx.listen('load', soon, { capture: true });
  // Another frame on the same route locked or unlocked something.
  ctx.listen('storage', ctx.guard(marks.sync));
  ctx.listen('load', () => {
    soon();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      // Not `style`: an animation would keep the rebuild waiting for quiet.
      attributeFilter: ['class', 'hidden', 'data-state'],
    });
  });

  function elementFor(id: number): Element | null {
    return ids.lookup(layers.firstElement.get(id) ?? id);
  }

  return {
    commands: {
      select: ({ id }) => {
        const element = elementFor(id);
        if (!element) return false;
        pick(element);
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return true;
      },
      deselect: () => {
        const had = picked !== null;
        pick(null);
        return had;
      },
      label: ({ id, component }) => {
        names.set(id, component);
        let shown = false;
        if (hovered && ids.element(hovered) === id) {
          overlay.hover(hovered, labelOf(hovered));
          shown = true;
        }
        if (picked && ids.element(picked) === id) {
          overlay.picked(picked, labelOf(picked));
          shown = true;
        }
        return shown;
      },
      spacing: ({ id, classes }) => {
        spacing.set(id, classes);
        const shown =
          (hovered !== null && ids.element(hovered) === id) ||
          (picked !== null && ids.element(picked) === id);
        if (shown) overlay.redraw();
        return shown;
      },
      instances: ({ id, link, props }) => {
        const element = ids.lookup(id);
        return element ? instancesOf(element, link, props, ids) : null;
      },
      similar: async ({ id }) => {
        const element = ids.lookup(id);
        if (!element) return null;
        return Promise.all(similarTo(element).map((at) => describe(at, ids)));
      },
      computed: ({ id, properties }) => {
        const element = id === null ? document.body : ids.lookup(id);
        if (!element) return null;
        const [own = {}, parent = {}] = [
          element,
          element.parentElement ?? element,
        ].map((at) => {
          const style = getComputedStyle(at);
          return Object.fromEntries(
            properties.map((name) => [name, style.getPropertyValue(name)]),
          );
        });
        const box = element.getBoundingClientRect();
        return {
          own,
          parent,
          backdrop: backdropOf(element),
          width: box.width,
          height: box.height,
          classes: classesOf(element),
          src: element instanceof HTMLImageElement ? element.currentSrc : null,
        };
      },
      outline: ({ ids: wanted }) => {
        const elements = wanted.flatMap((id) => {
          const element = ids.lookup(id);
          return element ? [element] : [];
        });
        overlay.instances(elements);
        return elements.length;
      },
      highlight: ({ id }) => {
        const element = id === null ? null : elementFor(id);
        hovered = element;
        intent.reset(element);
        overlay.hover(element, element ? labelOf(element) : null);
        return element !== null;
      },
      current: () => (picked ? ids.element(picked) : null),
      mark: ({ kind, ids: wanted, on }) => marks.set(kind, wanted, on),
      'clear-marks': () => marks.clear(),
      chain: ({ id }) => {
        // A component's row is where the component is used, not its first element.
        const at = layers.sites.get(id);
        if (at) {
          return [
            {
              name: '',
              kind: 'client' as const,
              env: null,
              at,
              unmapped: false,
              capped: false,
              props: { status: 'none' as const },
            },
          ];
        }
        const element = elementFor(id);
        const fiber = element && fiberOfElement(element);
        return fiber ? resolveChain(chainOf(fiber)) : null;
      },
      stackAt: ({ x, y }) =>
        stackAt(x, y, fallsThrough).map((element) => ({
          id: ids.element(element),
          tag: element.tagName.toLowerCase(),
          text: textOf(element),
        })),
      navigate: ({ to }) => {
        if (!picked?.isConnected) return false;
        const next = stepFrom(picked, to);
        if (!next) return false;
        pick(next);
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return true;
      },
      restore: (wanted) =>
        new Promise<boolean>((resolve) => {
          const started = Date.now();
          const attempt = (): void => {
            // Never in Interact, and never over a pick made since (a stuck
            // pick). A pick a reload detached doesn't count.
            if (ctx.mode() !== MODES.select || picked?.isConnected) {
              resolve(false);
              return;
            }
            const element = findIdentity(wanted);
            if (element) {
              pick(element);
              resolve(true);
              return;
            }
            if (Date.now() - started > RESTORE_WAIT_MS) {
              resolve(false);
              return;
            }
            setTimeout(ctx.guard(attempt), 200);
          };
          attempt();
        }),
    },
  };
});
