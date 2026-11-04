import type { KeyboardEvent } from 'react';

export const ALIGNMENT = ['start', 'center', 'end'] as const;
export type Alignment = (typeof ALIGNMENT)[number];
export type PadValue = { x: Alignment; y: Alignment };
export type PadDirection = 'row' | 'column';

const ROWS: Record<Alignment, string> = {
  start: 'Top',
  center: 'Middle',
  end: 'Bottom',
};
const COLUMNS: Record<Alignment, string> = {
  start: 'left',
  center: 'centre',
  end: 'right',
};

/** The arrow's way on the pad: columns are x, rows are y. */
const MOVES: Partial<Record<string, { x: number; y: number }>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

const moved = (from: Alignment, by: number): Alignment =>
  ALIGNMENT[
    Math.max(0, Math.min(ALIGNMENT.indexOf(from) + by, ALIGNMENT.length - 1))
  ] ?? from;

/**
 * Where a flex frame's children sit, for TRU-4.2: a 3 × 3 pad. Each cell is a
 * radio, so one tab stop and the arrows move. The current cell draws three
 * lines running the way the children flow; the others a dot.
 */
export function AlignmentPad({
  name,
  value,
  direction,
  onChange,
  onPreview,
}: {
  name: string;
  value: PadValue;
  direction: PadDirection;
  onChange: (value: PadValue) => void;
  /** The cell under the pointer, to show what it would do; null once there is none. */
  onPreview?: (value: PadValue | null) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    event.stopPropagation();
    const next = { x: moved(value.x, move.x), y: moved(value.y, move.y) };
    if (next.x !== value.x || next.y !== value.y) onChange(next);
    const at = ALIGNMENT.indexOf(next.y) * 3 + ALIGNMENT.indexOf(next.x);
    event.currentTarget
      .querySelectorAll<HTMLElement>('[role="radio"]')
      [at]?.focus();
  };

  return (
    <div
      className="alignment-pad"
      role="radiogroup"
      aria-label={name}
      onKeyDown={onKeyDown}
      onPointerLeave={() => onPreview?.(null)}
    >
      {ALIGNMENT.flatMap((y) =>
        ALIGNMENT.map((x) => {
          const current = value.x === x && value.y === y;
          return (
            <button
              key={`${y}-${x}`}
              type="button"
              role="radio"
              aria-label={`${ROWS[y]} ${COLUMNS[x]}`}
              aria-checked={current}
              tabIndex={current ? 0 : -1}
              data-x={x}
              data-y={y}
              onClick={() => onChange({ x, y })}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') onPreview?.({ x, y });
              }}
            >
              {current ? (
                <span className="alignment-lines" data-direction={direction}>
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <span className="alignment-dot" />
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
