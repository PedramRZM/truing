// The elements like the pick on the page (TRU-4.5): the same place in each of the
// repeated things around it. A card's icon, in every card of a list; a tab, among
// the tabs beside it, whether a `.map()` drew them or they were written by hand.
// It goes by the page's structure, so it doesn't matter how the code drew them.
import { classesOf } from './describe';

/** How far up a repeated thing is looked for: past that it's the page's sections. */
const MAX_LEVELS = 6;
/** Each one takes a lookup to place it in the code. */
const MAX_FOUND = 60;
/** How much of two class lists must agree. */
const ALIKE = 0.5;

/** Whether two class lists look like the same thing, states and sizes aside. */
export function alikeClasses(
  a: readonly string[],
  b: readonly string[],
): boolean {
  const own = (list: readonly string[]): Set<string> =>
    new Set(list.filter((name) => !name.includes(':')));
  const left = own(a);
  const right = own(b);
  if (left.size === 0 && right.size === 0) return true;
  let shared = 0;
  for (const name of left) if (right.has(name)) shared += 1;
  return shared / new Set([...left, ...right]).size >= ALIKE;
}

const alike = (a: Element, b: Element): boolean =>
  a.tagName === b.tagName && alikeClasses(classesOf(a), classesOf(b));

type Step = { tag: string; index: number };

const sameTag = (parent: Element, tag: string): Element[] =>
  [...parent.children].filter((child) => child.tagName === tag);

/** The element a path of steps leads to, from another copy of what it starts in. */
function follow(start: Element, path: readonly Step[]): Element | null {
  let at: Element | undefined = start;
  for (const { tag, index } of path) {
    at = at && sameTag(at, tag)[index];
  }
  return at ?? null;
}

/** The elements like this one, in the nearest thing that repeats: none when nothing around it does. */
export function similarTo(element: Element): Element[] {
  const path: Step[] = [];
  let at = element;
  for (let level = 0; level < MAX_LEVELS; level += 1) {
    const parent = at.parentElement;
    if (!parent || parent === document.documentElement) return [];
    const copies = [...parent.children].filter(
      (other) => other !== at && alike(other, at),
    );
    const found = copies.flatMap((copy) => {
      const target = follow(copy, path);
      return target &&
        alike(target, element) &&
        target.getClientRects().length > 0
        ? [target]
        : [];
    });
    if (found.length > 0) return found.slice(0, MAX_FOUND);
    if (parent === document.body) return [];
    path.unshift({
      tag: at.tagName,
      index: sameTag(parent, at.tagName).indexOf(at),
    });
    at = parent;
  }
  return [];
}
