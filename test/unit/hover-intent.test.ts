// The hover waits before climbing to an ancestor (TRU-2.3), and only then.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  ASCEND_DELAY_MS,
  createHoverIntent,
} from '../../src/modules/selection/hover-intent';

/** Nodes are paths: `a/b` is inside `a`. */
function setup() {
  const shown: Array<string | null> = [];
  const intent = createHoverIntent<string>({
    contains: (ancestor, node) => node.startsWith(`${ancestor}/`),
    apply: (node) => shown.push(node),
  });
  return { intent, shown };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

it('moves down and across at once', () => {
  const { intent, shown } = setup();
  intent.move('page');
  intent.move('page/card');
  intent.move('page/list');
  expect(shown).toEqual(['page', 'page/card', 'page/list']);
});

it('climbs to an ancestor only after the pointer rests for about 50 ms', () => {
  const { intent, shown } = setup();
  intent.move('page/card/button');
  intent.move('page/card');
  expect(shown).toEqual(['page/card/button']);
  vi.advanceTimersByTime(ASCEND_DELAY_MS - 1);
  expect(shown).toEqual(['page/card/button']);
  vi.advanceTimersByTime(1);
  expect(shown).toEqual(['page/card/button', 'page/card']);
});

it('never flashes the parent when the pointer comes back within the wait', () => {
  const { intent, shown } = setup();
  intent.move('page/card/button');
  intent.move('page/card');
  vi.advanceTimersByTime(20);
  intent.move('page/card/button');
  vi.advanceTimersByTime(ASCEND_DELAY_MS * 2);
  expect(shown).toEqual(['page/card/button']);
});

it('lets a move across cancel a pending climb', () => {
  const { intent, shown } = setup();
  intent.move('page/card/button');
  intent.move('page/card');
  intent.move('page/list');
  vi.advanceTimersByTime(ASCEND_DELAY_MS * 2);
  expect(shown).toEqual(['page/card/button', 'page/list']);
});
