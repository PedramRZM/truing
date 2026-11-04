import type { KeyboardEvent, ReactNode } from 'react';

/** Which way a group's arrows go: the next one, the previous, or an end. */
function arrowMove(key: string, at: number, count: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (at + 1) % count;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (at - 1 + count) % count;
  }
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export type SegmentOption<T extends string> = {
  value: T;
  /** Its words, or for an icon its accessible name. */
  label: string;
  icon?: ReactNode;
};

/** One of a few, the pressed part raised. The arrows choose, as in any radio group. */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  onPreview,
}: {
  name: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  /** The part under the pointer, to show what it would do; null once there is none. */
  onPreview?: (value: T | null) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const at = options.findIndex((option) => option.value === value);
    const next = options[arrowMove(event.key, at, options.length) ?? -1];
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(next.value);
    const buttons =
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
    buttons[options.indexOf(next)]?.focus();
  };
  // Nothing chosen yet: the first takes the tab, so the group can be reached.
  const none = !options.some((option) => option.value === value);
  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={name}
      onKeyDown={onKeyDown}
      onPointerLeave={() => onPreview?.(null)}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.icon ? option.label : undefined}
          title={option.icon ? option.label : undefined}
          tabIndex={option.value === value || (none && index === 0) ? 0 : -1}
          onClick={() => onChange(option.value)}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') onPreview?.(option.value);
          }}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  );
}

/** A native checkbox with its words beside it; the whole line takes the click. */
export function Checkbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="control-check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** A 24 px icon button that stays pressed, raised as a pressed segment is. */
export function IconToggle({
  label,
  pressed,
  onChange,
  onPreview,
  children,
}: {
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  /** What a click would make it, while the pointer is on it; null once it has left. */
  onPreview?: (pressed: boolean | null) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="tool control-toggle"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={() => onChange(!pressed)}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onPreview?.(!pressed);
      }}
      onPointerLeave={() => onPreview?.(null)}
    >
      {children}
    </button>
  );
}
