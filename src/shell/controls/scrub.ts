import type { PointerEvent as ReactPointerEvent } from 'react';

import { clampScrub, scrubSteps } from './scale';

/** Below this it's a click on the label, which focuses the field. */
const DRAG_FROM = 3;

/** How a press on a label ended. */
export type ScrubEnd = 'click' | 'release' | 'cancel';

/**
 * Follows a press on a field's label: `onSteps` with the steps travelled since
 * it began, then `onEnd` once. The pointer locks once it's a drag, so it never
 * runs out of screen. Where the browser refuses the lock (it does for a moment
 * after Esc left one) the drag goes on without it. Esc cancels, as does the
 * window losing focus.
 */
export function startScrub(
  event: ReactPointerEvent<HTMLElement>,
  handlers: {
    /** The steps there are each way, from where it began. */
    room: { down: number; up: number };
    onSteps: (steps: number) => void;
    onEnd: (end: ScrubEnd) => void;
  },
): void {
  const handle: HTMLElement = event.currentTarget;
  const listening = new AbortController();
  const { signal } = listening;
  let moved = 0;
  let travelled = 0;
  let dragging = false;
  let locked = false;

  const finish = (end: ScrubEnd): void => {
    listening.abort();
    if (document.pointerLockElement === handle) document.exitPointerLock();
    handlers.onEnd(end);
  };

  handle.setPointerCapture(event.pointerId);
  handle.addEventListener(
    'pointermove',
    (move) => {
      moved = clampScrub(moved + move.movementX, handlers.room);
      travelled += Math.abs(move.movementX);
      if (!dragging && travelled < DRAG_FROM) return;
      if (!dragging) {
        dragging = true;
        // A release can come first: the lock it was too late for ends at once.
        void handle.requestPointerLock()?.then(
          () => {
            if (signal.aborted) document.exitPointerLock();
          },
          () => {},
        );
      }
      handlers.onSteps(scrubSteps(moved));
    },
    { signal },
  );
  handle.addEventListener(
    'pointerup',
    () => finish(dragging ? 'release' : 'click'),
    { signal },
  );
  handle.addEventListener('pointercancel', () => finish('cancel'), { signal });
  // Esc while locked only reaches the page as the lock ending.
  document.addEventListener(
    'pointerlockchange',
    () => {
      if (document.pointerLockElement === handle) locked = true;
      else if (locked) finish('cancel');
    },
    { signal },
  );
  window.addEventListener(
    'keydown',
    (press) => {
      if (press.key !== 'Escape') return;
      press.stopPropagation();
      finish('cancel');
    },
    { signal, capture: true },
  );
  window.addEventListener('blur', () => finish('cancel'), { signal });
}
