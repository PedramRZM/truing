// "Change all like this" (TRU-4.5), as far as it needn't read a page or a file:
// which staged changes ask the question, and what a change becomes on an element
// written somewhere else. No Node imports: the panel reads this too.
import type { Edit, SourceAt, StagedChange } from '../../module';

/** The changes on a pick that can go to others like it, and haven't been asked about. */
export function changesToSpread(
  changes: readonly StagedChange[],
  picked: { selector: string; href: string },
): StagedChange[] {
  return changes.filter((change) => {
    if (change.module !== 'selection') return false;
    // "Every X" was already an answer. A component with one use has no such
    // choice, so what's inside it (a nav's tabs, a card's icon) still asks.
    const { reach } = change;
    if (
      reach.kind !== 'use' &&
      !(reach.kind === 'component' && reach.usages === 1)
    ) {
      return false;
    }
    // One edit already reaching the others.
    if (change.element?.also?.length) return false;
    if (
      change.element?.selector !== picked.selector ||
      change.element.href !== picked.href
    ) {
      return false;
    }
    if (change.write?.by !== 'edit') return false;
    const { kind } = change.write.edit;
    if (kind !== 'classes' && kind !== 'variant') return false;
    return !changes.some(
      (other) => other.reach.kind === 'similar' && other.reach.of === change.id,
    );
  });
}

/** Where an edit is written, as a string: two elements with one are one edit. */
export const placeKey = (at: SourceAt): string =>
  `${at.file}:${at.line}:${at.column}`;

/** The one edit's place: a variant and a class list both have one. */
export function placeOfEdit(edit: Edit): SourceAt | null {
  return edit.kind === 'cva' ? null : edit.at;
}

export type OtherPlace = {
  at: SourceAt;
  tag: string | undefined;
  takes: boolean;
  /** The element's classes there: another may not have what the pick's change removes. */
  classes: readonly string[];
};

/** The same change, written where another element like the pick is written. */
export function editAt(edit: Edit, place: OtherPlace): Edit | null {
  if (edit.kind === 'classes') {
    const next = {
      ...edit,
      at: place.at,
      tag: place.tag,
      takesClassName: place.takes,
      remove: edit.remove.filter((name) => place.classes.includes(name)),
    };
    return next.add.length === 0 && next.remove.length === 0 ? null : next;
  }
  if (edit.kind === 'variant') return { ...edit, at: place.at, tag: place.tag };
  return null;
}

/** Why one item can't change alone, when one place in the code draws them all. */
export function oneAloneReason(total: number): string {
  return `it is written once and drawn ${total} times, so one can't change alone`;
}
