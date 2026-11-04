// What keeps the panels still: their props stay the same object until
// something in them changes, so the shell's other news renders none of them.
import { expect, it } from 'vitest';

import type { ModuleSpec } from '../../src/module';
import { panelProps } from '../../src/shell/module-section';
import type { FrameState, ShellState, ShellStore } from '../../src/shell/store';

const spec: ModuleSpec = {
  id: 'selection',
  title: 'Selection',
  probe: { reports: {} },
};
const store = {} as ShellStore;

const frame: FrameState = {
  id: 'main',
  src: '/',
  loads: 0,
  href: 'http://localhost:3000/',
  title: 'Home',
  connected: true,
  pingMs: 4,
};

const base = {
  layout: 'single',
  viewport: { kind: 'preset', preset: 'desktop' },
  canvas: { width: 1000, height: 800 },
  frames: { main: frame },
  activeFrame: null,
  resized: {},
  offsets: {},
  resizing: false,
  modules: { reports: { selection: {} }, failures: [], changes: [], state: {} },
} as unknown as ShellState;

it('keeps the same props through news that a panel does not show', () => {
  const props = panelProps(spec, base, store);
  const later = {
    ...base,
    spaceHeld: true,
    notice: { id: 1, text: 'Copied' },
    frames: { main: { ...frame, pingMs: 9 } },
    modules: {
      ...base.modules,
      reports: { ...base.modules.reports, other: { count: {} } },
    },
  } as ShellState;
  expect(panelProps(spec, later, store)).toBe(props);
});

it('gives new props for a new report, a new active frame or a change to a frame', () => {
  const props = panelProps(spec, base, store);

  const reported = {
    ...base,
    modules: {
      ...base.modules,
      reports: { selection: { selected: { main: null } } },
    },
  };
  expect(panelProps(spec, reported, store)).not.toBe(props);

  const active = { ...base, activeFrame: 'main' };
  expect(panelProps(spec, active, store).activeFrame).toBe('main');

  const moved = {
    ...base,
    frames: { main: { ...frame, href: 'http://localhost:3000/next' } },
  };
  expect(panelProps(spec, moved, store).frames[0]?.href).toBe(
    'http://localhost:3000/next',
  );
});

it('keeps the size a frame had while its edge is dragged, and takes the new one after', () => {
  const start = panelProps(spec, base, store);
  const dragging = {
    ...base,
    resizing: true,
    resized: { main: { width: 900, height: 700 } },
  };
  expect(panelProps(spec, dragging, store).frames).toBe(start.frames);

  const dropped = { ...dragging, resizing: false };
  expect(panelProps(spec, dropped, store).frames[0]?.width).toBe(900);
});
