import { type Ref, useImperativeHandle, useRef, useState } from 'react';

import { TriangleAlert, X } from 'lucide-react';

import { messageOf } from '../../module';
import { Markdown } from '../../shell/controls/markdown';

import type { ConfigItem } from './module';

export type Opened = {
  item: ConfigItem;
  text: string | null;
  error: string | null;
};

/** TRU-5.3: removing a skill's own file removes its folder (`removeDesignerFile`). */
export function deleteQuestion(path: string | null): string {
  const what = path?.endsWith('/SKILL.md')
    ? "this skill's whole folder"
    : 'this file';
  return `Delete ${what}? Git can bring it back only if it was committed.`;
}

export type ViewerHandle = {
  /** Runs `then` once nothing unsaved stands in its way, asking if something does. */
  leave: (then: () => void) => void;
};

/**
 * One item of the list: Markdown as a reader sees it, anything else as it is. A
 * designer's own file can be edited or removed here too.
 */
export function Viewer({
  ref,
  opened,
  startEditing = false,
  onClose,
  onSave,
  onRemove,
}: {
  ref?: Ref<ViewerHandle>;
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
  // What's waiting on the answer to "this text isn't saved".
  const [leaving, setLeaving] = useState<{ next: () => void } | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  function run(action: () => Promise<void>, after?: () => void): void {
    setPending(true);
    setProblem(null);
    action()
      .then(after, (failure: unknown) => setProblem(messageOf(failure)))
      .finally(() => setPending(false));
  }

  const unsaved = (): boolean =>
    editing && field.current !== null && field.current.value !== text;

  function leave(then: () => void): void {
    if (unsaved()) setLeaving({ next: then });
    else then();
  }
  useImperativeHandle(ref, () => ({ leave }));

  function keepEditing(): void {
    setLeaving(null);
    field.current?.focus();
  }

  return (
    <dialog
      className="sheet claude-viewer"
      aria-labelledby="claude-viewer-title"
      // Shown by hand so it isn't modal: the list stays usable behind it.
      ref={(dialog) => {
        if (!dialog || dialog.open) return;
        dialog.show();
        // TRU-5.3: autoFocus ran while the dialog was closed, where nothing can
        // take focus, and show() then gave it to the first button.
        field.current?.focus();
      }}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !editing) return;
        event.preventDefault();
        event.stopPropagation();
        if (leaving) keepEditing();
        else leave(onClose);
      }}
      // TRU-5.3: while editing, Esc is handled above. A close request can't be
      // held back: Chromium skips `cancel` on a second Esc, and the text goes.
      {...{ closedby: editing ? 'none' : 'any' }}
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
        <form
          method="dialog"
          onSubmit={(event) => {
            if (!unsaved()) return;
            event.preventDefault();
            setLeaving({ next: onClose });
          }}
        >
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
      {editing && text !== null && leaving ? (
        <footer className="claude-viewer-foot">
          <span className="claude-viewer-ask" role="status">
            This text isn&apos;t saved.
          </span>
          <button
            type="button"
            className="module-action"
            autoFocus
            onClick={keepEditing}
          >
            Keep editing
          </button>
          <button
            type="button"
            className="changes-apply"
            onClick={() => {
              setLeaving(null);
              leaving.next();
            }}
          >
            Discard
          </button>
        </footer>
      ) : null}
      {editing && text !== null && !leaving ? (
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
                {deleteQuestion(item.path)}
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
