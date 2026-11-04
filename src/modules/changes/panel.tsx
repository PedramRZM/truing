import { useId, useState, useTransition } from 'react';

import { ChevronUp, Undo2 } from 'lucide-react';

import { NOT_WRITTEN } from '../../edits/messages';
import {
  type ApplyOutcome,
  definePanel,
  messageOf,
  type PanelProps,
  type StagedChange,
} from '../../module';
import { WithArrows } from '../../shell/controls/fold';
import { Checkbox } from '../../shell/controls/toggles';

import changes from './module';

type Props = PanelProps<typeof changes>;

/** Whether the list stays open above the summary, from one session to the next. */
const OPEN_STORAGE_KEY = 'truing:changes-open';

const count = new Intl.PluralRules('en');
const changesText = (n: number): string =>
  `${n} ${count.select(n) === 'one' ? 'change' : 'changes'}`;

/** What one Apply did, in one line for the notice. */
export function applyNotice(outcomes: readonly ApplyOutcome[]): {
  text: string;
  stays: boolean;
} {
  // The change that broke, not the ones that waited on it.
  const failures = outcomes.flatMap((outcome) =>
    outcome.result.status === 'failed' ? [outcome.result.message] : [],
  );
  const failed =
    failures.find((message) => message !== NOT_WRITTEN) ?? failures[0];
  if (failed !== undefined) return { text: failed, stays: true };

  const applied = outcomes.filter(
    (outcome) => outcome.result.status === 'applied',
  ).length;
  const waiting = outcomes.length - applied;
  const parts = [
    applied > 0 ? `Applied ${changesText(applied)}.` : null,
    waiting > 0
      ? `Apply writes direct changes only, so ${waiting} Claude ${count.select(waiting) === 'one' ? 'change stays' : 'changes stay'} here.`
      : null,
  ].filter(Boolean);
  return { text: parts.join(' '), stays: false };
}

/** The file Apply would write, so the designer sees what a change touches. */
function fileOf(change: StagedChange): string | null {
  const { write } = change;
  if (write?.by !== 'edit') return null;
  return write.edit.kind === 'cva' ? write.edit.file : write.edit.at.file;
}

/** A change to the component itself changes every use: say so, with the count once TRU-2.2 knows it. */
export function sharedOf(change: StagedChange): string | null {
  const { reach } = change;
  if (reach.kind === 'list') return `Changes all ${reach.items} on this page`;
  if (reach.kind !== 'component') return null;
  const { component, usages } = reach;
  if (usages === null) return `Changes every ${component}`;
  return `Changes every ${component}: ${usages} ${count.select(usages) === 'one' ? 'use' : 'uses'} in the code`;
}

/** Where a change was made: the frame's label and the width it had. */
function madeIn(change: StagedChange, props: Props): string | null {
  const { frame, width } = change.viewport;
  const label = props.frames.find((entry) => entry.id === frame)?.label;
  if (!label) return width ? `${width} px` : null;
  return width ? `${label} · ${width} px` : label;
}

/** What followed a change onto elements like it: a line on its row, not rows of their own (TRU-4.5). */
export function followersOf(
  change: StagedChange,
  list: readonly StagedChange[],
): { text: string; claude: string | null } | null {
  const following = list.filter(
    (other) => other.reach.kind === 'similar' && other.reach.of === change.id,
  );
  if (following.length === 0) return null;
  const toClaude = following.flatMap((other) =>
    other.route.by === 'claude' ? [other.route.reason] : [],
  );
  const [reason] = toClaude;
  return {
    text: `Also on ${following.length} more like it`,
    claude:
      reason === undefined
        ? null
        : `${toClaude.length} of them need Claude: ${reason}`,
  };
}

function ChangeRow({
  change,
  list,
  props,
  pending,
  run,
}: {
  change: StagedChange;
  list: readonly StagedChange[];
  props: Props;
  pending: boolean;
  run: (action: () => Promise<unknown>) => void;
}) {
  const { route } = change;
  const where = madeIn(change, props);
  const file = fileOf(change);
  const shared = sharedOf(change);
  const followers = followersOf(change, list);
  // The engine can't write it: Claude is the only path, so there's no choice.
  const onlyClaude = route.by === 'claude' && !route.requested;

  return (
    <li className="change">
      <div className="change-head">
        <span className="change-label" title={change.label}>
          <WithArrows text={change.label} />
        </span>
        <button
          type="button"
          className="tool"
          aria-label={`Undo ${change.label}`}
          title="Undo"
          disabled={pending}
          onClick={() => run(() => props.call('undo', { id: change.id }))}
        >
          <Undo2 aria-hidden size={16} />
        </button>
      </div>
      <p className="change-meta">
        <span className="change-route" data-route={route.by}>
          {route.by === 'direct' ? 'Direct' : 'Claude'}
        </span>
        {/* A ticked box says why already. */}
        {route.by === 'claude' && !route.requested ? (
          <span className="change-reason">{route.reason}</span>
        ) : null}
        {where ? <span className="change-where">{where}</span> : null}
        {file ? (
          <code className="change-file truncated-path" title={file}>
            <bdi>{file}</bdi>
          </code>
        ) : null}
        {shared ? <span className="change-shared">{shared}</span> : null}
        {followers ? (
          <span className="change-shared">{followers.text}</span>
        ) : null}
        {followers?.claude ? (
          <span className="change-reason">{followers.claude}</span>
        ) : null}
      </p>
      {onlyClaude ? null : (
        <Checkbox
          label="Let Claude do this"
          checked={route.by === 'claude'}
          disabled={pending}
          onChange={(claude) =>
            run(() => props.call('claude', { id: change.id, claude }))
          }
        />
      )}
    </li>
  );
}

function Tray(props: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(
    () => localStorage.getItem(OPEN_STORAGE_KEY) === 'open',
  );
  const listId = useId();
  const list = props.changes;

  const run = (action: () => Promise<unknown>): void => {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        props.notify(messageOf(error), { stays: true });
      }
    });
  };

  if (list.length === 0) {
    return (
      <p className="module-empty">
        Changes you make show here. Apply writes them to the code.
      </p>
    );
  }

  return (
    <div className="changes" aria-busy={pending}>
      {open ? (
        <ol id={listId} className="changes-list">
          {list
            .filter((change) => change.reach.kind !== 'similar')
            .map((change) => (
              <ChangeRow
                key={change.id}
                change={change}
                list={list}
                props={props}
                pending={pending}
                run={run}
              />
            ))}
        </ol>
      ) : null}
      <div className="changes-summary">
        <button
          type="button"
          className="changes-toggle"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => {
            localStorage.setItem(OPEN_STORAGE_KEY, open ? 'closed' : 'open');
            setOpen(!open);
          }}
        >
          <ChevronUp aria-hidden size={16} className="changes-chevron" />
          {changesText(list.length)}
        </button>
        <button
          type="button"
          className="changes-discard"
          disabled={pending}
          onClick={() => run(() => props.call('discard', {}))}
        >
          Discard
        </button>
        <button
          type="button"
          className="changes-apply"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const { outcomes } = await props.call('apply', {});
              const notice = applyNotice(outcomes);
              if (notice.text)
                props.notify(notice.text, { stays: notice.stays });
            })
          }
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export default definePanel(changes, { right: Tray });
