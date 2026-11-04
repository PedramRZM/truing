import { type KeyboardEvent, type ReactNode, useRef } from 'react';

import { X } from 'lucide-react';

export type ComposerChip = {
  key: string;
  label: string;
  /** The longer text on hover: where it is in the code. */
  title?: string;
};

/**
 * DESIGN.md's Composer, one shape wherever a person writes to Claude: chips for
 * what's attached, then the text, then small menus at the left and the action at
 * the right. Enter sends, and Shift and Enter starts a new line. The text stays
 * if `onSend` fails, as it's the person's work.
 */
export function Composer({
  label,
  placeholder,
  chips = [],
  onRemoveChip,
  menus,
  action,
  note,
  small = false,
  autoFocus = false,
  onSend,
  onEscape,
}: {
  label: string;
  placeholder: string;
  chips?: readonly ComposerChip[];
  onRemoveChip?: (key: string) => void;
  menus?: ReactNode;
  /** Beside Send: Stop, while Claude is working. */
  action?: ReactNode;
  /** One line under it, about how what's sent will run. */
  note?: ReactNode;
  small?: boolean;
  autoFocus?: boolean;
  onSend: (text: string) => Promise<void>;
  onEscape?: () => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);

  function send(): void {
    const node = field.current;
    const text = node?.value.trim();
    if (!node || !text) return;
    onSend(text).then(
      () => {
        node.value = '';
      },
      // Whoever sent it has said why; the text stays to send again.
      () => {},
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return;
    }
    // A key pressed to accept an input method's word isn't sending.
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    send();
  }

  return (
    <div className="composer" data-small={small || undefined}>
      {chips.length > 0 ? (
        <ul className="composer-chips" aria-label="Attached elements">
          {chips.map((chip) => (
            <li key={chip.key} className="composer-chip" title={chip.title}>
              <span className="composer-chip-label">{chip.label}</span>
              {onRemoveChip ? (
                <button
                  type="button"
                  aria-label={`Remove ${chip.label}`}
                  onClick={() => onRemoveChip(chip.key)}
                >
                  <X
                    aria-hidden
                    size={12}
                    absoluteStrokeWidth
                    strokeWidth={4 / 3}
                  />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={field}
        className="composer-text"
        aria-label={label}
        placeholder={placeholder}
        rows={1}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
      />
      <div className="composer-row">
        <div className="composer-menus">{menus}</div>
        {action}
        <button type="button" className="composer-send" onClick={send}>
          Send
        </button>
      </div>
      {note}
    </div>
  );
}
