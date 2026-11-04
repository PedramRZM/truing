import { useState } from 'react';

import { Copy, SquareArrowOutUpRight } from 'lucide-react';

import { currentPlatform, keyFormat } from '../../commands';
import { messageOf, type PanelProps } from '../../module';

import selection, {
  type AbsentReason,
  type Inspection,
  type Location,
  type Selection,
} from './module';

export type Props = PanelProps<typeof selection>;

/** The rail's 16 px icons draw a 1.33 px stroke; these smaller ones match it. */
export const STROKE = 4 / 3;

/** The frame a section shows: the one last selected, else the first that has what it needs. */
export function frameToShow<T>(
  { frames, activeFrame }: Props,
  byFrame: Readonly<Record<string, T>>,
): { id: string; label: string; value: NonNullable<T> } | null {
  const ordered = [
    ...frames.filter((frame) => frame.id === activeFrame),
    ...frames.filter((frame) => frame.id !== activeFrame),
  ];
  for (const frame of ordered) {
    const value = byFrame[frame.id];
    if (value) return { id: frame.id, label: frame.label, value };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Right panel: the inspector.

export type Inspected =
  | { status: 'ready'; inspection: Inspection }
  | { status: 'gone' }
  | { status: 'failed'; message: string };

// One lookup per report: a new report (a new pick, or the page changed under
// the pick) is a new object, so it asks again.
const lookups = new WeakMap<Selection, Promise<Inspected>>();

export function inspectionOf(
  call: Props['call'],
  frame: string,
  picked: Selection,
): Promise<Inspected> {
  let lookup = lookups.get(picked);
  if (!lookup) {
    lookup = call('inspect', { frame, id: picked.id }).then(
      (inspection): Inspected =>
        inspection ? { status: 'ready', inspection } : { status: 'gone' },
      (error: unknown): Inspected => ({
        status: 'failed',
        message: messageOf(error),
      }),
    );
    lookups.set(picked, lookup);
  }
  return lookup;
}

export const READ_FAILED = "Couldn't read this element. Pick it again.";
export const GONE = 'This element is no longer on the page.';

export const ABSENT: Record<
  AbsentReason,
  { callSite: string; definition: string }
> = {
  library: {
    definition: "Drawn inside a package, so its code isn't in this project.",
    callSite: 'Drawn inside a package, so it has no call site here.',
  },
  route: {
    definition: 'Written in a route file.',
    callSite:
      'Written in a route file. Next renders it, so it has no call site.',
  },
  cap: {
    definition: 'This page has more elements than React keeps locations for.',
    callSite: 'This page has more elements than React keeps locations for.',
  },
  unmapped: {
    definition: "Next couldn't map this to a file in the project.",
    callSite: "Next couldn't map this to a file in the project.",
  },
  'not-react': {
    definition: 'Not drawn by React, so it has no location.',
    callSite: 'Not drawn by React, so it has no call site.',
  },
};

export function pathOf(at: Location): string {
  return `${at.file}:${at.line}`;
}

/** ⌘ on a Mac, Ctrl elsewhere, for the copy failure's way forward. */
export const MODIFIER = keyFormat(currentPlatform()).modifier;

/**
 * Copies text, and says so in the shell's status line. A failure says what
 * to do instead, and stays until the next notice.
 */
export function copy(
  text: string,
  notify: Props['notify'],
  messages: { done: string; failed: string },
  onFailure?: () => void,
): void {
  navigator.clipboard.writeText(text).then(
    () => notify(messages.done),
    () => {
      onFailure?.();
      notify(messages.failed, { stays: true });
    },
  );
}

export function SourceActions({
  at,
  call,
}: {
  at: Location;
  call: Props['call'];
}) {
  const [note, setNote] = useState<string | null>(null);
  const where = pathOf(at);

  return (
    <span className="inspect-actions">
      <button
        type="button"
        className="tool"
        aria-label={`Open ${where} in your editor`}
        title="Open in your editor"
        onClick={() => {
          setNote(null);
          call('open', at).catch((error: unknown) => setNote(messageOf(error)));
        }}
      >
        <SquareArrowOutUpRight
          aria-hidden
          size={16}
          absoluteStrokeWidth
          strokeWidth={STROKE}
        />
      </button>
      <button
        type="button"
        className="tool"
        aria-label={`Copy ${where}`}
        title="Copy path"
        onClick={() => {
          navigator.clipboard.writeText(where).then(
            () => setNote('Copied'),
            () => setNote("Couldn't copy. Select the path and copy it."),
          );
        }}
      >
        <Copy aria-hidden size={16} absoluteStrokeWidth strokeWidth={STROKE} />
      </button>
      <span className="inspect-note" role="status">
        {note}
      </span>
    </span>
  );
}

/** The nodes from the root to the node, if it is in the tree. */
export function pathTo<T extends { id: number; children: readonly T[] }>(
  nodes: readonly T[],
  id: number,
): T[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const below = pathTo(node.children, id);
    if (below) return [node, ...below];
  }
  return null;
}

export const count = new Intl.NumberFormat('en');
