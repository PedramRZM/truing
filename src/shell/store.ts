import { isEditableTarget } from '../commands';
import type { LeftTab, PanelFrame, RightView, StagedChange } from '../module';
import {
  type Board,
  type CanvasShortcut,
  FRAME_NAME_PREFIX,
  MODES,
  type Mode,
  type ModuleFailure,
  parseMessage,
  type ReportEntry,
  routeOf,
  type ShellMessage,
  type StateEntry,
  toShellSchema,
  type View,
} from '../protocol';
import { matchPreset } from '../vendor/airship/frames';

import {
  boundsOf,
  type Camera,
  fitCamera,
  layoutFrames,
  type Rect,
  type Point,
  stepScale,
  wheelPixels,
  wheelZoomFactor,
  zoomAt,
} from './camera';
import {
  CANVAS_BAR,
  type Docks,
  fitPanels,
  LEFT_SPACE,
  loadLeftTab,
  loadPanels,
  loadRightView,
  saveLeftTab,
  savePanels,
  saveRightView,
} from './panels';
import {
  clampSize,
  PRESETS,
  PRESET_IDS,
  type PresetId,
  type Size,
  sizeOf,
  type Viewport,
} from './viewports';

/** One frame in the canvas: what the shell asked it to load, and what it reports. */
export type FrameState = {
  id: string;
  /** Path the shell last sent the frame to; changing it navigates the frame. */
  src: string;
  /** Bumped to load `src` again in a new iframe element. */
  loads: number;
  /** Where the frame's runtime says it is, once it has said hello. */
  href: string | null;
  title: string;
  connected: boolean;
  pingMs: number | null;
  /**
   * TRU-14.2: a record frame's own device. The layout's frames (main, or Phone,
   * Tablet and Desktop) have none and take the layout's.
   */
  viewport?: Viewport;
  /** Record frames with the same group follow each other's route. */
  group?: string;
  /** What the person or Claude called it; the device's name otherwise. */
  name?: string;
  /** Who opened it: Claude's frames are marked, and closing them leaves a person's. */
  by?: 'person' | 'claude';
};

/** module → report name → frame → the latest payload */
export type ModuleReports = Record<
  string,
  Record<string, Record<string, unknown>>
>;

/** What the modules' server side says (TRU-1.6). A panel's own crash stays in its section. */
export type ModulesState = {
  reports: ModuleReports;
  failures: ModuleFailure[];
  changes: StagedChange[];
  /** module → name → what its server part last published */
  state: Record<string, Record<string, unknown>>;
};

export type Layout = 'single' | 'side-by-side';

export type ShellState = {
  connection: 'connecting' | 'open' | 'closed';
  appOrigin: string;
  /** The config's `name`; empty until the server's first welcome. */
  projectName: string;
  hasTokens: boolean;
  mode: Mode;
  layout: Layout;
  viewport: Viewport;
  /** The route every frame shows, as path, search and hash. */
  route: string;
  activeFrame: string | null;
  /** The frame the others follow: the one last clicked or typed in. */
  leader: string;
  frames: Record<string, FrameState>;
  canvas: Size;
  /** The panels showing: the designer's choice, less what the window can't fit. */
  docks: Docks;
  /** The left panel's tab, kept between runs. */
  leftTab: LeftTab;
  /** The right panel's view, kept between runs (TRU-5.2). */
  rightView: RightView;
  /** `.`: everything but the canvas is out of sight. */
  chromeHidden: boolean;
  /** The hand tool (H): dragging anywhere pans the canvas. */
  handTool: boolean;
  /** Spacing (S, TRU-2.5): hovering shows the box model and distances without Alt. */
  spacing: boolean;
  /** Space is held: the canvas pans while it is. */
  spaceHeld: boolean;
  /** A pan drag is under way. */
  panning: boolean;
  /** Sizes set by dragging a frame's edges, by frame. */
  resized: Record<string, Size>;
  /** How far a left or top edge drag moved each frame's origin. */
  offsets: Record<string, Point>;
  /** An edge drag is under way. */
  resizing: boolean;
  modules: ModulesState;
  /** The context menu, open at a point on the screen for a frame's pick. */
  menu: ContextMenu | null;
  /** The last short confirmation ("Copied the path"); `id` tells two of the same text apart. */
  notice: {
    id: number;
    text: string;
    /** One thing to do about it, such as Undo (TRU-14.2). */
    action?: { label: string; run: () => void };
  } | null;
};

/** Where the menu is on the screen, and the right-click in the frame's own pixels (null from a tree row). */
export type ContextMenu = {
  id: number;
  frame: string;
  x: number;
  y: number;
  point: { x: number; y: number } | null;
  /** TRU-14.2: the link under the pointer, when there is one. */
  link?: string;
};

/** How long a notice stays: the design language's Toast. */
const NOTICE_MS = 1500;

/** A notice that offers Undo stays long enough to reach it. */
const UNDO_MS = 6000;

/** TRU-14.1 measured 12 frames of a heavy page at about 620 MB: the default cap. */
export const FRAME_CAP = 12;

const CHROME_HIDDEN_NOTICE = 'Press the period key to bring everything back.';

/** How often the frames hear a zoom that's under way. */
const VIEW_EVERY_MS = 100;

/** Airship's eight grips: the four edges and the four corners. */
export const GRIPS = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const;
export type Grip = (typeof GRIPS)[number];

/** While true, frames ignore the pointer so a drag over them pans the canvas. */
export function panReady(state: ShellState): boolean {
  return state.handTool || state.spaceHeld || state.panning;
}

/** While true, frames ignore the pointer: a pan or an edge drag passes over them. */
export function framesInert(state: ShellState): boolean {
  return panReady(state) || state.resizing;
}

declare global {
  interface Window {
    __truingShell?: { token: string; wsUrl: string };
  }
}

const SINGLE_FRAME = 'main';

function frameIds(layout: Layout): readonly string[] {
  return layout === 'single' ? [SINGLE_FRAME] : PRESET_IDS;
}

/**
 * TRU-14.6: the frames for pages the app opened in a new tab, in the order they
 * opened: every frame that isn't one of the layout's own. Each navigates on its own.
 */
export function openedIds(
  state: Pick<ShellState, 'layout' | 'frames'>,
): string[] {
  const own = frameIds(state.layout);
  return Object.keys(state.frames).filter((id) => !own.includes(id));
}

/** Every frame's id in display order: the layout's frames, then the opened ones. */
function displayIds(state: Pick<ShellState, 'layout' | 'frames'>): string[] {
  return [...frameIds(state.layout), ...openedIds(state)];
}

/** What `record` holds for opened frames, kept when the layout's frames are rebuilt. */
function ofOpened<T>(
  state: Pick<ShellState, 'layout' | 'frames'>,
  record: Record<string, T>,
): Record<string, T> {
  const opened = openedIds(state);
  return Object.fromEntries(
    Object.entries(record).filter(([id]) => opened.includes(id)),
  );
}

