import { ChevronDown, ChevronRight, Columns3, RotateCw } from 'lucide-react';

import { PRESET_GROUPS } from '../vendor/airship/frames';

import type { ShellState, ShellStore } from './store';
import {
  clampSize,
  MAX_SIZE,
  MIN_SIZE,
  PRESET_IDS,
  PRESETS,
  sizeOf,
} from './viewports';

type CanvasBarProps = {
  state: ShellState;
  store: ShellStore;
};

/** Along the canvas's top edge: what the canvas shows, and how it's connected (TRU-3.5). */
export function CanvasBar({ state, store }: CanvasBarProps) {
  const sideBySide = state.layout === 'side-by-side';
  const current = sizeOf(state.viewport, state.canvas);
  const deviceLabel = sideBySide
    ? 'Phone, Tablet, Desktop'
    : state.viewport.kind === 'preset'
      ? `${PRESETS[state.viewport.preset].label} · ${current.width} × ${current.height}`
      : state.viewport.kind === 'fill'
        ? `Fill · ${current.width} × ${current.height}`
        : `Custom · ${current.width} × ${current.height}`;
  const canvasSize = sizeOf({ kind: 'fill' }, state.canvas);

  // In a landmark, like the canvas and the docks.
  return (
    <header className="canvas-bar">
      <form
        className="route"
        aria-label="Route"
        action={(data) => {
          store.navigate(String(data.get('route') ?? ''));
        }}
      >
        {/* Keyed by the route, so it shows where the frames are without mirroring state. */}
        <input
          key={state.route}
          name="route"
          aria-label="Route"
          defaultValue={state.route}
          spellCheck={false}
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.currentTarget.value = state.route;
            event.currentTarget.blur();
          }}
        />
        <button
          type="button"
          className="tool"
          aria-label="Reload"
          title="Reload"
          onClick={() => store.reload()}
        >
          <RotateCw aria-hidden size={16} />
        </button>
      </form>

      <button
        type="button"
        className="device-button"
        popoverTarget="device-menu"
        aria-label={`Viewport: ${deviceLabel}`}
      >
        {deviceLabel}
        <ChevronDown aria-hidden size={16} />
      </button>
      <div
        id="device-menu"
        className="menu"
        popover="auto"
        aria-label="Viewport"
      >
        <p className="menu-heading">Viewport</p>
        {PRESET_IDS.map((id) => {
          const preset = PRESETS[id];
          return (
            <button
              key={id}
              type="button"
              className="menu-row"
              aria-pressed={
                !sideBySide &&
                state.viewport.kind === 'preset' &&
                state.viewport.preset === id
              }
              popoverTarget="device-menu"
              popoverTargetAction="hide"
              onClick={() => store.setViewport({ kind: 'preset', preset: id })}
            >
              <span>{preset.label}</span>{' '}
              <span className="menu-size">
                {preset.width} × {preset.height}
              </span>
            </button>
          );
        })}
        {/* One frame at the canvas's own size, without device chrome (TRU-2.3). */}
        <button
          type="button"
          className="menu-row"
          aria-pressed={!sideBySide && state.viewport.kind === 'fill'}
          popoverTarget="device-menu"
          popoverTargetAction="hide"
          onClick={() => store.setViewport({ kind: 'fill' })}
        >
          <span>Fill</span>{' '}
          <span className="menu-size">
            {canvasSize.width} × {canvasSize.height}
          </span>
        </button>
        {/* Airship's device list, by group; one group open at a time. */}
        {PRESET_GROUPS.map((group) => (
          <details key={group.id} className="menu-group" name="device-group">
            <summary>
              <ChevronRight aria-hidden size={12} className="menu-chevron" />
              {group.label} devices
            </summary>
            {group.presets.map((device) => (
              <button
                key={device.id}
                type="button"
                className="menu-row menu-row-device"
                aria-pressed={
                  !sideBySide &&
                  state.viewport.kind === 'custom' &&
                  state.viewport.width === device.width &&
                  state.viewport.height === device.height
                }
                popoverTarget="device-menu"
                popoverTargetAction="hide"
                onClick={() =>
                  store.setViewport({
                    kind: 'custom',
                    width: device.width,
                    height: device.height,
                  })
                }
              >
                <span>{device.label}</span>{' '}
                <span className="menu-size">
                  {device.width} × {device.height}
                </span>
              </button>
            ))}
          </details>
        ))}
        <form
          className="menu-custom"
          aria-label="Custom size"
          action={(data) => {
            store.setViewport({
              kind: 'custom',
              width: clampSize(Number(data.get('width'))),
              height: clampSize(Number(data.get('height'))),
            });
            document.getElementById('device-menu')?.hidePopover();
          }}
        >
          <span>Custom</span>
          <input
            key={`w${current.width}`}
            name="width"
            type="number"
            inputMode="numeric"
            aria-label="Width"
            defaultValue={current.width}
            min={MIN_SIZE}
            max={MAX_SIZE}
          />
          <span aria-hidden>×</span>
          <input
            key={`h${current.height}`}
            name="height"
            type="number"
            inputMode="numeric"
            aria-label="Height"
            defaultValue={current.height}
            min={MIN_SIZE}
            max={MAX_SIZE}
          />
          <button type="submit" className="menu-apply">
            Apply
          </button>
        </form>
      </div>

      <button
        type="button"
        className="tool"
        aria-pressed={sideBySide}
        aria-label="Side by side"
        title="Phone, Tablet and Desktop side by side"
        onClick={() => store.setLayout(sideBySide ? 'single' : 'side-by-side')}
      >
        <Columns3 aria-hidden size={16} />
      </button>

      <output
        className="connection"
        data-state={state.connection}
        title={
          state.connection === 'open'
            ? 'Connected to Truing'
            : 'Not connected to Truing'
        }
      />
    </header>
  );
}
