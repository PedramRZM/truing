import { type KeyboardEvent, type ReactNode, useState } from 'react';

import { Check, ChevronDown } from 'lucide-react';

import { ICON_STROKE } from './marks';
import { floatLayer } from './token-menu';

export type Choice = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What a click would make it, while it's pointed at or moved to; null once it isn't. */
  onPreview?: (checked: boolean | null) => void;
};

const ROW = '[role="menuitemcheckbox"], [role="menuitemradio"]';

/**
 * A few options behind one button, each shown on the page while it's pointed at
 * (a native select can't say which option the pointer is on). With `value`, the
 * button is a field reading the one chosen, and only one can be: a variant.
 * Without it, an icon, and each option is on or off: Space between, baseline.
 */
export function ChoiceMenu({
  name,
  icon,
  value,
  choices,
}: {
  name: string;
  icon?: ReactNode;
  value?: string;
  choices: readonly Choice[];
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = (): void => {
    anchor?.focus();
    setAnchor(null);
  };
  const stopPreviews = (): void => {
    for (const choice of choices) choice.onPreview?.(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      stopPreviews();
      close();
      return;
    }
    const by =
      event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : null;
    if (by === null) return;
    event.preventDefault();
    event.stopPropagation();
    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>(ROW)];
    const focused = document.activeElement;
    const at = rows.findIndex((row) => row === focused);
    const next = (at + by + rows.length) % rows.length;
    rows[next]?.focus();
    // Only the keys: opening the menu focuses a row, and shouldn't show it.
    const choice = choices[next];
    choice?.onPreview?.(!choice.checked);
  };

  const toggle = (element: HTMLElement): void =>
    setAnchor(anchor ? null : element);

  return (
    <>
      {value === undefined ? (
        <button
          type="button"
          className="tool"
          aria-label={name}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          title={name}
          onClick={(event) => toggle(event.currentTarget)}
        >
          {icon}
        </button>
      ) : (
        <button
          type="button"
          className="field field-button"
          aria-label={`${name} ${value}`}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          onClick={(event) => toggle(event.currentTarget)}
        >
          <span className="field-text" title={value}>
            {value}
          </span>
          <ChevronDown
            aria-hidden
            className="field-chevron"
            size={12}
            absoluteStrokeWidth
            strokeWidth={ICON_STROKE}
          />
        </button>
      )}
      {anchor ? (
        <div
          className="token-menu-layer"
          popover="manual"
          ref={floatLayer(anchor, () => {
            stopPreviews();
            setAnchor(null);
          })}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return;
            stopPreviews();
            setAnchor(null);
          }}
        >
          <div
            className="menu token-menu choice-menu"
            role="menu"
            aria-label={name}
            onKeyDown={onKeyDown}
          >
            {choices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                className="choice-row"
                role={
                  value === undefined ? 'menuitemcheckbox' : 'menuitemradio'
                }
                aria-checked={choice.checked}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') {
                    choice.onPreview?.(!choice.checked);
                  }
                }}
                onPointerLeave={() => choice.onPreview?.(null)}
                onClick={() => {
                  choice.onChange(!choice.checked);
                  close();
                }}
              >
                <span>{choice.label}</span>
                {choice.checked ? (
                  <Check
                    aria-hidden
                    className="choice-row-tick"
                    size={12}
                    absoluteStrokeWidth
                    strokeWidth={ICON_STROKE}
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
