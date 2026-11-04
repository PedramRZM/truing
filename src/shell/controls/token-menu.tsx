import { type CSSProperties, type KeyboardEvent, useId, useState } from 'react';

import {
  Check,
  CaseSensitive,
  Hash,
  LayoutGrid,
  Layers,
  type LucideIcon,
  Plus,
  Rows3,
  Space,
  SquareRoundCorner,
  Type,
} from 'lucide-react';

import type { TokenCategory } from '../../tokens/manifest';
import { placeUnder } from '../menu-layout';

import { ICON_STROKE } from './marks';
import {
  filterRows,
  groupRows,
  nearestRows,
  type TokenRow,
} from './token-rows';

const KIND_ICON: Partial<Record<TokenCategory, LucideIcon>> = {
  spacing: Space,
  radius: SquareRoundCorner,
  text: Type,
  font: CaseSensitive,
  shadow: Layers,
};

/** List, then a grid of swatches with fewer room each: columns per stop of the slider. */
const GRID_COLUMNS = [0, 4, 6, 8] as const;
const DENSITY_KEY = 'truing:token-density';

function storedDensity(): number {
  const stored = Number(localStorage.getItem(DENSITY_KEY));
  return stored in GRID_COLUMNS ? stored : 0;
}

/**
 * Opens a clear layer over the whole window with its menu under `anchor`, so a
 * press outside closes it even on a frame: in Select mode a frame takes neither
 * the press nor the focus. Used as the layer's ref.
 */
export function floatLayer(anchor: HTMLElement, onClose: () => void) {
  return (layer: HTMLDivElement | null) => {
    const node = layer?.querySelector<HTMLElement>('.token-menu');
    if (!layer || !node) return;
    const place = (): void => {
      const at = placeUnder(
        anchor.getBoundingClientRect(),
        node.getBoundingClientRect(),
        { width: innerWidth, height: innerHeight },
      );
      node.style.left = `${at.left}px`;
      node.style.top = `${at.top}px`;
    };
    if (!layer.matches(':popover-open')) {
      layer.showPopover();
      place();
      node
        .querySelector<HTMLElement>(
          'input, [role="menuitemcheckbox"], [role="menuitemradio"]',
        )
        ?.focus();
    }
    const resized = new ResizeObserver(place);
    resized.observe(node);
    window.addEventListener('blur', onClose);
    return () => {
      resized.disconnect();
      window.removeEventListener('blur', onClose);
    };
  };
}

export type TokenMenuProps = {
  /** Names the list: "Fill tokens". */
  name: string;
  /** What opened it: it floats under this, and focus goes back to it. */
  anchor: HTMLElement;
  rows: readonly TokenRow[];
  /** The token in use, by its key; it gets a tick. */
  current?: string | null;
  /** A value off the scale: the menu opens at the tokens nearest it. */
  near?: number | string | null;
  onChoose: (row: TokenRow) => void;
  /** The row pointed at or moved to, to show what it would do; null once the pointer leaves. */
  onPreview?: (row: TokenRow | null) => void;
  onClose: () => void;
  /** Offers to create a token (TRU-11.5). No `+` until it's given. */
  onCreate?: () => void;
};

