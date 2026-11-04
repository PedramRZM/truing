import { useRef, useState } from 'react';

import { TriangleAlert, X } from 'lucide-react';

import { messageOf } from '../../module';
import { Markdown } from '../../shell/controls/markdown';

import type { ConfigItem } from './module';

export type Opened = {
  item: ConfigItem;
  text: string | null;
  error: string | null;
};

/**
 * One item of the list: Markdown as a reader sees it, anything else as it is. A
 * designer's own file can be edited or removed here too.
 */
export function Viewer({
  opened,
  startEditing = false,
  onClose,
  onSave,
  onRemove,
}: {
  opened: Opened;
  /** A file just made opens ready to write. */
  startEditing?: boolean;
  onClose: () => void;
  onSave: (text: string, base: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { item, text, error } = opened;
  const title = item.path ?? [item.name, item.note].filter(Boolean).join(' · ');
  const [editing, setEditing] = useState(startEditing);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  function run(action: () => Promise<void>, after?: () => void): void {
    setPending(true);
    setProblem(null);
    action()
      .then(after, (failure: unknown) => setProblem(messageOf(failure)))
      .finally(() => setPending(false));
  }

  return (
    <dialog
      className="sheet claude-viewer"
      aria-labelledby="claude-viewer-title"
      // Shown by hand so it isn't modal: the list stays usable behind it.
      ref={(dialog) => {
        if (dialog && !dialog.open) dialog.show();
      }}
      onClose={onClose}
      // Clicking away must not lose what's being written.
      {...{ closedby: editing ? 'closerequest' : 'any' }}
    >
      <header className="sheet-header">
        <h2 id="claude-viewer-title" title={title}>
          {title}
        </h2>
        {item.editable && !editing && text !== null ? (
          <button
            type="button"
            className="module-action claude-viewer-action"
            onClick={() => {
              setConfirming(false);
              setEditing(true);
            }}
          >
            Edit
          </button>
        ) : null}
        <form method="dialog">
          <button type="submit" className="tool" aria-label="Close">
            <X aria-hidden size={16} />
          </button>
        </form>
      </header>
      <div className="sheet-body">
        {problem ? (
          <div className="module-failed" role="status">
            <TriangleAlert
              aria-hidden
              size={16}
              className="module-failed-icon"
            />
            <p>That didn&apos;t work.</p>
            <p className="module-error">{problem}</p>
          </div>
        ) : null}
        {error !== null ? (
          <div className="module-failed" role="status">
            <TriangleAlert
              aria-hidden
              size={16}
              className="module-failed-icon"
            />
            <p>This file didn&apos;t open.</p>
            <p className="module-error">{error}</p>
          </div>
        ) : text === null ? (
          <p className="module-empty">Reading…</p>
        ) : editing ? (
          <textarea
            ref={field}
            className="claude-editor"
            aria-label={`Text of ${title}`}
            defaultValue={text}
            spellCheck={false}
            autoFocus
          />
        ) : item.path?.endsWith('.md') ? (
          <Markdown text={text} />
        ) : (
          <pre className="claude-viewer-text">{text}</pre>
        )}
      </div>
      {editing && text !== null ? (
        <footer className="claude-viewer-foot">
          <button
            type="button"
            className="module-action"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="changes-apply"
            disabled={pending}
            onClick={() =>
              run(
                () => onSave(field.current?.value ?? text, text),
                () => setEditing(false),
              )
            }
          >
            Save
          </button>
        </footer>
      ) : null}
      {item.editable && !editing && text !== null ? (
        <footer className="claude-viewer-foot">
          {confirming ? (
            <>
              <span className="claude-viewer-ask">
                Delete this file? Git can bring it back only if it was
                committed.
              </span>
              <button
                type="button"
                className="module-action"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Keep
              </button>
              <button
                type="button"
                className="changes-apply"
                disabled={pending}
                onClick={() => run(onRemove)}
              >
                Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              className="module-action"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          )}
        </footer>
      ) : null}
    </dialog>
  );
}