/**
 * TRU-14.6: a frame for a page the app opened in a new tab, beside the others
 * and at the size of the frame it most likely came from: the active one, or
 * the leader.
 */
export function withOpenedFrame(
  state: ShellState,
  id: string,
  route: string,
  options: {
    /** The frame it came from, whose device it takes; the selected one otherwise. */
    from?: string;
    /** Its name; none shows its device. A new tab is called New tab. */
    name?: string | null;
    by?: 'person' | 'claude';
  } = {},
): Pick<ShellState, 'frames' | 'resized'> {
  const from =
    options.from && state.frames[options.from]
      ? options.from
      : (state.activeFrame ?? state.leader);
  const opener = state.frames[from] ? from : Object.keys(state.frames)[0];
  const name = options.name === null ? null : (options.name ?? 'New tab');
  return {
    frames: {
      ...state.frames,
      [id]: {
        ...newFrame(id, route),
        // The device of the frame it came from, so it reads as the same size.
        ...(opener ? { viewport: frameViewport(state, opener) } : {}),
        ...(name ? { name } : {}),
        by: options.by ?? 'person',
      },
    },
    resized: state.resized,
  };
}

/** A frame's route: where it reports it is, or where it was sent while it loads. */
export function routeOfFrame(
  state: Pick<ShellState, 'frames' | 'appOrigin'>,
  id: string,
): string | null {
  const frame = state.frames[id];
  if (!frame) return null;
  return (frame.href && routeOf(frame.href, state.appOrigin)) ?? frame.src;
}

/** The record frames that follow each other with `id`, itself included, in display order. */
export function groupOf(state: ShellState, id: string): string[] {
  const group = state.frames[id]?.group;
  if (!group || !openedIds(state).includes(id)) return [id];
  return openedIds(state).filter((key) => state.frames[key]?.group === group);
}

/** The record frame the top bar acts on, or null when it acts on the layout. */
export function selectedRecord(state: ShellState): string | null {
  const id = state.activeFrame;
  return id && openedIds(state).includes(id) ? id : null;
}

/** What the top bar shows: the selected record frame's, or the layout's (TRU-14.2). */
export function barView(state: ShellState): {
  route: string;
  viewport: Viewport;
  sideBySide: boolean;
} {
  const id = selectedRecord(state);
  if (!id) {
    return {
      route: state.route,
      viewport: state.viewport,
      sideBySide: state.layout === 'side-by-side',
    };
  }
  return {
    route: routeOfFrame(state, id) ?? state.route,
    viewport: frameViewport(state, id),
    sideBySide: groupOf(state, id).length > 1,
  };
}

type FramesPatch = Pick<
  ShellState,
  'frames' | 'resized' | 'offsets' | 'activeFrame'
>;

/** `frames` with `id` replaced by `entries`, in its place, so the display order holds. */
function replacing(
  frames: Record<string, FrameState>,
  id: string,
  entries: Array<[string, FrameState]>,
): Record<string, FrameState> {
  return Object.fromEntries(
    Object.entries(frames).flatMap(([key, frame]) =>
      key === id ? entries : [[key, frame] as [string, FrameState]],
    ),
  );
}

function withoutKeys<T>(
  record: Record<string, T>,
  keys: readonly string[],
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !keys.includes(key)),
  );
}

/** A record frame's group folded back to `id` alone, at its own device. */
function folded(state: ShellState, id: string): FramesPatch {
  const others = groupOf(state, id).filter((key) => key !== id);
  const frame = state.frames[id];
  const frames = withoutKeys(state.frames, others);
  if (frame) {
    const { group: _group, ...alone } = frame;
    frames[id] = { ...alone, viewport: frameViewport(state, id) };
  }
  return {
    frames,
    resized: withoutKeys(state.resized, others),
    offsets: withoutKeys(state.offsets, others),
    activeFrame: id,
  };
}

/**
 * TRU-14.2: Side by side for a record frame. One frame becomes a Phone, Tablet
 * and Desktop group on one route, the frame itself the Desktop; a group folds
 * back to the selected frame. Null for the layout's frames, which the layout
 * toggle handles.
 */
export function withSideBySide(
  state: ShellState,
  id: string,
): FramesPatch | null {
  const frame = state.frames[id];
  if (!frame || !openedIds(state).includes(id)) return null;
  if (groupOf(state, id).length > 1) return folded(state, id);
  const route = routeOfFrame(state, id) ?? frame.src;
  const copy = (preset: PresetId): [string, FrameState] => [
    `${id}-${preset}`,
    {
      ...newFrame(`${id}-${preset}`, route),
      viewport: { kind: 'preset', preset },
      group: id,
      ...(frame.by ? { by: frame.by } : {}),
    },
  ];
  const others = PRESET_IDS.filter((preset) => preset !== 'desktop');
  return {
    frames: replacing(state.frames, id, [
      ...others.map(copy),
      [
        id,
        {
          ...frame,
          viewport: { kind: 'preset', preset: 'desktop' },
          group: id,
        },
      ],
    ]),
    resized: withoutKeys(state.resized, [id]),
    offsets: state.offsets,
    activeFrame: id,
  };
}

/** The device menu for a record frame: its own device; a group folds back to it first. */
export function withFrameViewport(
  state: ShellState,
  id: string,
  viewport: Viewport,
): FramesPatch | null {
  if (!openedIds(state).includes(id)) return null;
  const alone = folded(state, id);
  const frame = alone.frames[id];
  if (!frame) return null;
  return {
    ...alone,
    frames: { ...alone.frames, [id]: { ...frame, viewport } },
    resized: withoutKeys(alone.resized, [id]),
  };
}

/** The route box for a record frame: its whole group goes there. */
export function withGroupRoute(
  state: ShellState,
  id: string,
  route: string,
): Pick<ShellState, 'frames'> | null {
  if (!openedIds(state).includes(id)) return null;
  const members = groupOf(state, id);
  return {
    frames: Object.fromEntries(
      Object.entries(state.frames).map(([key, frame]) => [
        key,
        members.includes(key)
          ? { ...frame, src: route, loads: frame.loads + 1, connected: false }
          : frame,
      ]),
    ),
  };
}

/** TRU-14.2: the board to save: the layout's view, and each record frame as set. */
export function boardOf(
  state: Pick<
    ShellState,
    | 'layout'
    | 'viewport'
    | 'route'
    | 'frames'
    | 'resized'
    | 'offsets'
    | 'appOrigin'
  >,
): Board {
  return {
    version: 1,
    layout: state.layout,
    viewport: state.viewport,
    route: state.route,
    frames: openedIds(state).flatMap((id) => {
      const frame = state.frames[id];
      if (!frame) return [];
      const size = state.resized[id];
      const offset = state.offsets[id];
      return [
        {
          id,
          route: routeOfFrame(state, id) ?? frame.src,
          ...(frame.viewport ? { viewport: frame.viewport } : {}),
          ...(frame.group ? { group: frame.group } : {}),
          ...(frame.name ? { name: frame.name } : {}),
          ...(frame.by ? { by: frame.by } : {}),
          ...(size ? { size } : {}),
          ...(offset ? { offset } : {}),
        },
      ];
    }),
  };
}