export function TokenMenu({
  name,
  anchor,
  rows,
  current = null,
  near = null,
  onChoose,
  onPreview,
  onClose,
  onCreate,
}: TokenMenuProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [density, setDensity] = useState(storedDensity);

  const colours = rows.some((row) => row.hex !== null);
  const columns = colours ? (GRID_COLUMNS[density] ?? 0) : 0;
  const searching = query.trim() !== '';
  const nearest = near === null || searching ? [] : nearestRows(rows, near);
  const groups = groupRows(filterRows(rows, query), nearest);
  const flat = groups.flatMap((group) => group.rows);
  const shown =
    flat.find((row) => row.key === active) ??
    flat.find((row) => row.key === current) ??
    flat[0];
  const optionId = (row: TokenRow): string => `${id}-${row.key}`;

  // A number field's anchor is the whole field; its input takes the focus.
  const close = (): void => {
    onClose();
    (anchor.querySelector('input') ?? anchor).focus();
  };

  const move = (by: number): void => {
    const at = shown ? flat.indexOf(shown) : -1;
    const next = flat[Math.max(0, Math.min(at + by, flat.length - 1))];
    if (!next) return;
    setActive(next.key);
    onPreview?.(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // In a grid the sides move too, while there's no text for them to move in.
    const sideways = columns > 0 && query === '';
    const handled: Partial<Record<string, () => void>> = {
      ArrowDown: () => move(columns || 1),
      ArrowUp: () => move(-(columns || 1)),
      ...(sideways
        ? { ArrowRight: () => move(1), ArrowLeft: () => move(-1) }
        : {}),
      Enter: () => {
        if (shown) onChoose(shown);
      },
    };
    const run = handled[event.key];
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  return (
    <div
      className="token-menu-layer"
      popover="manual"
      ref={floatLayer(anchor, onClose)}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="menu token-menu"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (event.key !== 'Tab') return;
          // Tab goes through the menu's controls; past either end it closes.
          event.stopPropagation();
          const stops =
            event.currentTarget.querySelectorAll<HTMLElement>('input, button');
          const end = event.shiftKey ? stops[0] : stops[stops.length - 1];
          if (event.target !== end) return;
          event.preventDefault();
          close();
        }}
      >
        <div className="token-menu-head">
          <input
            type="text"
            role="combobox"
            aria-label={`Filter ${name.toLowerCase()}`}
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={shown ? optionId(shown) : undefined}
            placeholder="Filter"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(null);
            }}
            onKeyDown={onKeyDown}
          />
          {onCreate ? (
            <button
              type="button"
              className="tool"
              aria-label="Create a token"
              title="Create a token"
              onClick={onCreate}
            >
              <Plus
                aria-hidden
                size={16}
                absoluteStrokeWidth
                strokeWidth={ICON_STROKE}
              />
            </button>
          ) : null}
        </div>
        {colours ? (
          <label className="token-menu-density">
            <Rows3
              aria-hidden
              size={14}
              absoluteStrokeWidth
              strokeWidth={ICON_STROKE}
            />
            <input
              type="range"
              className="control-range"
              aria-label="Density"
              aria-valuetext={
                density === 0 ? 'List' : `${GRID_COLUMNS[density]} columns`
              }
              min={0}
              max={GRID_COLUMNS.length - 1}
              value={density}
              onChange={(event) => {
                const next = Number(event.target.value);
                setDensity(next);
                localStorage.setItem(DENSITY_KEY, String(next));
              }}
            />
            <LayoutGrid
              aria-hidden
              size={14}
              absoluteStrokeWidth
              strokeWidth={ICON_STROKE}
            />
          </label>
        ) : null}
        <div
          className="token-menu-list"
          id={`${id}-list`}
          role="listbox"
          aria-label={name}
          data-grid={columns > 0 ? 'true' : undefined}
          style={{ '--token-columns': columns } as CSSProperties}
          onPointerLeave={() => onPreview?.(null)}
        >
          {flat.length === 0 ? (
            <p className="token-menu-empty">
              {searching
                ? `No tokens match “${query.trim()}”.`
                : `No ${name.toLowerCase()}.`}
            </p>
          ) : null}
          {groups.map((group) => (
            <div key={group.title} role="group" aria-label={group.title}>
              {groups.length > 1 ? (
                <p className="token-menu-group" aria-hidden="true">
                  {group.title}
                </p>
              ) : null}
              <div className="token-menu-rows">
                {group.rows.map((row) => (
                  <TokenOption
                    key={row.key}
                    id={optionId(row)}
                    row={row}
                    swatchOnly={columns > 0}
                    active={row === shown}
                    current={row.key === current}
                    onPoint={() => {
                      setActive(row.key);
                      onPreview?.(row);
                    }}
                    onChoose={() => onChoose(row)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TokenOption({
  id,
  row,
  swatchOnly,
  active,
  current,
  onPoint,
  onChoose,
}: {
  id: string;
  row: TokenRow;
  swatchOnly: boolean;
  active: boolean;
  current: boolean;
  onPoint: () => void;
  onChoose: () => void;
}) {
  const Icon = KIND_ICON[row.kind] ?? Hash;
  return (
    <div
      id={id}
      className="token-row"
      role="option"
      aria-selected={current}
      aria-label={`${row.name} ${row.value}`.trim()}
      title={swatchOnly ? `${row.name} ${row.value}`.trim() : undefined}
      data-active={active ? 'true' : undefined}
      data-colour={row.hex ? 'true' : undefined}
      ref={(node) => {
        if (active) node?.scrollIntoView({ block: 'nearest' });
      }}
      onPointerMove={(event) => {
        if (!active && event.pointerType === 'mouse') onPoint();
      }}
      // The filter keeps the focus, so the keys go on working.
      onPointerDown={(event) => event.preventDefault()}
      onClick={onChoose}
    >
      {row.hex ? (
        <span
          className="inspect-swatch"
          style={{ '--swatch': row.hex } as CSSProperties}
          aria-hidden="true"
        />
      ) : (
        <Icon
          aria-hidden
          className="token-row-icon"
          size={14}
          absoluteStrokeWidth
          strokeWidth={ICON_STROKE}
        />
      )}
      {swatchOnly ? null : (
        <>
          <span className="token-row-name">{row.name}</span>
          <span className="token-row-value">{row.value}</span>
        </>
      )}
      {current ? (
        <Check
          aria-hidden
          className="token-row-tick"
          size={12}
          absoluteStrokeWidth
          strokeWidth={ICON_STROKE}
        />
      ) : null}
    </div>
  );
}
