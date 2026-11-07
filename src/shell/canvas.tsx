import { X } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';

import { panels } from 'truing:panels';

import { routeOf } from '../protocol';

import { LABEL_SPACE, type Rect } from './camera';
import { PanelBoundary, panelProps } from './module-section';
import {
  frameLabel,
  frameName,
  framesInert,
  frameRects,
  openedIds,
  isFill,
  type FrameState,
  type ShellState,
  GRIPS,
  type Grip,
  type ShellStore,
  panReady,
} from './store';

type CanvasProps = {
  state: ShellState;
  store: ShellStore;
};

/**
 * The canvas takes the room the panels leave. Frames sit at their real
 * pixel size in one world that pans and zooms; the app inside each frame lays
 * out at its real width whatever the zoom.
 */
export function Canvas({ state, store }: CanvasProps) {
  const { attachCanvas, attachWorld, attachChrome } = store;
  const placed = frameRects(state);
  // Fill: the frame is the canvas, without a label, grips or a border.
  const fill = isFill(state);

  return (
    <main
      ref={attachCanvas}
      className="canvas"
      aria-label="Canvas"
      data-mode={state.mode}
      data-pan={
        state.panning ? 'dragging' : panReady(state) ? 'ready' : undefined
      }
      data-inert={framesInert(state) || undefined}
      data-fill={fill || undefined}
      // The canvas takes focus when a frame is clicked in Select mode, so
      // Enter and Tab move the pick (TRU-2.3).
      tabIndex={-1}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) store.selectFrame(null);
      }}
    >
      {!state.appOrigin ? (
        <p className="canvas-message">
          {state.connection === 'closed'
            ? "Truing's server isn't answering. Run truing again."
            : 'Connecting to Truing…'}
        </p>
      ) : null}

      <div className="world" ref={attachWorld}>
        {placed.map(({ frame, rect }) => {
          const label = frameLabel(state, frame.id);
          return (
            <div
              key={frame.id}
              className="frame-card"
              data-frame={frame.id}
              data-active={state.activeFrame === frame.id}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
              }}
            >
              <iframe
                // A new element per load: a typed route and a reload without a runtime are fresh loads.
                key={frame.loads}
                name={frameName(frame.id)}
                title={`${label} view of the app`}
                src={`${state.appOrigin}${frame.src}`}
                width={rect.width}
                height={rect.height}
                allow="clipboard-read; clipboard-write; fullscreen"
              />
            </div>
          );
        })}
      </div>

      <div className="canvas-chrome" ref={attachChrome}>
        <FrameChrome placed={placed} fill={fill} state={state} store={store} />
        <ModuleCanvases placed={placed} state={state} store={store} />
      </div>
    </main>
  );
}

/**
 * What modules draw over the canvas (TRU-5.2), in the layer that moves with it, so
 * a pan renders nothing here.
 */
function ModuleCanvases({
  placed,
  state,
  store,
}: CanvasProps & { placed: ReadonlyArray<{ frame: FrameState; rect: Rect }> }) {
  const scale = useSyncExternalStore(store.subscribeScale, store.getScale);
  const place = (frame: string, point: { x: number; y: number }) => {
    const rect = placed.find((entry) => entry.frame.id === frame)?.rect;
    return rect
      ? {
          left: (rect.x + point.x) * scale,
          top: (rect.y + point.y) * scale,
        }
      : null;
  };

  return panels.flatMap(({ module, panel }) => {
    const Drawn = panel?.canvas;
    if (!Drawn || panel.module.id !== module.id) return [];
    return [
      <PanelBoundary key={module.id}>
        <Drawn {...panelProps(module, state, store)} place={place} />
      </PanelBoundary>,
    ];
  });
}

/**
 * The handles and labels, in screen space so they keep their size at any zoom.
 * They sit relative to the camera's position, which moves their layer, so a
 * pan renders nothing here, and a zoom only this.
 */