/** A saved board as the shell's state, the layout's frames at `route`. */
export function fromBoard(
  board: Board,
  route: string,
): Pick<
  ShellState,
  'layout' | 'viewport' | 'route' | 'leader' | 'frames' | 'resized' | 'offsets'
> {
  const frames: Record<string, FrameState> = Object.fromEntries(
    frameIds(board.layout).map((id) => [id, newFrame(id, route)]),
  );
  const resized: Record<string, Size> = {};
  const offsets: Record<string, Point> = {};
  for (const saved of board.frames) {
    frames[saved.id] = {
      ...newFrame(saved.id, saved.route),
      ...(saved.viewport ? { viewport: saved.viewport } : {}),
      ...(saved.group ? { group: saved.group } : {}),
      ...(saved.name ? { name: saved.name } : {}),
      ...(saved.by ? { by: saved.by } : {}),
    };
    if (saved.size) resized[saved.id] = saved.size;
    if (saved.offset) offsets[saved.id] = saved.offset;
  }
  return {
    layout: board.layout,
    viewport: board.viewport,
    route,
    leader: defaultLeader(board.layout),
    frames,
    resized,
    offsets,
  };
}

/** The state without an opened frame, or null for any other frame. */
export function withoutOpenedFrame(
  state: ShellState,
  id: string,
): Pick<ShellState, 'frames' | 'resized' | 'offsets' | 'activeFrame'> | null {
  if (!openedIds(state).includes(id)) return null;
  const without = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
  return {
    frames: without(state.frames),
    resized: without(state.resized),
    offsets: without(state.offsets),
    activeFrame: state.activeFrame === id ? null : state.activeFrame,
  };
}

function defaultLeader(layout: Layout): string {
  return layout === 'single' ? SINGLE_FRAME : 'desktop';
}

function isPresetId(id: string): id is PresetId {
  return (PRESET_IDS as readonly string[]).includes(id);
}

export function frameName(id: string): string {
  return `${FRAME_NAME_PREFIX}${id}`;
}

/** Fill: one frame at the canvas's own size, the camera at 100% and the origin. */
export function isFill(state: ShellState): boolean {
  return state.layout === 'single' && state.viewport.kind === 'fill';
}

const ORIGIN: Camera = { x: 0, y: 0, scale: 1 };

/** The preset a side-by-side frame shows; the single frame shows the chosen viewport. */
export function frameViewport(state: ShellState, id: string): Viewport {
  const own = state.resized[id];
  if (own) {
    return { kind: 'custom', width: own.width, height: own.height };
  }
  const record = state.frames[id]?.viewport;
  if (record) return record;
  if (state.layout === 'side-by-side' && isPresetId(id)) {
    return { kind: 'preset', preset: id };
  }
  return state.viewport;
}

/** Each frame's rectangle in world space, in display order. */
export function frameRects(
  state: ShellState,
): Array<{ frame: FrameState; rect: Rect }> {
  const frames = displayIds(state).flatMap((id) => state.frames[id] ?? []);
  const rects = layoutFrames(
    frames.map((frame) => ({
      size: sizeOf(frameViewport(state, frame.id), state.canvas),
      offset: state.offsets[frame.id],
    })),
  );
  return frames.flatMap((frame, index) => {
    const rect = rects[index];
    return rect ? [{ frame, rect }] : [];
  });
}

/** Where the canvas starts in the window: the camera works from there. */
export function canvasLeft(
  state: Pick<ShellState, 'docks' | 'chromeHidden'>,
): number {
  return state.docks.left && !state.chromeHidden ? LEFT_SPACE : 0;
}

/** Where the canvas starts going down the window: under its bar. */
export function canvasTop(state: Pick<ShellState, 'chromeHidden'>): number {
  return state.chromeHidden ? 0 : CANVAS_BAR;
}

/** The canvas, with a floor for a very small window. */
export function safeRect(state: ShellState): Rect {
  return {
    x: 0,
    y: 0,
    width: Math.max(320, state.canvas.width),
    height: Math.max(200, state.canvas.height),
  };
}

/**
 * A frame's name, or its device: our preset's name, the device a custom size
 * matches in Airship's list, or Custom. In a group the device tells them apart.
 */
export function frameLabel(state: ShellState, id: string): string {
  const name = state.frames[id]?.name;
  if (name && groupOf(state, id).length === 1) return name;
  const viewport = frameViewport(state, id);
  if (viewport.kind === 'preset') {
    return PRESETS[viewport.preset].label;
  }
  if (viewport.kind === 'fill') {
    return 'Fill';
  }
  return matchPreset(viewport.width, viewport.height)?.label ?? 'Custom';
}

/** The frames as a panel sees them, in display order. */
export function panelFrames(state: ShellState): PanelFrame[] {
  return frameRects(state).map(({ frame, rect }) => ({
    id: frame.id,
    label: frameLabel(state, frame.id),
    href: frame.href,
    connected: frame.connected,
    width: rect.width,
    height: rect.height,
  }));
}

function reportsFrom(entries: readonly ReportEntry[]): ModuleReports {
  const reports: ModuleReports = {};
  for (const { module, name, frame, payload } of entries) {
    const byName = (reports[module] ??= {});
    const byFrame = (byName[name] ??= {});
    byFrame[frame] = payload;
  }
  return reports;
}

function stateFrom(entries: readonly StateEntry[]): ModulesState['state'] {
  const state: ModulesState['state'] = {};
  for (const { module, name, value } of entries) {
    (state[module] ??= {})[name] = value;
  }
  return state;
}

/** The modules' state without anything from one frame: it reloaded or went away. */
function withoutFrame(modules: ModulesState, frame: string): ModulesState {
  const reports: ModuleReports = {};
  for (const [module, byName] of Object.entries(modules.reports)) {
    reports[module] = Object.fromEntries(
      Object.entries(byName).map(([name, byFrame]) => [
        name,
        Object.fromEntries(
          Object.entries(byFrame).filter(([id]) => id !== frame),
        ),
      ]),
    );
  }
  return {
    ...modules,
    reports,
    failures: modules.failures.filter(
      (failure) => !(failure.part === 'probe' && failure.frame === frame),
    ),
  };
}

/** What a typed route box value means: a path on the app, or nothing usable. */
export function normalizeRoute(
  input: string,
  appOrigin: string,
): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }
  if (/^https?:\/\//i.test(value)) {
    return routeOf(value, appOrigin);
  }
  return value.startsWith('/') ? value : `/${value}`;
}

function newFrame(id: string, src: string): FrameState {
  return {
    id,
    src,
    loads: 0,
    href: null,
    title: '',
    connected: false,
    pingMs: null,
  };
}

type Listener = () => void;

