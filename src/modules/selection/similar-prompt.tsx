import { Suspense, use, useEffect, useState, useTransition } from 'react';

import { messageOf } from '../../module';

import type { Selection } from './module';
import type { Props } from './panel-shared';
import { type Loaded, loaded } from './selection-section';
import { changesToSpread } from './similar-plan';

type Found = { ids: number[] };

// One lookup per report of the pick, as for its instances.
const lookups = new WeakMap<Selection, Promise<Loaded<Found>>>();

function similarOfPick(
  call: Props['call'],
  frame: string,
  picked: Selection,
): Promise<Loaded<Found>> {
  let lookup = lookups.get(picked);
  if (!lookup) {
    lookup = loaded(call('similar', { frame, id: picked.id }));
    lookups.set(picked, lookup);
  }
  return lookup;
}

// Changes already answered "Only this one": a new pick mustn't ask again.
const answered = new Set<string>();

type PromptProps = {
  frame: string;
  picked: Selection;
  call: Props['call'];
  command: Props['command'];
  notify: Props['notify'];
};

function Prompt({
  frame,
  picked,
  call,
  command,
  notify,
  onAnswer,
}: PromptProps & { onAnswer: () => void }) {
  const found = use(similarOfPick(call, frame, picked));
  const [pending, startTransition] = useTransition();
  const ids = found.status === 'ready' ? found.value.ids : [];
  const idsKey = ids.join(',');

  // The outlines are drawn in the frame, a system outside React.
  useEffect(() => {
    if (idsKey === '') return;
    command(frame, 'outline', { ids: idsKey.split(',').map(Number) }).catch(
      () => {},
    );
    return () => {
      command(frame, 'outline', { ids: [] }).catch(() => {});
    };
  }, [idsKey, frame, command]);

  if (ids.length === 0) return null;
  const total = ids.length + 1;
  const { id } = picked;

  const answer = (to: 'all' | 'only'): void => {
    startTransition(async () => {
      try {
        const { settled } = await call('spread-similar', { frame, id, to });
        for (const change of settled) answered.add(change);
        onAnswer();
      } catch (error) {
        notify(messageOf(error), { stays: true });
      }
    });
  };
  const preview = (on: boolean): void => {
    call('preview-similar', { frame, id, on }).catch(() => {
      // Only a preview: the answer says if Truing can't be reached.
    });
  };

  return (
    <div
      className="similar-prompt"
      role="group"
      aria-label="Elements like this one"
    >
      <p>{total} like this on the page</p>
      <div className="similar-actions">
        <button
          type="button"
          className="similar-all"
          disabled={pending}
          onClick={() => answer('all')}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') preview(true);
          }}
          onPointerLeave={() => preview(false)}
        >
          Change all {total}
        </button>
        <button
          type="button"
          className="similar-one"
          disabled={pending}
          onClick={() => answer('only')}
        >
          Only this one
        </button>
      </div>
    </div>
  );
}

/**
 * After a change on the pick, asks whether it's for every element like it, and
 * outlines them on the page while it asks (TRU-4.5). Figma Make asks the same.
 */
export function SimilarPrompt({
  changes,
  ...props
}: PromptProps & { changes: Props['changes'] }) {
  // `answered` lives outside React, so a pick's return doesn't ask again.
  const [, setAnswers] = useState(0);
  const waiting = changesToSpread(changes, props.picked).filter(
    (change) => !answered.has(change.id),
  );
  if (waiting.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <Prompt {...props} onAnswer={() => setAnswers((n) => n + 1)} />
    </Suspense>
  );
}