function FrameChrome({
  placed,
  fill,
  state,
  store,
}: CanvasProps & {
  placed: ReadonlyArray<{ frame: FrameState; rect: Rect }>;
  fill: boolean;
}) {
  const scale = useSyncExternalStore(store.subscribeScale, store.getScale);

  return (
    <>
      {/*
        Edge handles. The Custom size fields in the viewport menu do the same
        from the keyboard.
      */}
      {(fill ? [] : placed).map(({ frame, rect }) => {
        const left = rect.x * scale;
        const top = rect.y * scale;
        const width = rect.width * scale;
        const height = rect.height * scale;
        return (
          <div key={frame.id} aria-hidden className="frame-handles">
            {GRIPS.map((grip) => (
              <div
                key={grip}
                className="frame-handle"
                data-grip={grip}
                style={gripStyle(grip, left, top, width, height)}
                onPointerDown={(event) => {
                  if (event.button !== 0 || panReady(state)) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  store.startResize(
                    frame.id,
                    grip,
                    event.clientX,
                    event.clientY,
                  );
                }}
                onPointerMove={(event) =>
                  store.moveResize(event.clientX, event.clientY)
                }
                onPointerUp={() => store.endResize()}
                onPointerCancel={() => store.endResize()}
              />
            ))}
          </div>
        );
      })}

      {/* Labels, readable at any zoom. */}
      {placed.map(({ frame, rect }) => {
        const label = frameLabel(state, frame.id);
        const at = frame.href ? routeOf(frame.href, state.appOrigin) : null;
        return (
          <div
            key={frame.id}
            // In Fill the label is gone from sight, but the frame's status
            // is still read out.
            className={fill ? 'frame-label visually-hidden' : 'frame-label'}
            data-active={state.activeFrame === frame.id}
            style={{
              left: rect.x * scale,
              top: rect.y * scale - LABEL_SPACE + 4,
              width: rect.width * scale,
            }}
          >
            <FrameName
              id={frame.id}
              label={label}
              active={state.activeFrame === frame.id}
              renames={openedIds(state).includes(frame.id)}
              store={store}
            />
            <span className="frame-size">
              {rect.width} × {rect.height}
            </span>
            <span
              className="frame-route"
              data-live={frame.connected}
              role="status"
              aria-label={`${label} frame at ${at ?? frame.src}, ${frame.connected ? 'connected' : 'loading'}`}
              title={
                frame.connected
                  ? `${frame.title || 'Connected'}${frame.pingMs === null ? '' : ` · ${frame.pingMs} ms`}`
                  : 'Loading'
              }
            >
              {at ?? frame.src}
            </span>
            {openedIds(state).includes(frame.id) ? (
              <button
                type="button"
                className="frame-close"
                aria-label={`Close the frame at ${at ?? frame.src}`}
                onClick={() => store.closeFrame(frame.id)}
              >
                <X aria-hidden size={12} />
              </button>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/**
 * A frame's name, which selects it. A record frame's is renamed in place with
 * a double-click: Enter or leaving the field keeps it, Esc puts it back (TRU-14.2).
 */
function FrameName({
  id,
  label,
  active,
  renames,
  store,
}: {
  id: string;
  label: string;
  active: boolean;
  renames: boolean;
  store: ShellStore;
}) {
  const [editing, setEditing] = useState(false);
  // Esc closes the field, and the blur that may follow must not keep the name.
  const cancelled = useRef(false);
  if (editing) {
    return (
      <input
        className="frame-rename"
        aria-label="Frame name"
        defaultValue={label}
        // The person asked for this field with a double-click.
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            event.stopPropagation();
            cancelled.current = true;
            setEditing(false);
          }
        }}
        onBlur={(event) => {
          if (!cancelled.current) {
            store.renameFrame(id, event.currentTarget.value);
          }
          cancelled.current = false;
          setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className="frame-name"
      aria-pressed={active}
      title={renames ? 'Double-click to rename' : undefined}
      onClick={() => store.selectFrame(id)}
      onDoubleClick={() => {
        if (!renames) return;
        cancelled.current = false;
        setEditing(true);
      }}
    >
      {label}
    </button>
  );
}

/** Airship's grip sizes: 8 px edge strips that stop short of 12 px corner squares. */
const EDGE = 8;
const CORNER = 12;

function gripStyle(
  grip: Grip,
  left: number,
  top: number,
  width: number,
  height: number,
): React.CSSProperties {
  const right = left + width;
  const bottom = top + height;
  if (grip.length === 2) {
    return {
      left: (grip.includes('w') ? left : right) - CORNER / 2,
      top: (grip.includes('n') ? top : bottom) - CORNER / 2,
      width: CORNER,
      height: CORNER,
    };
  }
  if (grip === 'n' || grip === 's') {
    return {
      left: left + EDGE,
      top: (grip === 'n' ? top : bottom) - EDGE / 2,
      width: Math.max(0, width - EDGE * 2),
      height: EDGE,
    };
  }
  return {
    left: (grip === 'w' ? left : right) - EDGE / 2,
    top: top + EDGE,
    width: EDGE,
    height: Math.max(0, height - EDGE * 2),
  };
}
