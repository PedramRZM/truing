/** How long the pointer must rest before the hover climbs to an ancestor. */
export const ASCEND_DELAY_MS = 50;

/**
 * The hover follows the pointer at once going down or across, and waits a
 * moment before climbing to an ancestor (after Airship's picker). Moving
 * across a child's edge for a frame or two would otherwise flash its parent's
 * outline and label.
 */
export function createHoverIntent<T>(options: {
  /** Whether `ancestor` contains `node`. */
  contains: (ancestor: T, node: T) => boolean;
  /** Shows the hover on a node, or clears it. */
  apply: (node: T | null) => void;
  delay?: number;
}) {
  const delay = options.delay ?? ASCEND_DELAY_MS;
  let current: T | null = null;
  let waiting: ReturnType<typeof setTimeout> | null = null;

  function cancel(): void {
    if (waiting) clearTimeout(waiting);
    waiting = null;
  }

  function show(node: T | null): void {
    cancel();
    current = node;
    options.apply(node);
  }

  return {
    /** The pointer is over `node` now. */
    move(node: T | null): void {
      if (node === current) {
        // Back where the hover already is: a pending climb is off.
        cancel();
        return;
      }
      if (
        node !== null &&
        current !== null &&
        options.contains(node, current)
      ) {
        cancel();
        waiting = setTimeout(() => show(node), delay);
        return;
      }
      show(node);
    },
    /** Clears the hover at once (a mode change, a tree row). */
    reset(node: T | null = null): void {
      cancel();
      current = node;
    },
    current: (): T | null => current,
  };
}
