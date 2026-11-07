// TRU-14.2: the board is saved per project, outside the repository, and comes
// back as it was left when Truing starts again.
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { boardFile, loadBoard, saveBoard } from '../../src/board';
import type { Board } from '../../src/protocol';
import { boardOf, type FrameState, fromBoard } from '../../src/shell/store';

const BOARD: Board = {
  version: 1,
  layout: 'single',
  viewport: { kind: 'preset', preset: 'desktop' },
  route: '/research-spaces',
  frames: [
    {
      id: 'tab-1',
      route: '/research-spaces/42',
      viewport: { kind: 'preset', preset: 'desktop' },
      group: 'tab-1',
      name: 'Spaces',
      by: 'person',
    },
    {
      id: 'tab-1-phone',
      route: '/research-spaces/42',
      viewport: { kind: 'preset', preset: 'phone' },
      group: 'tab-1',
      by: 'claude',
      size: { width: 400, height: 800 },
      offset: { x: 12, y: -8 },
    },
  ],
};

it('keeps the board next to the project’s profile, outside the project', () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'truing-home-'));
  const file = boardFile('/work/shop', home);
  expect(path.dirname(file)).toBe(path.join(home, 'projects'));
  expect(path.basename(file)).toMatch(/^shop-[0-9a-f]{8}\.board\.json$/);
});

it('saves a board whole and reads it back', () => {
  const file = path.join(
    mkdtempSync(path.join(os.tmpdir(), 'truing-board-')),
    'projects',
    'a.board.json',
  );
  saveBoard(file, BOARD);
  expect(loadBoard(file)).toEqual(BOARD);
  expect(readdirSync(path.dirname(file))).toEqual(['a.board.json']);
});

it('reads a missing or broken board as none', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'truing-board-'));
  expect(loadBoard(path.join(dir, 'none.json'))).toBeNull();
  const broken = path.join(dir, 'broken.json');
  writeFileSync(broken, '{"version":1,"layout":"sideways"}');
  expect(loadBoard(broken)).toBeNull();
});

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

it('turns a board into the shell’s frames and back unchanged', () => {
  const restored = fromBoard(BOARD, BOARD.route);
  expect(Object.keys(restored.frames)).toEqual([
    'main',
    'tab-1',
    'tab-1-phone',
  ]);
  expect(restored.frames['tab-1-phone']).toMatchObject({
    src: '/research-spaces/42',
    group: 'tab-1',
    by: 'claude',
  });
  const state = { appOrigin: 'http://localhost:3000', ...restored };
  expect(boardOf(state)).toEqual(BOARD);
});

it('saves where a record frame really is, not only where it was sent', () => {
  const restored = fromBoard(BOARD, '/');
  const moved = {
    ...restored.frames['tab-1'],
    ...frame('tab-1', '/research-spaces/42'),
    group: 'tab-1',
    viewport: { kind: 'preset', preset: 'desktop' } as const,
    name: 'Spaces',
    by: 'person' as const,
    href: 'http://localhost:3000/research-spaces/42?tab=sources',
    // Its runtime has said where it is: a frame still loading would not count.
    connected: true,
  };
  const state = {
    appOrigin: 'http://localhost:3000',
    ...restored,
    frames: { ...restored.frames, 'tab-1': moved },
  };
  expect(boardOf(state).frames[0]?.route).toBe(
    '/research-spaces/42?tab=sources',
  );
});

it('refuses a board whose routes could load another site, or with more frames than the canvas holds', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'truing-board-'));
  const file = path.join(dir, 'board.json');
  for (const route of ['//evil.example/x', '@evil.example/x', 'evil.example']) {
    writeFileSync(
      file,
      JSON.stringify({ ...BOARD, frames: [{ id: 'tab-1', route }] }),
    );
    expect(loadBoard(file)).toBeNull();
  }
  const many = Array.from({ length: 13 }, (_, i) => ({
    id: `tab-${i}`,
    route: '/',
  }));
  writeFileSync(file, JSON.stringify({ ...BOARD, frames: many }));
  expect(loadBoard(file)).toBeNull();
});
