// TRU-14.2: the shell store's frame rules, run through the store itself: the
// messages a frame's runtime and Truing's server send arrive on a fake socket.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { type Board, FRAME_CAP, type ToShell } from '../../src/protocol';
import { createShellStore } from '../../src/shell/store';

const APP = 'http://localhost:3000';

class FakeSocket {
  static last: FakeSocket | null = null;
  sent: unknown[] = [];
  private listeners = new Map<string, Array<(event: unknown) => void>>();
  constructor() {
    FakeSocket.last = this;
  }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {}
  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    innerWidth: 1600,
    __truingShell: { token: 't', wsUrl: 'ws://localhost:9/ws' },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('location', { search: '', reload: () => {} });
  vi.stubGlobal('document', { activeElement: null, body: {} });
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('HTMLElement', class {});
  vi.stubGlobal('HTMLIFrameElement', class {});
  vi.stubGlobal('requestAnimationFrame', (run: () => void) =>
    setTimeout(run, 0),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function open(board: Board | null = null) {
  const store = createShellStore();
  store.connect();
  const socket = FakeSocket.last;
  if (!socket) throw new Error('No socket.');
  const receive = (message: ToShell) =>
    socket.emit('message', { data: JSON.stringify(message) });
  socket.emit('open', {});
  receive({
    type: 'welcome',
    mode: 'interact',
    appOrigin: APP,
    projectName: 'shop',
    hasTokens: true,
    startRoute: '/',
    board,
    frames: [],
    modules: { reports: [], failures: [], changes: [], state: [] },
  });
  /** A frame's page loaded at `route`, as its runtime says. */
  const at = (frame: string, route: string) =>
    receive({ type: 'location', frame, href: `${APP}${route}`, title: '' });
  const saved = () =>
    socket.sent.filter(
      (message): message is { type: 'save-board'; board: Board } =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'save-board',
    );
  return { store, receive, at, saved, state: () => store.getState() };
}

function sideBySideTab() {
  const shell = open();
  shell.receive({ type: 'open-frame', route: '/a' });
  shell.at('tab-1', '/a');
  shell.store.toggleSideBySide();
  for (const id of ['tab-1-phone', 'tab-1-tablet']) shell.at(id, '/a');
  return shell;
}

it('moves a record group with the frame clicked last, and only it', () => {
  const shell = sideBySideTab();
  shell.at('tab-1', '/b');
  const routes = () =>
    ['tab-1-phone', 'tab-1-tablet'].map((id) => shell.state().frames[id]?.src);
  expect(routes()).toEqual(['/b', '/b']);
  expect(shell.state().frames.main?.src).toBe('/');
  // A follower's own redirect starts no chase.
  shell.at('tab-1-phone', '/elsewhere');
  expect(shell.state().frames['tab-1-tablet']?.src).toBe('/b');
});

it('ends a group where its leader ends, though the leader turns back before the others load', () => {
  const shell = sideBySideTab();
  shell.at('tab-1', '/b');
  shell.at('tab-1', '/a');
  expect(
    ['tab-1-phone', 'tab-1-tablet'].map((id) => shell.state().frames[id]?.src),
  ).toEqual(['/a', '/a']);
});

it('lets the group’s next frame lead once its leader is closed', () => {
  const shell = sideBySideTab();
  shell.store.closeFrame('tab-1');
  shell.at('tab-1-phone', '/c');
  expect(shell.state().frames['tab-1-tablet']?.src).toBe('/c');
});

it('opens no frame past the cap, and says so', () => {
  const shell = open();
  for (let i = 0; i < FRAME_CAP + 3; i++) shell.store.newFrame();
  expect(Object.keys(shell.state().frames)).toHaveLength(FRAME_CAP);
  expect(shell.state().notice?.text).toBe(
    `The canvas holds ${FRAME_CAP} frames. Close one to open another.`,
  );
});

it('brings a closed frame back with Undo, but not past the cap', () => {
  const shell = open();
  shell.store.newFrame();
  shell.store.closeFrame('tab-1');
  expect(shell.state().notice?.text).toBe('Frame closed');
  shell.state().notice?.action?.run();
  expect(shell.state().frames['tab-1']).toBeDefined();

  shell.store.closeFrame('tab-1');
  const undo = shell.state().notice?.action;
  for (let i = 0; i < FRAME_CAP; i++) shell.store.newFrame();
  undo?.run();
  expect(Object.keys(shell.state().frames)).toHaveLength(FRAME_CAP);
});

it('saves the board once it settles, and not a state it went back from', () => {
  const shell = open();
  shell.store.newFrame();
  vi.advanceTimersByTime(1000);
  expect(shell.saved()).toHaveLength(1);
  shell.store.selectFrame('tab-1');
  shell.store.toggleSideBySide();
  shell.store.toggleSideBySide();
  vi.advanceTimersByTime(1000);
  expect(shell.saved()).toHaveLength(1);
});

it('gives new frames fresh ids after a restart, whatever the saved ones were called', () => {
  const shell = open({
    version: 1,
    layout: 'single',
    viewport: { kind: 'preset', preset: 'desktop' },
    route: '/',
    frames: [{ id: 'tab-4-phone', route: '/a' }],
  });
  shell.store.newFrame();
  expect(Object.keys(shell.state().frames)).toEqual([
    'main',
    'tab-4-phone',
    'tab-5',
  ]);
});

it('applies Claude’s frame changes without moving the person’s selection', () => {
  const shell = open();
  shell.receive({
    type: 'frame-op',
    op: { kind: 'open', id: 'claude-1', route: '/a', name: 'Look' },
  });
  expect(shell.state().frames['claude-1']).toMatchObject({
    by: 'claude',
    name: 'Look',
  });
  expect(shell.state().activeFrame).toBeNull();
  shell.receive({
    type: 'frame-op',
    op: {
      kind: 'resize',
      frame: 'claude-1',
      viewport: { kind: 'preset', preset: 'phone' },
    },
  });
  expect(shell.state().frames['claude-1']?.viewport).toEqual({
    kind: 'preset',
    preset: 'phone',
  });
  expect(shell.state().activeFrame).toBeNull();
  // The person's own frame isn't Claude's to close.
  shell.store.newFrame();
  shell.receive({ type: 'frame-op', op: { kind: 'close', frame: 'tab-1' } });
  expect(shell.state().frames['tab-1']).toBeDefined();
  shell.receive({ type: 'frame-op', op: { kind: 'close', frame: 'claude-1' } });
  expect(shell.state().frames['claude-1']).toBeUndefined();
});
