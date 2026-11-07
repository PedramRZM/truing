// TRU-14.6: a page the app opens in a new tab becomes a frame of its own,
// beside the others, at the size of the frame it came from.
import { expect, it } from 'vitest';

import { MODES } from '../../src/protocol';
import {
  frameLabel,
  frameRects,
  type FrameState,
  type ShellState,
  withOpenedFrame,
  withoutOpenedFrame,
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