export function createShellStore(rightViews: readonly RightView[] = []) {
  /** What the designer last chose, kept between runs; a small window shows less. */
  let chosenPanels = loadPanels();
  let windowWidth = window.innerWidth;
  let state: ShellState = {
    connection: 'connecting',
    appOrigin: '',
    projectName: '',
    hasTokens: true,
    mode: MODES.interact,
    layout: 'single',
    viewport: { kind: 'preset', preset: 'desktop' },
    route: '/',
    activeFrame: null,
    leader: SINGLE_FRAME,
    frames: {},
    canvas: { width: 0, height: 0 },
    docks: fitPanels(chosenPanels, windowWidth),
    leftTab: loadLeftTab(),
    rightView: loadRightView(rightViews),
    chromeHidden: false,
    handTool: false,
    spacing: false,
    spaceHeld: false,
    panning: false,
    resized: {},
    offsets: {},
    resizing: false,
    modules: { reports: {}, failures: [], changes: [], state: {} },
    menu: null,
    notice: null,
  };
  const listeners = new Set<Listener>();
  let socket: WebSocket | null = null;
  let canvasNode: HTMLElement | null = null;
  let menuId = 0;
  let menuReturn: HTMLElement | null = null;
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Until the designer pans or zooms, the frames are kept fitted as things change. */
  let followFit = true;
  /** Frames opened from new tabs so far, for their ids (TRU-14.6). */
  let openedFrames = 0;
  /** The frame each record group follows: the one last clicked in it (TRU-14.2). */
  const groupLeaders = new Map<string, string>();

  function set(next: Partial<ShellState>): void {
    state = { ...state, ...next };
    if (
      followFit &&
      ('frames' in next ||
        'layout' in next ||
        'viewport' in next ||
        'canvas' in next)
    ) {
      moveCamera(fittedCamera());
    }
    sendView();
    saveBoardSoon();
    for (const listener of listeners) listener();
  }

  /** TRU-14.2: the board goes to the server a moment after it last changed. */
  let savedBoard = '';
  let boardTimer: ReturnType<typeof setTimeout> | null = null;
  function saveBoardSoon(): void {
    // Nothing to save before the server's welcome says which app this is.
    if (state.appOrigin === '') return;
    const board = boardOf(state);
    const text = JSON.stringify(board);
    if (text === savedBoard) return;
    if (boardTimer) clearTimeout(boardTimer);
    boardTimer = setTimeout(() => {
      boardTimer = null;
      savedBoard = text;
      send({ type: 'save-board', board });
    }, 400);
  }

  // The camera moves on every pointer event of a pan, so it stays out of
  // `state`, which re-renders the shell. A pan only writes two transforms on
  // composited layers, once a frame; only a new zoom renders anything, and
  // only what's sized by it.
  let camera: Camera = { x: 0, y: 0, scale: 1 };
  let worldNode: HTMLElement | null = null;
  let chromeNode: HTMLElement | null = null;
  let cameraFrame: number | null = null;
  let drawnScale = camera.scale;
  const scaleListeners = new Set<Listener>();

  function drawCamera(): void {
    const { x, y, scale } = camera;
    if (worldNode) {
      worldNode.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
    if (chromeNode) {
      chromeNode.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  function moveCamera(next: Camera): void {
    camera = next;
    cameraFrame ??= requestAnimationFrame(() => {
      cameraFrame = null;
      drawCamera();
      if (camera.scale === drawnScale) return;
      drawnScale = camera.scale;
      for (const listener of scaleListeners) listener();
      sendViewSoon();
    });
  }

  // What the frames draw for: the zoom and the Spacing toggle, sent when
  // either changes (not on a pan).
  let sentView: View | null = null;
  function sendView(): void {
    const view: View = { scale: camera.scale, spacing: state.spacing };
    if (sentView?.scale === view.scale && sentView.spacing === view.spacing) {
      return;
    }
    if (socket?.readyState !== WebSocket.OPEN) return;
    sentView = view;
    send({ type: 'set-view', view });
  }

  // A zoom gesture changes the scale every frame, and each new scale has every
  // frame draw its overlay again: they hear it a few times a second, and last.
  let viewTimer: ReturnType<typeof setTimeout> | null = null;
  function sendViewSoon(): void {
    if (viewTimer) return;
    sendView();
    viewTimer = setTimeout(() => {
      viewTimer = null;
      sendView();
    }, VIEW_EVERY_MS);
  }

  function fittedCamera(): Camera {
    if (isFill(state)) return ORIGIN;
    return fitCamera(
      boundsOf(frameRects(state).map(({ rect }) => rect)),
      safeRect(state),
    );
  }

  /**
   * Shows or hides panels. The canvas's edge moves, so a camera the designer
   * placed moves against it, and what's on the canvas stays where it is on
   * screen. A fitted camera refits when the canvas reports its new size.
   */
  function setPanels(
    next: Partial<Pick<ShellState, 'docks' | 'chromeHidden'>>,
  ): void {
    if (followFit || isFill(state)) {
      set(next);
      return;
    }
    const after = { ...state, ...next };
    const moved = {
      ...camera,
      x: camera.x + canvasLeft(state) - canvasLeft(after),
      y: camera.y + canvasTop(state) - canvasTop(after),
    };
    set(next);
    moveCamera(moved);
  }

  function setChromeHidden(hidden: boolean): void {
    setPanels({ chromeHidden: hidden });
    if (hidden) {
      notify(CHROME_HIDDEN_NOTICE);
      return;
    }
    // Everything is back, so the way back is old news.
    if (state.notice?.text === CHROME_HIDDEN_NOTICE) set({ notice: null });
  }

  function choosePanels(chosen: Docks, docks: Docks): void {
    chosenPanels = chosen;
    savePanels(chosen);
    setPanels({ docks });
  }

  /** The panels give way only when the window crosses a size where they stop fitting. */
  function onWindowResize(): void {
    const before = fitPanels(chosenPanels, windowWidth);
    windowWidth = window.innerWidth;
    const after = fitPanels(chosenPanels, windowWidth);
    if (before.left !== after.left || before.right !== after.right) {
      setPanels({ docks: after });
    }
  }

  function toggleDock(side: keyof Docks): void {
    // Panels out of sight come back first, as they were.
    if (state.chromeHidden) {
      setChromeHidden(false);
      return;
    }
    const open = !state.docks[side];
    const chosen = { ...chosenPanels, [side]: open };
    // Asked for by hand, this panel opens even where it doesn't fit. Closing
    // one can make room for the other, so that one is fitted again.
    choosePanels(chosen, { ...fitPanels(chosen, windowWidth), [side]: open });
  }

  /** Shows a tab of the left panel, bringing the panel back if it's out of sight. */
  function showLeftTab(tab: LeftTab): void {
    saveLeftTab(tab);
    set({ leftTab: tab });
    if (state.chromeHidden) setChromeHidden(false);
    if (!state.docks.left) toggleDock('left');
  }

  /** Shows a view of the right panel, bringing the panel back if it's out of sight. */
  function showRightView(view: RightView): void {
    saveRightView(view);
    set({ rightView: view });
    if (state.chromeHidden) setChromeHidden(false);
    if (!state.docks.right) toggleDock('right');
  }

  function toggleBothPanels(): void {
    if (state.chromeHidden) {
      setChromeHidden(false);
      return;
    }
    const open = !state.docks.left && !state.docks.right;
    const chosen = { left: open, right: open };
    const fitted = fitPanels(chosen, windowWidth);
    // In a window too small for either, the key still opens something.
    choosePanels(
      chosen,
      open && !fitted.left ? { left: true, right: false } : fitted,
    );
  }

  function setFrame(id: string, patch: Partial<FrameState>): void {
    const frame = state.frames[id];
    if (!frame) return;
    set({ frames: { ...state.frames, [id]: { ...frame, ...patch } } });
  }

  function send(message: ShellMessage): void {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  // A panel's calls to its module's server ops and its frames' probes.
  const calls = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  let callId = 0;
  const waitingForSocket: (() => void)[] = [];

  function request(
    message:
      | Omit<Extract<ShellMessage, { type: 'module-call' }>, 'id'>
      | Omit<Extract<ShellMessage, { type: 'module-command' }>, 'id'>,
  ): Promise<unknown> {
    // A panel in sight on load calls as it mounts, before the first socket opens.
    if (state.connection === 'connecting') {
      return new Promise((resolve, reject) => {
        waitingForSocket.push(() => {
          request(message).then(resolve, reject);
        });
      });
    }
    if (socket?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Not connected to Truing.'));
    }
    callId += 1;
    const id = callId;
    return new Promise((resolve, reject) => {
      calls.set(id, { resolve, reject });
      send({ ...message, id });
    });
  }

  function setModules(patch: Partial<ModulesState>): void {
    set({ modules: { ...state.modules, ...patch } });
  }

  function framesFor(
    layout: Layout,
    route: string,
  ): Record<string, FrameState> {
    return {
      ...Object.fromEntries(
        frameIds(layout).map((id) => [id, newFrame(id, route)]),
      ),
      ...ofOpened(state, state.frames),
    };
  }

  /** A record frame never leads the layout's frames: it navigates on its own. */
  function leaderFor(id: string): string {
    const group = state.frames[id]?.group;
    if (group && openedIds(state).includes(id)) groupLeaders.set(group, id);
    return openedIds(state).includes(id) ? state.leader : id;
  }

  /** Sends every frame but `except` to `route`, unless it is already there. */
  function follow(route: string, except: string): void {
    const frames = { ...state.frames };
    for (const [id, frame] of Object.entries(frames)) {
      if (id === except || openedIds(state).includes(id)) continue;
      // Where the frame is: its reported address while connected; while a load
      // is in flight that address is stale, so where it was sent instead.
      // (Leader on A, then B, then A again before the others load: they must
      // end on A, not stay on B.)
      const at = frame.connected
        ? frame.href && routeOf(frame.href, state.appOrigin)
        : frame.src;
      if (at === route) continue;
      frames[id] = {
        ...frame,
        src: route,
        loads: frame.loads + 1,
        connected: false,
      };
    }
    set({ route, frames });
  }

  /** Reloads each frame where it is: through its runtime, or a fresh load if it has none. */
  function reloadFrames(targets: readonly string[]): void {
    const live = targets.filter((id) => state.frames[id]?.connected);
    send({ type: 'reload', frames: live });
    const frames = { ...state.frames };
    for (const id of targets) {
      const frame = frames[id];
      if (!frame) continue;
      if (frame.connected) {
        frames[id] = { ...frame, connected: false };
        continue;
      }
      const at = frame.href ? routeOf(frame.href, state.appOrigin) : null;
      frames[id] = { ...frame, src: at ?? frame.src, loads: frame.loads + 1 };
    }
    set({ frames });
  }

  /** Loads `route` afresh in one frame, or in every frame when none is named. */
  function loadRoute(route: string, only?: string): void {
    const frames = Object.fromEntries(
      Object.entries(state.frames).map(([id, frame]) => [
        id,
        id === only || (only === undefined && !openedIds(state).includes(id))
          ? { ...frame, src: route, loads: frame.loads + 1, connected: false }
          : frame,
      ]),
    );
    set(only === undefined ? { route, frames } : { frames });
  }

  function onLocation(id: string, href: string, title: string): void {
    setFrame(id, { href, title, connected: true });
    // TRU-14.2: a record frame's group follows its own leader, as the layout's do.
    const group = state.frames[id]?.group;
    if (openedIds(state).includes(id)) {
      if (!group || (groupLeaders.get(group) ?? group) !== id) return;
      const route = routeOf(href, state.appOrigin);
      if (route === null) return;
      const frames = { ...state.frames };
      for (const key of groupOf(state, id)) {
        const frame = frames[key];
        if (!frame || key === id || routeOfFrame(state, key) === route)
          continue;
        frames[key] = {
          ...frame,
          src: route,
          loads: frame.loads + 1,
          connected: false,
        };
      }
      set({ frames });
      return;
    }
    // Only the leader moves the others. A redirect a follower makes on its own
    // (an app whose / opens a new chat each time) must not start a chase.
    if (id !== state.leader) {
      return;
    }
    const route = routeOf(href, state.appOrigin);
    if (route === null || route === state.route) {
      return;
    }
    follow(route, id);
  }

  function setCamera(next: Camera): void {
    // Fill has no canvas to move: the app scrolls in its frame instead.
    if (isFill(state)) return;
    followFit = false;
    moveCamera(next);
  }

  function connect(): void {
    const boot = window.__truingShell;
    if (!boot) {
      set({ connection: 'closed' });
      return;
    }
    const url = new URL(boot.wsUrl);
    url.searchParams.set('role', 'shell');
    url.searchParams.set('token', boot.token);
    socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      send({ type: 'hello' });
      // The server may have restarted: it hears the view again.
      sentView = null;
      set({ connection: 'open' });
      for (const run of waitingForSocket.splice(0)) run();
    });
    socket.addEventListener('close', () => {
      for (const call of calls.values()) {
        call.reject(new Error("Truing's server closed the connection."));
      }
      calls.clear();
      set({ connection: 'closed' });
      for (const run of waitingForSocket.splice(0)) run();
      setTimeout(connect, 1000);
    });
    socket.addEventListener('message', (event) => {
      const message = parseMessage(toShellSchema, event.data);
      if (!message) return;

      switch (message.type) {
        case 'welcome': {
          const modules: ModulesState = {
            reports: reportsFrom(message.modules.reports),
            failures: message.modules.failures,
            changes: message.modules.changes,
            state: stateFrom(message.modules.state),
          };
          if (state.appOrigin !== '') {
            set({ mode: message.mode, modules });
            return;
          }
          const { board } = message;
          const route =
            new URLSearchParams(location.search).get('route') ??
            board?.route ??
            message.startRoute;
          // TRU-14.2: the board as it was left, and new frames' ids after its own.
          for (const saved of board?.frames ?? []) {
            const n = Number(/^tab-(\d+)$/.exec(saved.id)?.[1] ?? 0);
            openedFrames = Math.max(openedFrames, n);
          }
          set({
            appOrigin: message.appOrigin,
            projectName: message.projectName,
            hasTokens: message.hasTokens,
            mode: message.mode,
            ...(board
              ? fromBoard(board, route)
              : { route, frames: framesFor(state.layout, route) }),
            modules,
          });
          return;
        }
        case 'mode':
          set({ mode: message.mode, handTool: false });
          return;
        case 'pan-drag': {
          // Screen pixels, measured by the frame's runtime.
          setCamera({
            ...camera,
            x: camera.x + message.dx,
            y: camera.y + message.dy,
          });
          return;
        }
        case 'runtime-hello':
          // A new page in the frame: what its last page's probes said is gone.
          set({ modules: withoutFrame(state.modules, message.frame) });
          onLocation(message.frame, message.href, message.title);
          return;
        case 'location':
          onLocation(message.frame, message.href, message.title);
          return;
        case 'runtime-ping':
          setFrame(message.frame, { pingMs: message.ms, connected: true });
          return;
        case 'interaction':
          // A click in a frame in Select mode never focuses it: the canvas
          // takes focus, so Enter and Tab move the pick rather than press
          // the last button used. Never while a frame or a field has focus.
          if (
            state.mode === MODES.select &&
            canvasNode &&
            !(document.activeElement instanceof HTMLIFrameElement) &&
            !isEditableTarget(document.activeElement)
          ) {
            canvasNode.focus({ preventScroll: true });
          }
          // A click in a frame is a click outside the menu, which the
          // shell's own page never sees.
          closeMenu();
          // TRU-14.2: a click in a frame selects it, so the top bar acts on it.
          if (
            state.frames[message.frame] &&
            (message.frame !== state.leader ||
              message.frame !== state.activeFrame)
          ) {
            set({
              leader: leaderFor(message.frame),
              activeFrame: message.frame,
            });
          }
          return;
        case 'context-menu': {
          // The point is in the frame's own pixels: place it on the screen.
          const placed = frameRects(state).find(
            ({ frame }) => frame.id === message.frame,
          );
          if (!placed) return;
          openMenu({
            ...(message.link ? { link: message.link } : {}),
            frame: message.frame,
            x:
              canvasLeft(state) +
              camera.x +
              (placed.rect.x + message.x) * camera.scale,
            y:
              canvasTop(state) +
              camera.y +
              (placed.rect.y + message.y) * camera.scale,
            point: { x: message.x, y: message.y },
          });
          return;
        }
        case 'pan-key':
          set({ spaceHeld: message.down });
          return;
        case 'shortcut':
          runShortcut(message.action);
          return;
        case 'wheel-zoom': {
          // The point is in the frame's own pixels: place it on the screen.
          const placed = frameRects(state).find(
            ({ frame }) => frame.id === message.frame,
          );
          if (!placed) return;
          zoomTo(camera.scale * wheelZoomFactor(message.deltaY), {
            x: camera.x + (placed.rect.x + message.x) * camera.scale,
            y: camera.y + (placed.rect.y + message.y) * camera.scale,
          });
          return;
        }
        case 'runtime-gone':
          set({ modules: withoutFrame(state.modules, message.frame) });
          setFrame(message.frame, {
            connected: false,
            pingMs: null,
          });
          return;
        case 'module-frame-reset': {
          const { frame } = message;
          setModules({
            reports: Object.fromEntries(
              Object.entries(state.modules.reports).map(([module, byName]) => [
                module,
                Object.fromEntries(
                  Object.entries(byName).map(([name, byFrame]) => {
                    const { [frame]: _gone, ...others } = byFrame;
                    return [name, others];
                  }),
                ),
              ]),
            ),
            failures: state.modules.failures.filter(
              (failure) =>
                !(failure.part === 'probe' && failure.frame === frame),
            ),
          });
          return;
        }
        case 'module-report': {
          const { module, name, frame, payload } = message;
          const byName = state.modules.reports[module] ?? {};
          setModules({
            reports: {
              ...state.modules.reports,
              [module]: {
                ...byName,
                [name]: { ...byName[name], [frame]: payload },
              },
            },
          });
          return;
        }
        case 'module-result': {
          const call = calls.get(message.id);
          if (!call) return;
          calls.delete(message.id);
          if (message.error !== undefined) {
            call.reject(new Error(message.error));
            return;
          }
          call.resolve(message.value);
          return;
        }
        case 'module-failed': {
          const { failure } = message;
          setModules({
            failures: [
              ...state.modules.failures.filter(
                (other) =>
                  !(
                    other.module === failure.module &&
                    other.part === failure.part &&
                    other.frame === failure.frame
                  ),
              ),
              failure,
            ],
          });
          return;
        }
        case 'changes':
          setModules({ changes: message.changes });
          return;
        case 'module-state': {
          const { module, name, value } = message;
          setModules({
            state: {
              ...state.modules.state,
              [module]: { ...state.modules.state[module], [name]: value },
            },
          });
          return;
        }
        case 'notice':
          notify(message.text);
          return;
        case 'frame-back':
          reloadFrames(
            Object.keys(state.frames).filter((id) => id !== message.frame),
          );
          loadRoute(message.route, message.frame);
          return;
        case 'reload-frames':
          reloadFrames(message.frames);
          return;
        case 'open-frame':
          // A link opened on purpose shows its device; a new tab says so.
          openFrame(
            message.route,
            message.from ? { from: message.from, name: null } : {},
          );
          return;
        case 'shell-reload':
          location.reload();
          return;
      }
    });
  }

  function openMenu(at: {
    frame: string;
    x: number;
    y: number;
    point?: { x: number; y: number };
    link?: string;
  }): void {
    menuId += 1;
    // Where focus goes back to when the menu closes.
    if (!state.menu) {
      menuReturn =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    set({
      menu: { id: menuId, ...at, point: at.point ?? null },
      activeFrame: at.frame,
      leader: state.frames[at.frame] ? leaderFor(at.frame) : state.leader,
    });
  }

  /** A confirmation goes after a moment; a failure stays until the next notice. */
  function notify(
    text: string,
    options: {
      stays?: boolean;
      action?: { label: string; run: () => void };
    } = {},
  ): void {
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = null;
    const { action } = options;
    set({
      notice: {
        id: (state.notice?.id ?? 0) + 1,
        text,
        ...(action ? { action } : {}),
      },
    });
    if (options.stays) return;
    noticeTimer = setTimeout(
      () => {
        noticeTimer = null;
        set({ notice: null });
      },
      action ? UNDO_MS : NOTICE_MS,
    );
  }

  /**
   * TRU-14.2: every way a frame is made ends here: a new tab, a link, a
   * duplicate, a page, or Claude. It is selected, so the top bar acts on it.
   */
  function openFrame(
    route: string,
    options: Parameters<typeof withOpenedFrame>[3] = {},
  ): string | null {
    if (Object.keys(state.frames).length >= FRAME_CAP) {
      notify(
        `The canvas holds ${FRAME_CAP} frames. Close one to open another.`,
      );
      return null;
    }
    openedFrames += 1;
    const id = `tab-${openedFrames}`;
    followFit = true;
    set({ ...withOpenedFrame(state, id, route, options), activeFrame: id });
    return id;
  }

  function closeMenu(): void {
    if (!state.menu) return;
    set({ menu: null });
    // Back where it was, unless the designer has moved focus on since.
    const back = menuReturn;
    menuReturn = null;
    if (
      back?.isConnected &&
      (document.activeElement === document.body ||
        document.activeElement === null)
    ) {
      back.focus({ preventScroll: true });
    }
  }

  /** Zoom keeps the selected frame in place, as in Figma; with none selected, the canvas's centre. */
  function zoomCenter(): { x: number; y: number } {
    const placed = frameRects(state).find(
      ({ frame }) => frame.id === state.activeFrame,
    );
    if (placed) {
      return {
        x: camera.x + (placed.rect.x + placed.rect.width / 2) * camera.scale,
        y: camera.y + (placed.rect.y + placed.rect.height / 2) * camera.scale,
      };
    }
    const safe = safeRect(state);
    return { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };
  }

  function zoomTo(scale: number, at?: { x: number; y: number }): void {
    setCamera(zoomAt(camera, scale, at ?? zoomCenter()));
  }

  function fit(): void {
    if (isFill(state)) return;
    followFit = true;
    moveCamera(fittedCamera());
  }

  function setViewport(viewport: Viewport): void {
    const record = selectedRecord(state);
    if (record) {
      const next = withFrameViewport(state, record, viewport);
      if (next) set(next);
      return;
    }
    if (viewport.kind === 'fill' && !isFill(state)) {
      beforeFill = {
        layout: state.layout,
        viewport: state.viewport,
        resized: state.resized,
        offsets: state.offsets,
        camera,
        followFit,
      };
    }
    followFit = true;
    if (state.layout === 'side-by-side') {
      set({
        layout: 'single',
        viewport,
        activeFrame: null,
        leader: defaultLeader('single'),
        frames: framesFor('single', state.route),
        resized: ofOpened(state, state.resized),
        offsets: ofOpened(state, state.offsets),
      });
      return;
    }
    set({
      viewport,
      resized: ofOpened(state, state.resized),
      offsets: ofOpened(state, state.offsets),
    });
  }

  function setLayout(layout: Layout): void {
    if (layout === state.layout) return;
    followFit = true;
    set({
      layout,
      activeFrame: null,
      leader: defaultLeader(layout),
      frames: framesFor(layout, state.route),
      resized: ofOpened(state, state.resized),
      offsets: ofOpened(state, state.offsets),
    });
  }

  /** Back to the view Fill replaced: its frames, their sizes, and the camera. */
  function leaveFill(): void {
    if (!isFill(state) || !beforeFill) return;
    const {
      layout,
      followFit: wasFitted,
      camera: before,
      ...view
    } = beforeFill;
    setLayout(layout);
    followFit = wasFitted;
    set({
      ...view,
      resized: { ...view.resized, ...ofOpened(state, state.resized) },
      offsets: { ...view.offsets, ...ofOpened(state, state.offsets) },
    });
    // A fitted view has just fitted itself again.
    if (!wasFitted) moveCamera(before);
  }

  function runShortcut(action: CanvasShortcut): void {
    switch (action) {
      case 'zoom-in':
        zoomTo(stepScale(camera.scale, 1));
        return;
      case 'zoom-out':
        zoomTo(stepScale(camera.scale, -1));
        return;
      case 'zoom-reset':
        zoomTo(1);
        return;
      case 'fit':
        fit();
        return;
      case 'hand-tool':
        set({ handTool: !state.handTool });
        return;
      case 'spacing':
        // It reads the hover in Select mode, so in Interact it would do nothing.
        if (state.mode === MODES.select) set({ spacing: !state.spacing });
        return;
      case 'collapse-panels':
        toggleBothPanels();
        return;
      case 'hide-ui':
        setChromeHidden(!state.chromeHidden);
        return;
      case 'tab-design':
        showLeftTab('design');
        return;
      case 'tab-theme':
        showLeftTab('theme');
        return;
      case 'view-claude':
        // The chat, or its configuration when the chat isn't one of the modules.
        if (rightViews.includes('claude')) showRightView('claude');
        else if (rightViews.includes('claude-config')) {
          showRightView('claude-config');
        }
        return;
      case 'leave-fill':
        leaveFill();
        return;
    }
  }

  // What Fill replaced, for Esc to bring back.
  let beforeFill:
    | (Pick<ShellState, 'layout' | 'viewport' | 'resized' | 'offsets'> & {
        camera: Camera;
        followFit: boolean;
      })
    | null = null;

  // Dragging a frame's right edge, bottom edge or corner, as in Airship. The
  // app inside lays out live at each new size.
  let resize: {
    id: string;
    grip: Grip;
    from: Point;
    start: Size;
    startOffset: Point;
    before: Pick<ShellState, 'resized' | 'offsets' | 'viewport'>;
  } | null = null;

  function startResize(id: string, grip: Grip, x: number, y: number): void {
    const placed = frameRects(state).find(({ frame }) => frame.id === id);
    if (!placed) return;
    followFit = false;
    resize = {
      id,
      grip,
      from: { x, y },
      start: { width: placed.rect.width, height: placed.rect.height },
      startOffset: state.offsets[id] ?? { x: 0, y: 0 },
      before: {
        resized: state.resized,
        offsets: state.offsets,
        viewport: state.viewport,
      },
    };
    set({ resizing: true, activeFrame: id });
  }

  function moveResize(x: number, y: number): void {
    if (!resize) return;
    const { grip, start, startOffset, from, id } = resize;
    // Screen pixels back to the frame's own.
    const dx = (x - from.x) / camera.scale;
    const dy = (y - from.y) / camera.scale;
    let { width, height } = start;
    let offset = startOffset;
    if (grip.includes('e')) width = clampSize(start.width + dx);
    if (grip.includes('s')) height = clampSize(start.height + dy);
    // A west or north grip moves the origin too, so the opposite edge stays put.
    if (grip.includes('w')) {
      width = clampSize(start.width - dx);
      offset = { ...offset, x: startOffset.x + (start.width - width) };
    }
    if (grip.includes('n')) {
      height = clampSize(start.height - dy);
      offset = { ...offset, y: startOffset.y + (start.height - height) };
    }
    set({
      resized: { ...state.resized, [id]: { width, height } },
      offsets: { ...state.offsets, [id]: offset },
      // The single frame's size is the chosen viewport, so the menu shows it.
      ...(state.layout === 'single'
        ? { viewport: { kind: 'custom' as const, width, height } }
        : {}),
    });
  }

  /** Ends the drag; `cancel` (Esc) puts the frame back as it was. */
  function endResize(cancel = false): void {
    if (!resize) return;
    const { before } = resize;
    resize = null;
    set(cancel ? { ...before, resizing: false } : { resizing: false });
  }

  // DOM work on the canvas node: its size, and a wheel listener that can
  // prevent the page's own zoom (React's onWheel is passive). Created once,
  // so React attaches it once.
  function attachCanvas(node: HTMLElement | null) {
    if (!node) return;
    canvasNode = node;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const canvas = {
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      };
      if (
        canvas.width !== state.canvas.width ||
        canvas.height !== state.canvas.height
      ) {
        set({ canvas });
      }
    });
    observer.observe(node);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        // Pinch, or ⌘/Ctrl and the wheel: zoom about the pointer.
        setCamera(
          zoomAt(
            camera,
            camera.scale *
              wheelZoomFactor(wheelPixels(event.deltaY, event.deltaMode)),
            {
              x: event.clientX - canvasLeft(state),
              y: event.clientY - canvasTop(state),
            },
          ),
        );
        return;
      }
      const dx = event.shiftKey ? event.deltaY : event.deltaX;
      const dy = event.shiftKey ? 0 : event.deltaY;
      setCamera({ ...camera, x: camera.x - dx, y: camera.y - dy });
    };
    node.addEventListener('wheel', onWheel, { passive: false });

    // Drag to pan: with the hand tool or Space held, or the middle button.
    let last: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      const middle = event.button === 1;
      if (!middle && !(event.button === 0 && panReady(state))) return;
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      last = { x: event.clientX, y: event.clientY };
      set({ panning: true });
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!last) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      setCamera({ ...camera, x: camera.x + dx, y: camera.y + dy });
    };
    const onPointerUp = () => {
      if (!last) return;
      last = null;
      set({ panning: false });
    };
    // Space let go outside the window must not leave the canvas stuck in pan.
    const onBlur = () => set({ spaceHeld: false });
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onWindowResize);
    return () => {
      canvasNode = null;
      observer.disconnect();
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onWindowResize);
    };
  }

  return {
    attachCanvas,
    /** The layer that holds the frames: the camera writes its transform. */
    attachWorld(node: HTMLElement | null) {
      worldNode = node;
      drawCamera();
    },
    /** The layer over the frames, at screen size: the camera only moves it. */
    attachChrome(node: HTMLElement | null) {
      chromeNode = node;
      drawCamera();
    },
    getScale: () => camera.scale,
    subscribeScale(listener: Listener) {
      scaleListeners.add(listener);
      return () => {
        scaleListeners.delete(listener);
      };
    },
    getState: () => state,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect,
    setMode(mode: Mode) {
      // Choosing Select or Interact puts the hand down, as V does in Figma.
      set({ mode, handTool: false });
      send({ type: 'set-mode', mode });
    },
    setViewport,
    setLayout,
    startResize,
    moveResize,
    endResize,
    /** Closes a frame opened from a new tab; the layout's own frames stay. */
    closeFrame(id: string) {
      const next = withoutOpenedFrame(state, id);
      const frame = state.frames[id];
      if (!next || !frame) return;
      const size = state.resized[id];
      const offset = state.offsets[id];
      set({ ...next, modules: withoutFrame(state.modules, id) });
      // TRU-14.2: a closed frame comes back, where it was sent, until the notice goes.
      notify('Frame closed', {
        action: {
          label: 'Undo',
          run: () => {
            if (state.frames[id]) return;
            set({
              frames: {
                ...state.frames,
                [id]: { ...frame, loads: frame.loads + 1, connected: false },
              },
              resized: size ? { ...state.resized, [id]: size } : state.resized,
              offsets: offset
                ? { ...state.offsets, [id]: offset }
                : state.offsets,
              notice: null,
            });
          },
        },
      });
    },
    /** A copy of the selected frame, at its route and device. */
    newFrame() {
      const from = state.activeFrame ?? state.leader;
      const route = routeOfFrame(state, from) ?? state.route;
      openFrame(route, { from, name: null });
    },
    /** Opens a link of the app in a frame of its own; another site's is not the app's. */
    openLink(href: string, from: string) {
      const route = routeOf(href, state.appOrigin);
      if (route !== null) openFrame(route, { from, name: null });
    },
    /** A record frame's name; an empty one shows its device again. */
    renameFrame(id: string, name: string) {
      const frame = state.frames[id];
      if (!frame || !openedIds(state).includes(id)) return;
      const { name: _old, ...rest } = frame;
      const trimmed = name.trim();
      set({
        frames: {
          ...state.frames,
          [id]: trimmed ? { ...rest, name: trimmed } : rest,
        },
      });
    },
    selectFrame(id: string | null) {
      set(
        id ? { activeFrame: id, leader: leaderFor(id) } : { activeFrame: null },
      );
    },
    navigate(input: string): boolean {
      const route = normalizeRoute(input, state.appOrigin);
      if (route === null) return false;
      // TRU-14.2: the selected record frame's group, or the layout's frames.
      const record = selectedRecord(state);
      const next = record ? withGroupRoute(state, record, route) : null;
      if (next) {
        set(next);
        return true;
      }
      // Typed by the designer: load it even when the frames are already there.
      loadRoute(route);
      return true;
    },
    /** Side by side: the selected record frame's own group, or the layout's. */
    toggleSideBySide() {
      const record = selectedRecord(state);
      const adds = record && groupOf(state, record).length === 1 ? 2 : 0;
      if (adds && Object.keys(state.frames).length + adds > FRAME_CAP) {
        notify(
          `The canvas holds ${FRAME_CAP} frames. Close one to see this one side by side.`,
        );
        return;
      }
      if (record) {
        const next = withSideBySide(state, record);
        if (next) {
          followFit = true;
          set(next);
        }
        return;
      }
      setLayout(state.layout === 'side-by-side' ? 'single' : 'side-by-side');
    },
    /** Reloads each frame where it is: through its runtime, or a fresh load if it has none. */
    reload(ids?: readonly string[]) {
      reloadFrames(ids ?? Object.keys(state.frames));
    },
    /**
     * Esc in Select mode: the server hands it to every frame, and one that
     * didn't use it answers with leave-fill. In Fill with no frame to ask, or
     * in Interact, the shell has the key to itself.
     */
    escape() {
      const asked =
        state.mode === MODES.select &&
        Object.values(state.frames).some((frame) => frame.connected);
      if (isFill(state) && !asked) {
        leaveFill();
        return;
      }
      send({ type: 'escape' });
    },
    toggleDock,
    showLeftTab,
    showRightView,
    fit,
    zoomTo,
    runShortcut,
    openMenu,
    closeMenu,
    notify,
    /** A panel calls one of its module's server ops. */
    callOp(module: string, op: string, input: unknown): Promise<unknown> {
      return request({ type: 'module-call', module, op, input });
    },
    /** A panel asks one frame's probe. */
    command(
      module: string,
      frame: string,
      name: string,
      input: unknown,
    ): Promise<unknown> {
      return request({ type: 'module-command', module, frame, name, input });
    },
    setSpaceHeld(held: boolean) {
      if (held !== state.spaceHeld) set({ spaceHeld: held });
    },
  };
}

export type ShellStore = ReturnType<typeof createShellStore>;
