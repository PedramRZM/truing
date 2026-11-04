// The preview of the staged changes (TRU-4.1): for each change, CSS scoped to
// its element that sets what the added classes set and unsets what the
// removed ones did, plus the new text of a text edit. It goes into an
// unlayered stylesheet, so it beats Tailwind's layered utilities without
// touching the app's DOM or its source.
import { type Merge, mergeList } from '../../edits/classes';
import type { DraftChange, StagedChange } from '../../module';

import type { PreviewRule } from './module';

export type PreviewDeps = {
  merge: Merge;
  /** Tailwind's CSS for one class, or null when it isn't one. */
  css: (className: string) => string | null;
  /** A variant's classes before and after a switch, from its cva config. */
  variant: (change: StagedChange) => Promise<{
    before: string[];
    after: string[];
  } | null>;
};

/** A class name as Tailwind writes it in a selector: `md\:px-500`, `w-1\/2`. */
export function escapeClass(name: string): string {
  const escaped = name.replace(
    /[^a-zA-Z0-9_-]/g,
    (character) => `\\${character}`,
  );
  // An identifier can't start with a digit: CSS writes it as its code point.
  return /^[0-9]/.test(escaped)
    ? `\\3${escaped.charAt(0)} ${escaped.slice(1)}`
    : escaped;
}

/** Tailwind's rule for a class, aimed at the element instead. */
function scoped(css: string, name: string, selector: string): string {
  return css.split(`.${escapeClass(name)}`).join(`:is(${selector})`);
}

/** The same rule with every declaration unset, and Tailwind's own variables left out. */
function unset(css: string): string {
  return css
    .replace(/--[\w-]+\s*:[^;{}]*;/g, '')
    .replace(/([a-z-]+)\s*:\s*[^;{}]+;/g, '$1: unset;');
}

/** CSS that turns the element's `before` classes into its `after` ones. */
export function cssFor(
  selector: string,
  before: readonly string[],
  after: readonly string[],
  css: PreviewDeps['css'],
): string {
  const removed = before.filter((name) => !after.includes(name));
  const added = after.filter((name) => !before.includes(name));
  const parts: string[] = [];
  for (const name of removed) {
    const rule = css(name);
    if (rule) parts.push(unset(scoped(rule, name, selector)));
  }
  for (const name of added) {
    const rule = css(name);
    if (rule) parts.push(scoped(rule, name, selector));
  }
  return parts.join('\n');
}

/** One change's preview, or null when it has nothing to show (an intent only Claude can carry out). */
export async function previewOf(
  change: StagedChange,
  deps: PreviewDeps,
): Promise<PreviewRule | null> {
  const { element, write } = change;
  if (!element || write?.by !== 'edit') return null;
  const { edit } = write;
  // What one edit changes shows on every element it draws (TRU-4.5).
  const selector = [element.selector, ...(element.also ?? [])].join(', ');
  const rule = (css: string, text: string | null = null): PreviewRule => ({
    href: element.href,
    selector: element.selector,
    css,
    text,
  });
  switch (edit.kind) {
    case 'text':
      return rule('', edit.after);
    case 'classes':
    case 'cva':
      return rule(
        cssFor(
          selector,
          element.classes,
          mergeList(element.classes, edit, deps.merge),
          deps.css,
        ),
      );
    case 'variant': {
      const classes = await deps.variant(change);
      if (!classes) return null;
      return rule(cssFor(selector, classes.before, classes.after, deps.css));
    }
  }
}

/**
 * A change still being made. It goes last, so it wins over one staged for the
 * same property, and its added classes count even when the element has them:
 * stepping back to the page's own value has to beat what's staged.
 */
export function previewOfDraft(
  { element, add, remove }: DraftChange,
  deps: Pick<PreviewDeps, 'merge' | 'css'>,
): PreviewRule {
  return {
    href: element.href,
    selector: element.selector,
    css: cssFor(
      element.selector,
      element.classes.filter((name) => !add.includes(name)),
      mergeList(element.classes, { add, remove }, deps.merge),
      deps.css,
    ),
    text: null,
  };
}
