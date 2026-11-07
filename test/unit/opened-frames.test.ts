// TRU-14.6: a page the app opens in a new tab becomes a frame of its own,
// beside the others, at the size of the frame it came from.
import { expect, it } from 'vitest';

import { MODES } from '../../src/protocol';
import {
  barView,
  frameLabel,
  frameRects,
  type FrameState,
  type ShellState,
  withFrameViewport,
  withGroupRoute,
  withOpenedFrame,
  withoutOpenedFrame,
  withSideBySide,
} from '../../src/shell/store';

function frame(id: string, src = '/'): FrameState {
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

function shell(patch: Partial<ShellState> = {}): ShellState {
  return {
    connection: 'open',
    appOrigin: 'http://localhost:3000',
    projectName: 'shop',
    hasTokens: true,
    mode: MODES.interact,
    layout: 'side-by-side',
    viewport: { kind: 'preset', preset: 'desktop' },
    route: '/research-spaces',
    activeFrame: null,
    leader: 'desktop',
    frames: {
      phone: frame('phone'),
      tablet: frame('tablet'),
      desktop: frame('desktop'),
    },
    canvas: { width: 1600, height: 900 },
    docks: { left: true, right: true },
    leftTab: 'design',
    rightView: 'properties',
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
    ...patch,
  };
}

it('places a new frame after the others, at the size of the frame it came from', () => {
  const before = shell({ activeFrame: 'phone' });
  const after = shell({
    ...before,
    ...withOpenedFrame(before, 'tab-1', '/research-spaces/42'),
  });
  const placed = frameRects(after);
  const ids = placed.map(({ frame }) => frame.id);
  expect(ids).toEqual(['phone', 'tablet', 'desktop', 'tab-1']);
  const phone = placed[0]?.rect;
  const opened = placed[3]?.rect;
  expect(opened?.width).toBe(phone?.width);
  expect(opened?.height).toBe(phone?.height);
  const desktop = placed[2]?.rect;
  expect(opened?.x).toBeGreaterThan((desktop?.x ?? 0) + (desktop?.width ?? 0));
  expect(after.frames['tab-1']?.src).toBe('/research-spaces/42');
  expect(frameLabel(after, 'tab-1')).toBe('New tab');
});

it('takes the leader’s size when no frame is active', () => {
  const before = shell({
    layout: 'single',
    frames: { main: frame('main') },
    leader: 'main',
  });
  const after = shell({ ...before, ...withOpenedFrame(before, 'tab-1', '/a') });
  const [main, opened] = frameRects(after);
  expect(opened?.rect.width).toBe(main?.rect.width);
});

it('closes a new frame, and nothing else', () => {
  const before = shell();
  const open = shell({ ...before, ...withOpenedFrame(before, 'tab-1', '/a') });
  const active = shell({ ...open, activeFrame: 'tab-1' });
  const closed = withoutOpenedFrame(active, 'tab-1');
  expect(closed?.frames['tab-1']).toBeUndefined();
  expect(closed?.resized['tab-1']).toBeUndefined();
  expect(closed?.activeFrame).toBeNull();
  expect(withoutOpenedFrame(active, 'desktop')).toBeNull();
});

// TRU-14.2: the selected record frame owns the top bar.

function withTab(patch: Partial<ShellState> = {}): ShellState {
  const before = shell(patch);
  return shell({
    ...before,
    ...withOpenedFrame(before, 'tab-1', '/research-spaces/42'),
  });
}

it('shows the layout in the top bar until a record frame is selected, then that frame', () => {
  const state = withTab();
  expect(barView(state)).toMatchObject({
    route: '/research-spaces',
    sideBySide: true,
  });
  expect(barView({ ...state, activeFrame: 'tab-1' })).toMatchObject({
    route: '/research-spaces/42',
    viewport: { kind: 'preset', preset: 'desktop' },
    sideBySide: false,
  });
});

it('turns a selected frame into Phone, Tablet and Desktop on its route, and folds it back', () => {
  const state = withTab({ activeFrame: 'tab-1' });
  const wide = shell({ ...state, ...withSideBySide(state, 'tab-1') });
  const placed = frameRects(wide);
  expect(placed.map(({ frame }) => frame.id).slice(-3)).toEqual([
    'tab-1-phone',
    'tab-1-tablet',
    'tab-1',
  ]);
  expect(placed.slice(-3).map(({ frame }) => frame.src)).toEqual([
    '/research-spaces/42',
    '/research-spaces/42',
    '/research-spaces/42',
  ]);
  expect(
    placed.slice(-3).map(({ frame }) => frameLabel(wide, frame.id)),
  ).toEqual(['Phone', 'Tablet', 'Desktop']);
  expect(barView(wide).sideBySide).toBe(true);

  const back = shell({ ...wide, ...withSideBySide(wide, 'tab-1') });
  expect(Object.keys(back.frames)).toEqual([
    'phone',
    'tablet',
    'desktop',
    'tab-1',
  ]);
  expect(frameLabel(back, 'tab-1')).toBe('New tab');
});

it('gives a selected frame its own device, folding its group first', () => {
  const state = withTab({ activeFrame: 'tab-1' });
  const wide = shell({ ...state, ...withSideBySide(state, 'tab-1') });
  const phone = { kind: 'preset', preset: 'phone' } as const;
  const next = shell({ ...wide, ...withFrameViewport(wide, 'tab-1', phone) });
  expect(Object.keys(next.frames)).not.toContain('tab-1-phone');
  expect(next.frames['tab-1']?.viewport).toEqual(phone);
  expect(next.frames.desktop?.viewport).toBeUndefined();
});

it('sends only the selected frame’s group to a typed route', () => {
  const state = withTab({ activeFrame: 'tab-1' });
  const wide = shell({ ...state, ...withSideBySide(state, 'tab-1') });
  const moved = shell({
    ...wide,
    ...withGroupRoute(wide, 'tab-1', '/library'),
  });
  expect(moved.frames['tab-1']?.src).toBe('/library');
  expect(moved.frames['tab-1-phone']?.src).toBe('/library');
  expect(moved.frames.desktop?.src).toBe('/');
});

it('leaves the layout’s own frames to the layout', () => {
  const state = withTab();
  expect(withSideBySide(state, 'desktop')).toBeNull();
  expect(
    withFrameViewport(state, 'desktop', { kind: 'preset', preset: 'phone' }),
  ).toBeNull();
  expect(withGroupRoute(state, 'desktop', '/x')).toBeNull();
});

it('opens a link in a frame at the device of the frame it came from, named by its device', () => {
  const before = shell();
  const after = shell({
    ...before,
    ...withOpenedFrame(before, 'tab-1', '/space/1', {
      from: 'phone',
      name: null,
    }),
  });
  expect(after.frames['tab-1']?.viewport).toEqual({
    kind: 'preset',
    preset: 'phone',
  });
  expect(frameLabel(after, 'tab-1')).toBe('Phone');
});

it('never reuses a frame’s id for Side by side, and folds back to the device the frame had', () => {
  const phone = { kind: 'preset', preset: 'phone' } as const;
  const before = shell();
  const open = shell({
    ...before,
    ...withOpenedFrame(before, 'tab-1', '/a', { from: 'phone', name: null }),
    activeFrame: 'tab-1',
  });
  // A frame already called tab-1-phone, from a board saved earlier.
  const taken = shell({
    ...open,
    frames: { ...open.frames, 'tab-1-phone': frame('tab-1-phone', '/kept') },
  });
  const wide = shell({ ...taken, ...withSideBySide(taken, 'tab-1') });
  expect(wide.frames['tab-1-phone']?.src).toBe('/kept');
  expect(wide.frames['tab-1-phone-2']?.group).toBe('tab-1');
  const back = shell({ ...wide, ...withSideBySide(wide, 'tab-1') });
  expect(back.frames['tab-1']?.viewport).toEqual(phone);
  expect(back.frames['tab-1']?.alone).toBeUndefined();
});
