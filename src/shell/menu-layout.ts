// The context menu's layout (TRU-2.4): its rows in groups, and where it and its
// lists open so they stay in the window. Pure, so the unit tests cover it.

/** Rows by the group each names, the groups in the order they first appear. */
export function groupRows<R extends { group: string }>(
  rows: readonly R[],
): { group: string; rows: R[] }[] {
  const groups = new Map<string, R[]>();
  for (const row of rows) {
    const group = groups.get(row.group);
    if (group) group.push(row);
    else groups.set(row.group, [row]);
  }
  return [...groups].map(([group, grouped]) => ({ group, rows: grouped }));
}

type Size = { width: number; height: number };
type Rect = { left: number; top: number; right: number; bottom: number };
type Place = { left: number; top: number };

/** How close to the window's edge a menu may come. */
export const MENU_MARGIN = 8;

/** Inside [margin, extent − margin − size], or at the margin when it can't fit. */
function clamp(at: number, size: number, extent: number): number {
  return Math.max(MENU_MARGIN, Math.min(at, extent - MENU_MARGIN - size));
}

/**
 * At a point: right of it and below it, flipped to the left or above where
 * it would leave the window, then kept inside.
 */
export function placeAtPoint(
  point: { x: number; y: number },
  size: Size,
  window: Size,
): Place {
  const right = point.x + size.width <= window.width - MENU_MARGIN;
  const below = point.y + size.height <= window.height - MENU_MARGIN;
  return {
    left: clamp(
      right ? point.x : point.x - size.width,
      size.width,
      window.width,
    ),
    top: clamp(
      below ? point.y : point.y - size.height,
      size.height,
      window.height,
    ),
  };
}

/**
 * A list beside its row: to the right of the menu, level with the row;
 * to the left of the menu where there's no room, and moved up to fit.
 */
export function placeBeside(
  row: Rect,
  menu: Rect,
  size: Size,
  window: Size,
): Place {
  const right = menu.right + size.width <= window.width - MENU_MARGIN;
  return {
    left: clamp(
      right ? menu.right : menu.left - size.width,
      size.width,
      window.width,
    ),
    top: clamp(row.top, size.height, window.height),
  };
}

/** The gap between a field and the menu it opens. */
const MENU_GAP = 4;

/**
 * Under a field, its end edge lined up with the field's, as the panels sit at
 * the window's right; above where it would leave the window, then kept inside.
 */
export function placeUnder(anchor: Rect, size: Size, window: Size): Place {
  const below =
    anchor.bottom + MENU_GAP + size.height <= window.height - MENU_MARGIN;
  return {
    left: clamp(anchor.right - size.width, size.width, window.width),
    top: clamp(
      below ? anchor.bottom + MENU_GAP : anchor.top - MENU_GAP - size.height,
      size.height,
      window.height,
    ),
  };
}
