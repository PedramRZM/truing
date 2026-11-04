// Hide and lock (TRU-3.7): what a designer does to the preview to work on it. The
// panel reads them from a report; nothing stages them, so they never reach the
// source, the Changes tray or a PR.
//
// A hide lasts until the page changes, or until React replaces the element. A
// lock lasts per route for the session, so it is kept by identity: a reload
// gives every element a new id.
import * as z from 'zod/mini';

import { findIdentity, type Identity, identityOf, type Ids } from './describe';
import { identity } from './module';

export const HIDDEN_ATTRIBUTE = 'data-truing-hidden';

const STORAGE_PREFIX = 'truing:locks:';
const storedLocks = z.array(identity);

function readLocks(route: string): Identity[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_PREFIX + route);
    if (!stored) return [];
    const parsed = z.safeParse(storedLocks, JSON.parse(stored) as unknown);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Without storage, a lock still holds until the page reloads. */
function writeLocks(route: string, locks: readonly Identity[]): void {
  try {
    if (locks.length === 0) sessionStorage.removeItem(STORAGE_PREFIX + route);
    else sessionStorage.setItem(STORAGE_PREFIX + route, JSON.stringify(locks));
  } catch {
    // Storage is full or refused: see above.
  }
}

export type MarksView = { hidden: number[]; locked: number[] };

export function createMarks(ids: Ids, report: (view: MarksView) => void) {
  const hidden = new Set<Element>();
  // Each stored lock's element on the page now, kept while it stays connected:
  // finding one reads the owners of every element with its tag.
  const found = new Map<string, Element>();
  let locked: Element[] = [];
  let route = location.pathname;
  // A query can be another page of the same route (`?tab=`): a hide ends there.
  let page = location.pathname + location.search;
  let lastReport = '';

  // Adopted rather than a <style>, so the page's DOM gains nothing but the
  // attribute. `*` too: a child's own `visibility: visible` must not show through.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(
    `[${HIDDEN_ATTRIBUTE}],[${HIDDEN_ATTRIBUTE}] *{visibility:hidden!important}`,
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  function show(element: Element): void {
    element.removeAttribute(HIDDEN_ATTRIBUTE);
    hidden.delete(element);
  }

  /**
   * The tree rebuilds only once the page is quiet, so a mark can come before
   * that rebuild: it must not count as the last page's, or land on its route.
   */
  function followPage(): void {
    const now = location.pathname + location.search;
    if (now !== page) {
      page = now;
      [...hidden].forEach(show);
    }
    if (location.pathname !== route) {
      route = location.pathname;
      found.clear();
    }
  }

  function resolveLocks(): void {
    const next: Element[] = [];
    const seen = new Set<string>();
    for (const lock of readLocks(route)) {
      const key = JSON.stringify(lock);
      seen.add(key);
      const known = found.get(key);
      const element = known?.isConnected ? known : findIdentity(lock);
      if (!element) {
        found.delete(key);
        continue;
      }
      found.set(key, element);
      next.push(element);
    }
    for (const key of found.keys()) {
      if (!seen.has(key)) found.delete(key);
    }
    locked = next;
  }

  function send(): void {
    const view: MarksView = {
      hidden: [...hidden].map((element) => ids.element(element)),
      locked: locked.map((element) => ids.element(element)),
    };
    const text = JSON.stringify(view);
    if (text === lastReport) return;
    lastReport = text;
    report(view);
  }

  function setLocked(elements: readonly Element[], on: boolean): void {
    const wanted = elements.flatMap((element) => {
      const known = [...found].find(([, value]) => value === element);
      if (known) return [known[0]];
      const own = identityOf(element);
      return own ? [JSON.stringify(own)] : [];
    });
    const stored = readLocks(route);
    const others = stored.filter(
      (lock) => !wanted.includes(JSON.stringify(lock)),
    );
    writeLocks(
      route,
      on
        ? [...others, ...wanted.map((key) => JSON.parse(key) as Identity)]
        : others,
    );
  }

  return {
    /** Whether a lock covers an element: the locked one or anything inside it. */
    isLocked: (element: Element): boolean =>
      locked.some((lock) => lock.contains(element)),

    hasLocks: (): boolean => locked.length > 0,

    set(kind: 'hidden' | 'locked', wanted: readonly number[], on: boolean) {
      followPage();
      const elements = wanted.flatMap((id) => {
        const element = ids.lookup(id);
        return element ? [element] : [];
      });
      if (elements.length === 0) return false;
      if (kind === 'locked') {
        setLocked(elements, on);
        resolveLocks();
      } else {
        for (const element of elements) {
          if (on) {
            element.setAttribute(HIDDEN_ATTRIBUTE, '');
            hidden.add(element);
          } else {
            show(element);
          }
        }
      }
      send();
      return true;
    },

    clear(): boolean {
      followPage();
      const had = hidden.size > 0 || locked.length > 0;
      [...hidden].forEach(show);
      writeLocks(route, []);
      resolveLocks();
      send();
      return had;
    },

    /** After the page changed: follows the route, and locked elements React replaced. */
    sync(): void {
      followPage();
      for (const element of hidden) {
        if (!element.isConnected) hidden.delete(element);
      }
      resolveLocks();
      send();
    },
  };
}
