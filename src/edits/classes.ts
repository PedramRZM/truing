// Class lists, merged the way the app merges them: the repo's own
// tailwind-merge, extended as src/lib/utils.ts extends it, so "px-500
// replaces px-400" means what `cn()` means at runtime. Edits splice the
// literal token by token, so the rest of the string keeps its spacing.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type MagicString from 'magic-string';
import { extendTailwindMerge, twMerge } from 'tailwind-merge';

export type Merge = (classes: string) => string;

/** tailwind-merge with the project's token groups (`config.tailwindMerge`), as `cn()` has them. */
export function projectMerge(root: string, groupsFile?: string): Merge {
  if (!groupsFile) return twMerge;
  const groups = JSON.parse(
    readFileSync(path.join(root, groupsFile), 'utf8'),
  ) as Record<string, unknown>;
  const list = (name: string): string[] => {
    const value = groups[name];
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
  };
  return extendTailwindMerge({
    extend: {
      classGroups: {
        'font-size': [{ text: list('font-size') }],
        shadow: [{ shadow: list('shadow') }],
      },
    },
  });
}

/** Whether `added` would override `existing` in one class string. */
export function overrides(
  merge: Merge,
  existing: string,
  added: string,
): boolean {
  if (existing === added) return false;
  return !merge(`${existing} ${added}`).split(' ').includes(existing);
}

type Token = { text: string; start: number; end: number };

function tokensOf(inner: string, offset: number): Token[] {
  return [...inner.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    start: offset + match.index,
    end: offset + match.index + match[0].length,
  }));
}

/** A string literal's characters between its quotes, and where they start in the file. */
export type Literal = { inner: string; start: number };

/**
 * Edits one literal: drops what `remove` names and what an added class
 * overrides, writes the first added class where the first class it overrides
 * was, and appends the rest. `add` is left out when `place` is false (the
 * literal only loses what the additions override). Returns the classes it
 * removed, so a caller can tell which removals it found.
 */
export function editLiteral(
  ms: MagicString,
  literal: Literal,
  change: { add: readonly string[]; remove: readonly string[] },
  merge: Merge,
  place = true,
): string[] {
  const tokens = tokensOf(literal.inner, literal.start);
  const present = new Set(tokens.map((token) => token.text));
  const added = place ? change.add.filter((name) => !present.has(name)) : [];
  const replaced = new Map<Token, string>();
  const dropped = new Set<Token>();

  for (const token of tokens) {
    if (change.remove.includes(token.text)) {
      dropped.add(token);
      continue;
    }
    const over = change.add.find((name) => overrides(merge, token.text, name));
    if (!over) continue;
    if (
      place &&
      added.includes(over) &&
      ![...replaced.values()].includes(over)
    ) {
      replaced.set(token, over);
    } else {
      dropped.add(token);
    }
  }

  for (const [token, name] of replaced)
    ms.overwrite(token.start, token.end, name);
  const kept = tokens.filter((token) => !dropped.has(token));
  for (const token of dropped) {
    // Take the space before it, or after it if it is the first one kept.
    const index = tokens.indexOf(token);
    const before = tokens[index - 1];
    const after = tokens[index + 1];
    if (before && !dropped.has(before)) ms.remove(before.end, token.end);
    else if (after) ms.remove(token.start, after.start);
    else if (before) ms.remove(before.end, token.end);
    else ms.remove(token.start, token.end);
  }

  const appended = added.filter(
    (name) => ![...replaced.values()].includes(name),
  );
  if (appended.length > 0) {
    const last = kept.at(-1) ?? null;
    const at = last ? last.end : literal.start + literal.inner.length;
    ms.appendLeft(at, `${last ? ' ' : ''}${appended.join(' ')}`);
  }

  return tokens
    .filter((token) => dropped.has(token) || replaced.has(token))
    .map((token) => token.text);
}

/**
 * A class list after a change, as `editLiteral` would leave it: what the
 * preview shows before anything is written.
 */
export function mergeList(
  current: readonly string[],
  change: { add: readonly string[]; remove: readonly string[] },
  merge: Merge,
): string[] {
  let list = current.filter((name) => !change.remove.includes(name));
  for (const added of change.add) {
    if (list.includes(added)) continue;
    const over = list.filter((name) => overrides(merge, name, added));
    const first = over[0];
    if (first === undefined) {
      list = [...list, added];
      continue;
    }
    list = list.flatMap((name) => {
      if (name === first) return [added];
      return over.includes(name) ? [] : [name];
    });
  }
  return list;
}
